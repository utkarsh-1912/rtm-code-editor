const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const MeetingRepository = require('../repositories/MeetingRepository');
const RoomRepository = require('../repositories/RoomRepository');
const UserRepository = require('../repositories/UserRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const { verifyToken } = require('../services/Identity');
const { deliver, getEmailTemplate } = require('../services/MailService');

const APP = () => process.env.APP_URL || 'http://localhost:5000';
const ACCESS = new Set(['public', 'invite', 'private']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const caller = (req) => verifyToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
const newRoomId = () => Array.from(crypto.randomBytes(8), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

const validZone = (tz) => {
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch { return 'UTC'; }
};
const when = (m) => {
    const tz = validZone(m.time_zone);
    const start = new Date(m.starts_at);
    const text = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(start);
    return `${text} (${tz.replace(/_/g, ' ')}) · ${m.duration_min} min`;
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

// User text goes into email HTML: escape it, keep line breaks.
const escapeHtml = (v) => String(v || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const asHtml = (v) => escapeHtml(v).replace(/\n/g, '<br>');

// Email + in-app notification to everyone invited (best effort; never fails the request).
async function tellInvitees(m, { subject, title, message, ctaText }) {
    const invitees = (m.invitees || []).filter((e) => e !== (m.host_email || '').toLowerCase());
    if (!invitees.length) return { emailed: 0 };
    const html = getEmailTemplate({ title: escapeHtml(title), message: asHtml(message), ctaText, ctaUrl: meetingUrl(m), inviterName: escapeHtml(m.host_name || 'A teammate') });
    const mail = await deliver({ to: invitees, subject, html }).catch(() => ({ success: false }));
    for (const email of invitees) {
        const user = await UserRepository.getUserByEmail(email).catch(() => null);
        if (user?.auth_provider_id) {
            NotificationRepository.notifyUser(user.auth_provider_id, { type: 'meeting', message: `${subject}`, url: `/meet/${m.id}`, data: { meetingId: m.id } }).catch(() => { });
        }
    }
    return { emailed: mail.success ? invitees.length : 0 };
}

// Schedule a meeting (signed in). Uses an existing room you may use, or makes a new one.
router.post('/meetings', async (req, res) => {
    try {
        const who = await caller(req);
        if (!who) return res.status(401).json({ error: 'Sign in to schedule meetings.' });
        const b = req.body || {};
        const title = String(b.title || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        const startsAt = new Date(b.startsAt);
        const durationMin = Math.round(Number(b.durationMin) || 30);
        const invitees = [...new Set((Array.isArray(b.invitees) ? b.invitees : []).map((e) => String(e || '').trim().toLowerCase()).filter((e) => EMAIL.test(e)))].slice(0, 50);
        const access = ACCESS.has(b.access) ? b.access : 'public';
        if (!title) return res.status(400).json({ error: 'Give the meeting a title.' });
        if (Number.isNaN(startsAt.getTime())) return res.status(400).json({ error: 'Pick a date and time.' });
        if (startsAt.getTime() < Date.now() - 5 * 60000) return res.status(400).json({ error: 'That time has already passed.' });
        if (durationMin < 5 || durationMin > 8 * 60) return res.status(400).json({ error: 'Meetings last 5 minutes to 8 hours.' });

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
            roomId, title, description: String(b.description || '').slice(0, 2000), startsAt: startsAt.toISOString(), durationMin,
            timeZone: validZone(String(b.timeZone || 'UTC')), hostUid: who.uid, hostName: String(b.hostName || hostUser?.name || who.email || 'Host').slice(0, 120),
            hostEmail: who.email, invitees, access,
        });
        const sent = await tellInvitees(meeting, {
            subject: `Invitation: ${meeting.title}`,
            title: meeting.title,
            message: `${meeting.host_name} invited you to a call on Utkristi CoLabs.\n${when(meeting)}${meeting.description ? `\n\n${meeting.description}` : ''}\n\nOpen the link to add it to your calendar or join when it starts.`,
            ctaText: 'Open meeting',
        });
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

// Host cancels; invitees are told.
router.delete('/meetings/:id', async (req, res) => {
    try {
        const who = await caller(req);
        if (!who) return res.status(401).json({ error: 'Sign in first.' });
        const m = await MeetingRepository.cancelMeeting(req.params.id, who.uid);
        if (!m) return res.status(404).json({ error: 'Meeting not found, or not yours.' });
        await tellInvitees(m, {
            subject: `Cancelled: ${m.title}`,
            title: `Cancelled: ${m.title}`,
            message: `${m.host_name} cancelled this meeting.\n${when(m)}`,
            ctaText: 'View meeting',
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Could not cancel the meeting.' });
    }
});

module.exports = router;
module.exports.ics = ics;
module.exports.when = when;
module.exports.tellInvitees = tellInvitees;
