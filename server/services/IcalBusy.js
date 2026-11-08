// Busy times from a calendar's private iCal address (Google, Outlook, iCloud, …), so booking
// links don't offer times the host already has something on. Read-only, no sign-in to the
// calendar provider. Only known calendar hosts are fetched (the server never fetches other URLs).
const { validZone, zonedTime } = require('../utils/zone');

const HOSTS = [/^calendar\.google\.com$/, /^outlook\.office365\.com$/, /^outlook\.live\.com$/, /^outlook\.office\.com$/, /^p\d+-caldav\.icloud\.com$/, /^calendar\.zoho\.(com|eu|in)$/, /^www\.icloud\.com$/];
const cache = new Map(); // url -> { at, text }
const TTL = 5 * 60 * 1000;
const DAY = 86400000;

// "webcal://…" or "https://…" on a known calendar host -> the https URL; anything else -> null.
function cleanCalendarUrl(raw) {
    const s = String(raw || '').trim().replace(/^webcal:\/\//i, 'https://');
    if (!s) return '';
    let u;
    try { u = new URL(s); } catch { return null; }
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if (!HOSTS.some((re) => re.test(u.hostname))) return null;
    return u.href.slice(0, 1000);
}

async function fetchCalendar(url) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < TTL) return hit.text;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
        const res = await fetch(url, { signal: ctrl.signal, redirect: 'error', headers: { 'User-Agent': 'UtkristiCoLabs/1.0 (booking availability)' } });
        if (!res.ok) throw new Error(`calendar ${res.status}`);
        const text = (await res.text()).slice(0, 5 * 1024 * 1024);
        cache.set(url, { at: Date.now(), text });
        if (cache.size > 200) cache.delete(cache.keys().next().value);
        return text;
    } finally { clearTimeout(t); }
}

// Unfolds lines and splits VEVENTs into { NAME: { value, params } } (EXDATE kept as a list).
function events(text) {
    const lines = String(text).replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
    const out = [];
    let cur = null;
    for (const line of lines) {
        if (line === 'BEGIN:VEVENT') { cur = { EXDATE: [] }; continue; }
        if (line === 'END:VEVENT') { if (cur) out.push(cur); cur = null; continue; }
        if (!cur) continue;
        const i = line.indexOf(':');
        if (i < 0) continue;
        const [name, ...rawParams] = line.slice(0, i).split(';');
        const params = Object.fromEntries(rawParams.map((p) => p.split('=')));
        const value = line.slice(i + 1);
        if (name === 'EXDATE') cur.EXDATE.push(...value.split(',').map((v) => ({ value: v, params })));
        else cur[name] = { value, params };
    }
    return out;
}

// An iCal date/time -> ms. All-day dates are midnight in `fallbackTz`.
function when(prop, fallbackTz) {
    if (!prop) return null;
    const v = prop.value;
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v);
    if (!m) return null;
    const [, y, mo, d, h, mi, , z] = m;
    if (!h) return zonedTime(+y, +mo, +d, '00:00', fallbackTz).getTime();
    if (z) return Date.UTC(+y, +mo - 1, +d, +h, +mi);
    return zonedTime(+y, +mo, +d, `${h}:${mi}`, validZone(prop.params.TZID || fallbackTz)).getTime();
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// Start times of an event between `from` and `to` (simple DAILY/WEEKLY repeats included).
function occurrences(ev, from, to, tz) {
    const start = when(ev.DTSTART, tz);
    if (start == null) return [];
    const end = when(ev.DTEND, tz) ?? (start + (/^\d{8}$/.test(ev.DTSTART.value) ? DAY : 30 * 60000));
    const len = Math.max(0, end - start);
    const skip = new Set(ev.EXDATE.map((x) => when(x, tz)));
    const rule = ev.RRULE ? Object.fromEntries(ev.RRULE.value.split(';').map((p) => p.split('='))) : null;
    const out = [];
    const add = (s) => { if (!skip.has(s) && s < to && s + len > from) out.push([s, s + len]); };
    if (!rule) { add(start); return out; }
    if (!['DAILY', 'WEEKLY'].includes(rule.FREQ)) { add(start); return out; } // rarer repeats: the first only
    const interval = Math.max(1, Number(rule.INTERVAL) || 1);
    const until = rule.UNTIL ? when({ value: rule.UNTIL, params: {} }, tz) : Infinity;
    const count = Number(rule.COUNT) || Infinity;
    const byDay = rule.BYDAY ? rule.BYDAY.split(',').map((d) => DAYS.indexOf(d.slice(-2))).filter((d) => d >= 0) : null;
    let n = 0;
    // Walk day by day from the first start (in UTC days, keeping the wall-clock offset).
    for (let s = start, i = 0; s <= Math.min(to, until) && n < count && i < 3700; s += DAY, i++) {
        const dayIndex = Math.round((s - start) / DAY);
        const dow = new Date(s).getUTCDay();
        let hit;
        if (rule.FREQ === 'DAILY') hit = dayIndex % interval === 0;
        else hit = Math.floor(dayIndex / 7) % interval === 0 && (byDay ? byDay.includes(dow) : dow === new Date(start).getUTCDay());
        if (!hit) continue;
        n++;
        add(s);
    }
    return out;
}

// [[start, end], …] busy in the calendar between now and `until` (ms). Errors -> [] (fail open).
async function busyFromCalendar(url, until, tz = 'UTC') {
    if (!url) return [];
    try {
        const text = await fetchCalendar(url);
        const now = Date.now();
        return events(text)
            .filter((e) => e.STATUS?.value !== 'CANCELLED' && e.TRANSP?.value !== 'TRANSPARENT')
            .flatMap((e) => occurrences(e, now, until, tz));
    } catch {
        return [];
    }
}

module.exports = { cleanCalendarUrl, busyFromCalendar, occurrences, events, when };
