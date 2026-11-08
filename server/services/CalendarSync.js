// Two-way calendar sync with Google Calendar and Microsoft Outlook (OAuth):
//  - busy times in your calendar are never offered on your booking links;
//  - meetings you schedule here are added to your calendar, and updated or removed with them.
// A provider is on when its app credentials are set:
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET
// and CALENDAR_TOKEN_KEY (any string; encrypts the stored refresh tokens). The redirect URL to
// register with the provider is <APP_URL>/api/calendar/<google|microsoft>/callback.
const crypto = require('crypto');
const { sql } = require('../repositories/DatabaseClient');

const APP = () => process.env.APP_URL || 'http://localhost:5000';
// The provider sends people back to this server; CALENDAR_CALLBACK_BASE overrides where that is.
const redirect = (p) => `${process.env.CALENDAR_CALLBACK_BASE || APP()}/api/calendar/${p}/callback`;

const PROVIDERS = {
    google: {
        name: 'Google Calendar',
        id: () => process.env.GOOGLE_CLIENT_ID, secret: () => process.env.GOOGLE_CLIENT_SECRET,
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy',
        extra: { access_type: 'offline', prompt: 'consent' },
    },
    microsoft: {
        name: 'Outlook Calendar',
        id: () => process.env.MICROSOFT_CLIENT_ID, secret: () => process.env.MICROSOFT_CLIENT_SECRET,
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scope: 'openid email offline_access User.Read Calendars.ReadWrite',
        extra: { prompt: 'select_account' },
    },
};

const configured = (p) => !!(PROVIDERS[p]?.id() && PROVIDERS[p]?.secret() && process.env.CALENDAR_TOKEN_KEY);

// --- Token storage (AES-256-GCM, like GitHub tokens) ---------------------------------------------
const key = () => crypto.createHash('sha256').update(String(process.env.CALENDAR_TOKEN_KEY)).digest();
function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
    const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
    return ['v1', iv, c.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}
function decrypt(stored) {
    const [v, iv, tag, data] = String(stored || '').split('.');
    if (v !== 'v1') throw new Error('Unreadable calendar token');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}

