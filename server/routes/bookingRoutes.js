// Booking links: a host publishes their weekly hours; a candidate opens the link, sees free
// slots in their own time zone and picks one. That creates the meeting, room and invitations
// just like scheduling it by hand (see scheduleFor in meetingRoutes).
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { sql } = require('../repositories/DatabaseClient');
const UserRepository = require('../repositories/UserRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const Branding = require('../services/Branding');
const { validZone, zonedTime, dateIn } = require('../utils/zone');
const { requireUser } = require('../security/access');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const newId = () => `b${crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, '').slice(0, 11).toLowerCase()}`;

// { mon: [["09:00","17:00"]], ... } with sane, non-overlapping ranges.
function cleanHours(h) {
    const out = {};
    for (const d of DAYS) {
        const ranges = Array.isArray(h?.[d]) ? h[d] : [];
        out[d] = ranges
            .filter((r) => Array.isArray(r) && HHMM.test(r[0]) && HHMM.test(r[1]) && r[0] < r[1])
            .slice(0, 4)
            .map((r) => [r[0], r[1]]);
    }
    return out;
}

function readLink(b, base = {}) {
    const pick = (k, fb) => (b[k] !== undefined ? b[k] : fb);
    const title = String(pick('title', base.title) || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const durationMin = Math.round(Number(pick('durationMin', base.duration_min)) || 45);
    const daysAhead = Math.min(60, Math.max(1, Math.round(Number(pick('daysAhead', base.days_ahead)) || 14)));
    const noticeMin = Math.min(7 * 24 * 60, Math.max(0, Math.round(Number(pick('noticeMin', base.notice_min ?? 240)))));
    const bufferMin = Math.min(120, Math.max(0, Math.round(Number(pick('bufferMin', base.buffer_min ?? 15)))));
    const access = ['public', 'invite', 'private'].includes(pick('access', base.access)) ? pick('access', base.access) : 'invite';
    const coHosts = [...new Set((pick('coHosts', base.co_hosts) || []).map((e) => String(e || '').trim().toLowerCase()).filter((e) => EMAIL.test(e)))].slice(0, 10);
    let error = null;
    if (!title) error = 'Give the booking link a title.';
    else if (durationMin < 15 || durationMin > 240) error = 'Meetings booked this way last 15 minutes to 4 hours.';
    return {
        title, durationMin, daysAhead, noticeMin, bufferMin, access, coHosts, error,
        description: String(pick('description', base.description) || '').slice(0, 2000),
        timeZone: validZone(String(pick('timeZone', base.time_zone) || 'UTC')),
        hours: cleanHours(pick('hours', base.hours)),
        active: pick('active', base.active ?? true) !== false,
    };
}

const view = (l) => ({
    id: l.id, title: l.title, description: l.description, durationMin: l.duration_min, timeZone: l.time_zone, hours: l.hours,
    daysAhead: l.days_ahead, noticeMin: l.notice_min, bufferMin: l.buffer_min, access: l.access, coHosts: l.co_hosts || [], active: l.active,
});

// Times the host (or their co-hosts) are already in a meeting, from now to `until`.
async function busyFor(link, until) {
    const emails = [link.host_email, ...(link.co_hosts || [])].filter(Boolean).map((e) => e.toLowerCase());
    return await sql`
        SELECT starts_at, duration_min FROM meetings
        WHERE cancelled_at IS NULL AND ended_at IS NULL
          AND starts_at < ${until.toISOString()} AND starts_at + make_interval(mins => duration_min) > NOW()
          AND (host_uid = ${link.host_uid} OR co_hosts ?| ${emails}::text[] OR invitees ?| ${emails}::text[])
    `;
}

// Free start times: each day's ranges in the host's zone on the quarter hour, minus the notice
// period, buffers around meetings already booked, and anything already taken.
async function freeSlots(link) {
    const tz = link.time_zone;
    const now = Date.now();
    const earliest = now + link.notice_min * 60000;
    const until = new Date(now + (link.days_ahead + 1) * 86400000);
    const busy = (await busyFor(link, until)).map((m) => {
        const s = new Date(m.starts_at).getTime();
        return [s - link.buffer_min * 60000, s + m.duration_min * 60000 + link.buffer_min * 60000];
    });
    const len = link.duration_min * 60000;
    const step = 15 * 60000; // start times on the quarter hour
    const slots = [];
    for (let day = 0; day <= link.days_ahead && slots.length < 400; day++) {
        const { y, m, d, weekday } = dateIn(now + day * 86400000, tz);
        for (const [from, to] of link.hours?.[weekday] || []) {
            const start = zonedTime(y, m, d, from, tz).getTime();
            const end = zonedTime(y, m, d, to, tz).getTime();
            for (let t = Math.ceil(start / step) * step; t + len <= end; t += step) {
                if (t < earliest) continue;
                if (busy.some(([bs, be]) => t < be && t + len > bs)) continue;
                slots.push(new Date(t).toISOString());
            }
        }
    }
    return [...new Set(slots)].sort();
}

// --- The host's links ------------------------------------------------------------------------
router.get('/booking-links', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        res.json((await sql`SELECT * FROM booking_links WHERE host_uid = ${me.uid} ORDER BY created_at DESC`).map(view));
    } catch (err) { res.status(500).json({ error: 'Could not load your booking links.' }); }
});

