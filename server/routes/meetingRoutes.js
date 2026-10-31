const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const MeetingRepository = require('../repositories/MeetingRepository');
const RoomRepository = require('../repositories/RoomRepository');
const UserRepository = require('../repositories/UserRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const { verifyToken } = require('../services/Identity');
const { deliver } = require('../services/MailService');
const { meetingEmail, nameFromEmail } = require('../services/MeetingMail');

const APP = () => process.env.APP_URL || 'http://localhost:5000';
const ACCESS = new Set(['public', 'invite', 'private']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const caller = (req) => verifyToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
const newRoomId = () => Array.from(crypto.randomBytes(8), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

const validZone = (tz) => {
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch { return 'UTC'; }
};
const meetingUrl = (m) => `${APP()}/meet/${m.id}`;

// What anyone with the meeting link may see.
const publicView = (m) => ({
    id: m.id, roomId: m.room_id, title: m.title, description: m.description, startsAt: m.starts_at,
    durationMin: m.duration_min, timeZone: m.time_zone, hostName: m.host_name, access: m.access,
    cancelled: !!m.cancelled_at,
});
const hostView = (m) => ({ ...publicView(m), invitees: m.invitees || [], hostUid: m.host_uid });

// --- Calendar file (.ics) ---------------------------------------------------------------------
const icsDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function ics(m) {
    const end = new Date(new Date(m.starts_at).getTime() + m.duration_min * 60000);
    return [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Utkristi CoLabs//Meetings//EN', 'CALSCALE:GREGORIAN', `METHOD:${m.cancelled_at ? 'CANCEL' : 'PUBLISH'}`,
        'BEGIN:VEVENT',
        `UID:${m.id}@colabs`,
        `DTSTAMP:${icsDate(new Date())}`,
        `DTSTART:${icsDate(m.starts_at)}`,
        `DTEND:${icsDate(end)}`,
        `SUMMARY:${icsText(m.title)}`,
        `DESCRIPTION:${icsText(`${m.description ? `${m.description}\n\n` : ''}Join: ${meetingUrl(m)}`)}`,
        `URL:${meetingUrl(m)}`,
        `LOCATION:${icsText(meetingUrl(m))}`,
        `STATUS:${m.cancelled_at ? 'CANCELLED' : 'CONFIRMED'}`,
        'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(m.title)}`, 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR', '',
    ].join('\r\n');
}

// Email (one each, greeting them by name) + in-app notification. Best effort; never fails the request.
// `kind`: invite | updated | rescheduled | cancelled | removed | reminder (see MeetingMail).
async function tellPeople(m, emails, { kind, previous = null }) {
    const host = (m.host_email || '').toLowerCase();
    const people = [...new Set(emails || [])].filter((e) => e && e !== host);
    let emailed = 0;
    for (const email of people) {
        const user = await UserRepository.getUserByEmail(email).catch(() => null);
        const name = user?.name && user.name !== 'Developer' ? user.name : nameFromEmail(email);
        const { subject, html } = meetingEmail(m, { to: { email, name }, kind, previous });
        const mail = await deliver({ to: [email], subject, html }).catch(() => ({ success: false }));
        if (mail.success) emailed += 1;
        if (user?.auth_provider_id) {
            const gone = kind === 'cancelled' || kind === 'removed';
            NotificationRepository.notifyUser(user.auth_provider_id, { type: 'meeting', message: subject, url: gone ? '/dashboard' : `/meet/${m.id}`, data: { meetingId: m.id } }).catch(() => { });
        }
    }
    return { emailed };
}
const tellInvitees = (m, opts) => tellPeople(m, m.invitees || [], opts);

// Title, time, length, invitees, access from a request body; `base` fills in what's left out (edits).
function readFields(b, base = {}) {
    const pick = (k, fallback) => (b[k] !== undefined ? b[k] : fallback);
    const title = String(pick('title', base.title) || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const startsAt = new Date(pick('startsAt', base.starts_at));
    const durationMin = Math.round(Number(pick('durationMin', base.duration_min)) || 30);
    const list = pick('invitees', base.invitees);
    const invitees = [...new Set((Array.isArray(list) ? list : []).map((e) => String(e || '').trim().toLowerCase()).filter((e) => EMAIL.test(e)))].slice(0, 50);
    const access = ACCESS.has(pick('access', base.access)) ? pick('access', base.access) : 'public';
    const description = String(pick('description', base.description) || '').slice(0, 2000);
    const timeZone = validZone(String(pick('timeZone', base.time_zone) || 'UTC'));
    let error = null;
    if (!title) error = 'Give the meeting a title.';
    else if (Number.isNaN(startsAt.getTime())) error = 'Pick a date and time.';
    else if (durationMin < 5 || durationMin > 8 * 60) error = 'Meetings last 5 minutes to 8 hours.';
    return { title, startsAt, durationMin, invitees, access, description, timeZone, error };
}

// Schedule a meeting (signed in). Uses an existing room you may use, or makes a new one.
router.post('/meetings', async (req, res) => {
    try {
        const who = await caller(req);
        if (!who) return res.status(401).json({ error: 'Sign in to schedule meetings.' });
        const b = req.body || {};
        const { title, startsAt, durationMin, invitees, access, description, timeZone, error } = readFields(b);
        if (error) return res.status(400).json({ error });
        if (startsAt.getTime() < Date.now() - 5 * 60000) return res.status(400).json({ error: 'That time has already passed.' });

        // The room: existing (you must own it, or it must be open) or a fresh one you own.
        let roomId = String(b.roomId || '').trim().slice(0, 255);
        if (roomId) {
            const acc = await RoomRepository.getRoomAccess(roomId);
            if (acc && acc.ownerUid && acc.ownerUid !== who.uid) return res.status(403).json({ error: "Only the room's owner can schedule meetings in it." });
            if (!acc) await RoomRepository.saveRoom(roomId, '', 'javascript', []);
        } else {
            roomId = newRoomId();
            await RoomRepository.saveRoom(roomId, '', 'javascript', []);
        }
        await RoomRepository.claimRoomOwner(roomId, who.uid);
        const current = await RoomRepository.getRoomAccess(roomId);
        if (current?.ownerUid === who.uid) {
            await RoomRepository.setRoomAccess(roomId, who.uid, {
                visibility: access,
                allowed: [...(current.allowed || []), ...invitees],
            });
            req.app.get('io')?.roomAccess?.forget(roomId);
        }
        // Keep the room in the host's workspace (so housekeeping never removes it early).
        const hostUser = await UserRepository.getUser(who.uid).catch(() => null);
        if (hostUser) await RoomRepository.linkRoomToUser(who.uid, roomId).catch(() => { });
        if (b.roomName && !b.roomId) await RoomRepository.updateRoomName(roomId, String(b.roomName)).catch(() => { });

        const meeting = await MeetingRepository.createMeeting({
            roomId, title, description, startsAt: startsAt.toISOString(), durationMin,
            timeZone, hostUid: who.uid, hostName: String(b.hostName || hostUser?.name || who.email || 'Host').slice(0, 120),
            hostEmail: who.email, invitees, access,
        });
        const sent = await tellInvitees(meeting, { kind: 'invite' });
        res.json({ meeting: hostView(meeting), ...sent });
    } catch (err) {
        console.error('Schedule meeting failed:', err);
        res.status(500).json({ error: 'Could not schedule the meeting.' });
    }
});

// Your upcoming meetings (hosting or invited).
router.get('/meetings', async (req, res) => {
    try {
        const who = await caller(req);
        if (!who) return res.status(401).json({ error: 'Sign in to see your meetings.' });
        const rows = await MeetingRepository.listForUser(who.uid, who.email);
        res.json(rows.map((m) => (m.host_uid === who.uid ? { ...hostView(m), isHost: true } : publicView(m))));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load meetings.' });
    }
});

router.get('/meetings/:id', async (req, res) => {
    try {
        const m = await MeetingRepository.getMeeting(req.params.id);
        if (!m) return res.status(404).json({ error: 'Meeting not found.' });
        const who = await caller(req);
        res.json(who && who.uid === m.host_uid ? { ...hostView(m), isHost: true } : publicView(m));
    } catch (err) {
        res.status(500).json({ error: 'Could not load the meeting.' });
    }
});

router.get('/meetings/:id/ics', async (req, res) => {
    try {
        const m = await MeetingRepository.getMeeting(req.params.id);
        if (!m) return res.status(404).send('Meeting not found');
        res.set('Content-Type', 'text/calendar; charset=utf-8');
        res.set('Content-Disposition', `attachment; filename="${m.title.replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'meeting'}.ics"`);
        res.send(ics(m));
    } catch (err) {
        res.status(500).send('Could not build the calendar file');
    }
});

// Host edits: a new time is a reschedule, other changes an update. New invitees get an
// invitation; removed ones are told the meeting no longer includes them.
router.patch('/meetings/:id', async (req, res) => {
    try {
        const who = await caller(req);
        if (!who) return res.status(401).json({ error: 'Sign in first.' });
        const before = await MeetingRepository.getMeeting(req.params.id);
        if (!before || before.host_uid !== who.uid) return res.status(404).json({ error: 'Meeting not found, or not yours.' });
        if (before.cancelled_at) return res.status(400).json({ error: 'This meeting was cancelled.' });
        const f = readFields(req.body || {}, before);
        if (f.error) return res.status(400).json({ error: f.error });
        const moved = f.startsAt.getTime() !== new Date(before.starts_at).getTime() || f.durationMin !== before.duration_min;
        if (moved && f.startsAt.getTime() < Date.now() - 5 * 60000) return res.status(400).json({ error: 'That time has already passed.' });

        const m = await MeetingRepository.updateMeeting(before.id, who.uid, { ...f, startsAt: f.startsAt.toISOString() });
        if (!m) return res.status(404).json({ error: 'Meeting not found, or not yours.' });

        const was = new Set(before.invitees || []);
        const now = new Set(m.invitees || []);
        const kept = [...now].filter((e) => was.has(e));
        const added = [...now].filter((e) => !was.has(e));
        const removed = [...was].filter((e) => !now.has(e));

        // The room follows the guest list and who can join.
        const acc = await RoomRepository.getRoomAccess(m.room_id).catch(() => null);
        if (acc?.ownerUid === who.uid) {
            const allowed = (acc.allowed || []).filter((e) => !removed.includes(e)).concat(added);
            await RoomRepository.setRoomAccess(m.room_id, who.uid, { visibility: m.access, allowed });
            req.app.get('io')?.roomAccess?.forget(m.room_id);
        }

        const changed = moved || m.title !== before.title || m.description !== before.description || m.access !== before.access;
        let emailed = 0;
        if (changed && kept.length) emailed += (await tellPeople(m, kept, { kind: moved ? 'rescheduled' : 'updated', previous: before })).emailed;
        if (added.length) emailed += (await tellPeople(m, added, { kind: 'invite' })).emailed;
        if (removed.length) emailed += (await tellPeople(m, removed, { kind: 'removed' })).emailed;
        res.json({ meeting: { ...hostView(m), isHost: true }, emailed });
    } catch (err) {
        console.error('Edit meeting failed:', err);
        res.status(500).json({ error: 'Could not save the meeting.' });
    }
});

// Host deletes the meeting. If it hadn't happened yet, invitees are told it's cancelled.
router.delete('/meetings/:id', async (req, res) => {
    try {
        const who = await caller(req);
        if (!who) return res.status(401).json({ error: 'Sign in first.' });
        const m = await MeetingRepository.deleteMeeting(req.params.id, who.uid);
        if (!m) return res.status(404).json({ error: 'Meeting not found, or not yours.' });
        const upcoming = !m.cancelled_at && new Date(m.starts_at).getTime() + m.duration_min * 60000 > Date.now();
        const sent = upcoming ? await tellInvitees(m, { kind: 'cancelled' }) : { emailed: 0 };
        res.json({ success: true, ...sent });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete the meeting.' });
    }
});

module.exports = router;
module.exports.ics = ics;
module.exports.tellInvitees = tellInvitees;