// --- OAuth state: who is connecting, signed, valid 10 minutes ------------------------------------
const sign = (s) => crypto.createHmac('sha256', key()).update(`cal-state:${s}`).digest('base64url');
function makeState(uid, provider) {
    const payload = Buffer.from(JSON.stringify({ uid, provider, exp: Date.now() + 10 * 60000, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}
function readState(state) {
    const [payload, mac] = String(state || '').split('.');
    if (!payload || !mac) return null;
    const want = Buffer.from(sign(payload));
    const got = Buffer.from(mac);
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return s.exp > Date.now() ? s : null;
}

function authUrl(provider, uid) {
    const p = PROVIDERS[provider];
    const q = new URLSearchParams({ client_id: p.id(), redirect_uri: redirect(provider), response_type: 'code', scope: p.scope, state: makeState(uid, provider), ...p.extra });
    return `${p.authUrl}?${q}`;
}

async function tokenRequest(provider, params) {
    const p = PROVIDERS[provider];
    const res = await fetch(p.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: p.id(), client_secret: p.secret(), redirect_uri: redirect(provider), ...params }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error_description || data.error || `Token request failed (${res.status})`);
    return data;
}

const emailFromIdToken = (idToken) => {
    try { const c = JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8')); return c.email || c.preferred_username || c.upn || null; } catch { return null; }
};

// Callback: trade the code for tokens and keep the refresh token.
async function finishConnect(provider, code, state) {
    const s = readState(state);
    if (!s || s.provider !== provider) throw new Error('This sign-in link expired. Try connecting again.');
    const t = await tokenRequest(provider, { grant_type: 'authorization_code', code });
    if (!t.refresh_token) throw new Error('The calendar didn’t grant offline access. Try again and allow access.');
    const email = emailFromIdToken(t.id_token);
    await sql`
        INSERT INTO calendar_connections (uid, provider, account_email, refresh_token, created_at)
        VALUES (${s.uid}, ${provider}, ${email}, ${encrypt(t.refresh_token)}, CURRENT_TIMESTAMP)
        ON CONFLICT (uid, provider) DO UPDATE SET account_email = EXCLUDED.account_email, refresh_token = EXCLUDED.refresh_token, created_at = CURRENT_TIMESTAMP
    `;
    return { uid: s.uid, email };
}

const listConnections = async (uid) => (await sql`SELECT provider, account_email, created_at FROM calendar_connections WHERE uid = ${uid}`)
    .map((r) => ({ provider: r.provider, email: r.account_email, since: r.created_at }));
const disconnect = (uid, provider) => sql`DELETE FROM calendar_connections WHERE uid = ${uid} AND provider = ${provider}`;

// A fresh access token for each connection (cached until shortly before it expires).
const accessCache = new Map(); // `${uid}:${provider}` -> { token, exp }
async function accessTokens(uid) {
    const rows = await sql`SELECT provider, refresh_token FROM calendar_connections WHERE uid = ${uid}`;
    const out = [];
    for (const r of rows) {
        if (!configured(r.provider)) continue;
        const k = `${uid}:${r.provider}`;
        const hit = accessCache.get(k);
        if (hit && hit.exp > Date.now() + 60000) { out.push({ provider: r.provider, token: hit.token }); continue; }
        try {
            const t = await tokenRequest(r.provider, { grant_type: 'refresh_token', refresh_token: decrypt(r.refresh_token) });
            accessCache.set(k, { token: t.access_token, exp: Date.now() + (t.expires_in || 3000) * 1000 });
            if (t.refresh_token) await sql`UPDATE calendar_connections SET refresh_token = ${encrypt(t.refresh_token)} WHERE uid = ${uid} AND provider = ${r.provider}`;
            out.push({ provider: r.provider, token: t.access_token });
        } catch (err) {
            console.warn(`Calendar ${r.provider} for ${uid}:`, err.message);
        }
    }
    return out;
}

async function api(url, token, init = {}) {
    const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || `Calendar responded ${res.status}`);
    return data;
}

// [[start, end], …] busy across the user's connected calendars. Errors -> [] (fail open).
async function busy(uid, fromMs, toMs) {
    const out = [];
    for (const { provider, token } of await accessTokens(uid).catch(() => [])) {
        try {
            if (provider === 'google') {
                const d = await api('https://www.googleapis.com/calendar/v3/freeBusy', token, { method: 'POST', body: JSON.stringify({ timeMin: new Date(fromMs).toISOString(), timeMax: new Date(toMs).toISOString(), items: [{ id: 'primary' }] }) });
                for (const b of d.calendars?.primary?.busy || []) out.push([Date.parse(b.start), Date.parse(b.end)]);
            } else {
                const q = new URLSearchParams({ startDateTime: new Date(fromMs).toISOString(), endDateTime: new Date(toMs).toISOString(), $select: 'start,end,showAs,isCancelled', $top: '500' });
                const d = await api(`https://graph.microsoft.com/v1.0/me/calendarView?${q}`, token, { headers: { Prefer: 'outlook.timezone="UTC"' } });
                for (const e of d.value || []) if (!e.isCancelled && e.showAs !== 'free') out.push([Date.parse(`${e.start.dateTime}Z`), Date.parse(`${e.end.dateTime}Z`)]);
            }
        } catch (err) { console.warn(`Calendar busy (${provider}):`, err.message); }
    }
    return out;
}

// --- Meetings into the host's calendar ------------------------------------------------------------
function eventBody(provider, m) {
    const start = new Date(m.starts_at);
    const end = new Date(start.getTime() + m.duration_min * 60000);
    const link = `${APP()}/meet/${m.id}`;
    const text = `${m.description ? `${m.description}\n\n` : ''}Join: ${link}`;
    if (provider === 'google') return { summary: m.title, description: text, location: link, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, source: { title: 'Utkristi CoLabs', url: link } };
    return { subject: m.title, body: { contentType: 'text', content: text }, location: { displayName: link }, start: { dateTime: start.toISOString().replace('Z', ''), timeZone: 'UTC' }, end: { dateTime: end.toISOString().replace('Z', ''), timeZone: 'UTC' } };
}

// Creates, updates or removes the host's calendar copy of a meeting. Never throws.
async function syncMeeting(m) {
    try {
        if (!m?.host_uid) return;
        const ids = { ...(m.calendar_events || {}) };
        const gone = !!(m.cancelled_at || m.deleted);
        for (const { provider, token } of await accessTokens(m.host_uid)) {
            const base = provider === 'google' ? 'https://www.googleapis.com/calendar/v3/calendars/primary/events' : 'https://graph.microsoft.com/v1.0/me/events';
            try {
                if (gone) {
                    if (ids[provider]) await api(`${base}/${encodeURIComponent(ids[provider])}`, token, { method: 'DELETE' }).catch(() => { });
                    delete ids[provider];
                } else if (ids[provider]) {
                    await api(`${base}/${encodeURIComponent(ids[provider])}`, token, { method: 'PATCH', body: JSON.stringify(eventBody(provider, m)) });
                } else {
                    const e = await api(base, token, { method: 'POST', body: JSON.stringify(eventBody(provider, m)) });
                    if (e?.id) ids[provider] = e.id;
                }
            } catch (err) { console.warn(`Calendar sync (${provider}) for ${m.id}:`, err.message); }
        }
        if (!m.deleted) await sql`UPDATE meetings SET calendar_events = ${JSON.stringify(ids)}::jsonb WHERE id = ${m.id}`;
    } catch (err) { console.warn('Calendar sync failed:', err.message); }
}

module.exports = { PROVIDERS, configured, authUrl, finishConnect, listConnections, disconnect, busy, syncMeeting, readState, encrypt, decrypt };