router.post('/booking-links', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        const f = readLink(req.body || {});
        if (f.error) return res.status(400).json({ error: f.error });
        const count = await sql`SELECT COUNT(*)::int n FROM booking_links WHERE host_uid = ${me.uid}`;
        if (count[0].n >= 20) return res.status(400).json({ error: 'You can have up to 20 booking links.' });
        const user = await UserRepository.getUser(me.uid).catch(() => null);
        const rows = await sql`
            INSERT INTO booking_links (id, host_uid, host_name, host_email, title, description, duration_min, time_zone, hours, days_ahead, notice_min, buffer_min, access, co_hosts, active)
            VALUES (${newId()}, ${me.uid}, ${user?.name || me.email}, ${me.email}, ${f.title}, ${f.description}, ${f.durationMin}, ${f.timeZone},
                    ${JSON.stringify(f.hours)}::jsonb, ${f.daysAhead}, ${f.noticeMin}, ${f.bufferMin}, ${f.access}, ${JSON.stringify(f.coHosts)}::jsonb, ${f.active})
            RETURNING *
        `;
        res.json(view(rows[0]));
    } catch (err) { console.error('Booking link failed:', err.message); res.status(500).json({ error: 'Could not create the booking link.' }); }
});

router.put('/booking-links/:id', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        const base = (await sql`SELECT * FROM booking_links WHERE id = ${req.params.id} AND host_uid = ${me.uid}`)[0];
        if (!base) return res.status(404).json({ error: 'Booking link not found.' });
        const f = readLink(req.body || {}, base);
        if (f.error) return res.status(400).json({ error: f.error });
        const rows = await sql`
            UPDATE booking_links SET title = ${f.title}, description = ${f.description}, duration_min = ${f.durationMin}, time_zone = ${f.timeZone},
                hours = ${JSON.stringify(f.hours)}::jsonb, days_ahead = ${f.daysAhead}, notice_min = ${f.noticeMin}, buffer_min = ${f.bufferMin},
                access = ${f.access}, co_hosts = ${JSON.stringify(f.coHosts)}::jsonb, active = ${f.active}
            WHERE id = ${base.id} RETURNING *
        `;
        res.json(view(rows[0]));
    } catch (err) { res.status(500).json({ error: 'Could not save the booking link.' }); }
});

router.delete('/booking-links/:id', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        const rows = await sql`DELETE FROM booking_links WHERE id = ${req.params.id} AND host_uid = ${me.uid} RETURNING id`;
        res.status(rows.length ? 200 : 404).json(rows.length ? { success: true } : { error: 'Booking link not found.' });
    } catch (err) { res.status(500).json({ error: 'Could not delete the booking link.' }); }
});

// --- What candidates see -----------------------------------------------------------------------
router.get('/book/:id', async (req, res) => {
    try {
        const link = (await sql`SELECT * FROM booking_links WHERE id = ${req.params.id}`)[0];
        if (!link || !link.active) return res.status(404).json({ error: 'This booking link is not available.' });
        res.set('Cache-Control', 'no-store');
        res.json({
            id: link.id, title: link.title, description: link.description, durationMin: link.duration_min, hostName: link.host_name,
            timeZone: link.time_zone, slots: await freeSlots(link),
            brand: await Branding.brandFor(await Branding.brandOrgFor(link.host_uid).catch(() => null)).catch(() => null),
        });
    } catch (err) { console.error('Booking page failed:', err.message); res.status(500).json({ error: 'Could not load the times.' }); }
});

router.post('/book/:id', async (req, res) => {
    try {
        const link = (await sql`SELECT * FROM booking_links WHERE id = ${req.params.id}`)[0];
        if (!link || !link.active) return res.status(404).json({ error: 'This booking link is not available.' });
        const b = req.body || {};
        const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        const email = String(b.email || '').trim().toLowerCase();
        if (!name) return res.status(400).json({ error: 'Enter your name.' });
        if (!EMAIL.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
        // The slot must still be free right now (someone may have just taken it).
        const slot = new Date(b.startsAt);
        if (Number.isNaN(slot.getTime()) || !(await freeSlots(link)).includes(slot.toISOString())) {
            return res.status(409).json({ error: 'That time was just taken or is no longer available. Pick another.' });
        }
        const { scheduleFor, readFields } = require('./meetingRoutes');
        const note = String(b.note || '').slice(0, 1000);
        const f = readFields({
            title: `${link.title}: ${name}`, startsAt: slot.toISOString(), durationMin: link.duration_min, timeZone: link.time_zone,
            invitees: [email], access: link.access,
            description: [link.description, note ? `Note from ${name}: ${note}` : ''].filter(Boolean).join('\n\n'),
        });
        if (f.error) return res.status(400).json({ error: f.error });
        const { meeting } = await scheduleFor(req.app, { uid: link.host_uid, email: link.host_email, name: link.host_name }, f, { coHosts: link.co_hosts || [], bookingLinkId: link.id });
        NotificationRepository.notifyUser(link.host_uid, { type: 'meeting', message: `${name} booked ${link.title}`, url: `/meet/${meeting.id}`, data: { meetingId: meeting.id } }).catch(() => { });
        res.json({ meetingId: meeting.id, startsAt: meeting.starts_at, url: `/meet/${meeting.id}?as=${encodeURIComponent(name)}` });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Booking failed:', err);
        res.status(500).json({ error: 'Could not book that time.' });
    }
});

module.exports = router;
module.exports.freeSlots = freeSlots;
