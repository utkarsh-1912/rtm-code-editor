const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const MeetingRepository = require('../repositories/MeetingRepository');
const RoomRepository = require('../repositories/RoomRepository');
const UserRepository = require('../repositories/UserRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const { verifyToken } = require('../services/Identity');
const { deliver } = require('../services/MailService');
const { meetingEmail, nameFromEmail, rsvpCheck } = require('../services/MeetingMail');
const InterviewRepository = require('../repositories/InterviewRepository');
const CodeRecorder = require('../services/CodeRecorder');
const Branding = require('../services/Branding');

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
    cancelled: !!m.cancelled_at, endedAt: m.ended_at || null,
});

// Organisers: the host, plus co-organisers (by email). They see the guest list, private notes
// and snapshots, can edit, take snapshots and end the meeting. Only the host can delete it or
// change who co-organises.
const isOwner = (m, who) => !!who && who.uid === m.host_uid;
const isOrganiser = (m, who) => isOwner(m, who) || (!!who?.email && (m.co_hosts || []).includes(who.email.toLowerCase()));
const hostView = (m, who) => ({
    ...publicView(m), invitees: m.invitees || [], hostUid: m.host_uid, coHosts: m.co_hosts || [], notes: m.host_notes || '',
    rsvps: m.rsvps || {}, isHost: true, isOwner: isOwner(m, who),
});
const invitedEmail = (m, who) => {
    const email = (who?.email || '').toLowerCase();
    return email && (m.invitees || []).includes(email) ? email : null;
};
// Invitees also see their own answer, so the page can show Going / Not going.
const viewFor = (m, who) => {
    if (isOrganiser(m, who)) return hostView(m, who);
    const email = invitedEmail(m, who);
    return email ? { ...publicView(m), invited: true, rsvp: (m.rsvps || {})[email] || null } : publicView(m);
};
const snapshotView = (x) => ({ id: x.id, kind: x.kind, label: x.label, code: x.code, language: x.language, takenBy: x.taken_by, note: x.note, createdAt: x.created_at });

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

// Meeting emails one account may cause per day (invites, updates, cancellations).
const DAILY_EMAILS = () => Math.max(1, Number(process.env.MEETING_EMAILS_PER_DAY) || 100);

// Email (one each, greeting them by name) + in-app notification. Best effort; never fails the request.
// `kind`: invite | updated | rescheduled | cancelled | removed | reminder (see MeetingMail).
// `by`: the account whose action sends these, counted against its daily cap (none for reminders).
// Past the cap the email is skipped (`limited` counts them); in-app notifications still go out.
async function tellPeople(m, emails, { kind, previous = null, by = null }) {
    const host = (m.host_email || '').toLowerCase();
    const people = [...new Set(emails || [])].filter((e) => e && e !== host);
    let emailed = 0;
    let limited = 0;
    let failed = 0; // the mail service refused or isn't set up
    const brand = await Branding.brandFor(m.brand_org_id).catch(() => null);
    const one = async (email) => {
        const user = await UserRepository.getUserByEmail(email).catch(() => null);
        const name = user?.name && user.name !== 'Developer' ? user.name : nameFromEmail(email);
        const { subject, html, attachments } = meetingEmail(m, { to: { email, name }, kind, previous, brand });
        const allowed = !by || await MeetingRepository.takeMailQuota(by, DAILY_EMAILS()).catch(() => true);
        if (!allowed) limited += 1;
        else {
            const mail = await deliver({ to: [email], subject, html, attachments }).catch(() => ({ success: false }));
            if (mail.success) emailed += 1;
            else {
                failed += 1;
                if (by) MeetingRepository.refundMailQuota(by).catch(() => { });
            }
        }
        if (user?.auth_provider_id) {
            const gone = kind === 'cancelled' || kind === 'removed';
            NotificationRepository.notifyUser(user.auth_provider_id, { type: 'meeting', message: subject, url: gone ? '/dashboard' : `/meet/${m.id}`, data: { meetingId: m.id } }).catch(() => { });
        }
    };
    // A few at a time: 50 invitees one after another would keep the request waiting too long.
    const queue = [...people];
    await Promise.all(Array.from({ length: Math.min(5, queue.length) }, async () => {
        while (queue.length) await one(queue.shift()).catch((err) => console.error('Meeting email failed:', err.message));
    }));
    if (limited) console.warn(`Meeting emails capped for ${by}: ${limited} skipped (${DAILY_EMAILS()}/day)`);
    return { emailed, limited, failed };
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
// Creates a meeting for `host` ({ uid, email, name }): the room (an existing one the host owns,
// or a new one), its access and guest list, the team brand (Enterprise), then the invitations.
// Shared by scheduling and booking links. Throws { status, message } for bad requests.
async function scheduleFor(app, host, f, { roomId: wantRoom = '', roomName = '', coHosts = [], bookingLinkId = null } = {}) {
    let roomId = String(wantRoom || '').trim().slice(0, 255);
    if (roomId) {
        const acc = await RoomRepository.getRoomAccess(roomId);
        if (acc && acc.ownerUid && acc.ownerUid !== host.uid) throw Object.assign(new Error("Only the room's owner can schedule meetings in it."), { status: 403 });
        if (!acc) await RoomRepository.saveRoom(roomId, '', 'javascript', []);
    } else {
        roomId = newRoomId();
        await RoomRepository.saveRoom(roomId, '', 'javascript', []);
    }
    await RoomRepository.claimRoomOwner(roomId, host.uid);
    const current = await RoomRepository.getRoomAccess(roomId);
    if (current?.ownerUid === host.uid) {
        await RoomRepository.setRoomAccess(roomId, host.uid, { visibility: f.access, allowed: [...new Set([...(current.allowed || []), ...f.invitees, ...coHosts])] });
        app.get('io')?.roomAccess?.forget(roomId);
    }
    // Keep the room in the host's workspace (so housekeeping never removes it early).
    const hostUser = await UserRepository.getUser(host.uid).catch(() => null);
    if (hostUser) await RoomRepository.linkRoomToUser(host.uid, roomId).catch(() => { });
    if (roomName && !wantRoom) await RoomRepository.updateRoomName(roomId, String(roomName)).catch(() => { });

    const meeting = await MeetingRepository.createMeeting({
        roomId, title: f.title, description: f.description, startsAt: f.startsAt.toISOString(), durationMin: f.durationMin,
        timeZone: f.timeZone, hostUid: host.uid, hostName: String(host.name || hostUser?.name || host.email || 'Host').slice(0, 120),
        hostEmail: host.email, invitees: f.invitees, access: f.access, coHosts,
        brandOrgId: await Branding.brandOrgFor(host.uid).catch(() => null), bookingLinkId,
    });
    const sent = await tellInvitees(meeting, { kind: 'invite', by: host.uid });
    return { meeting, sent };
}

// Schedule a meeting (signed in). Uses an existing room you may use, or makes a new one.
router.post('/meetings', async (req, res) => {
    try {
        const who = await caller(req);
        if (!who) return res.status(401).json({ error: 'Sign in to schedule meetings.' });
        const b = req.body || {};
        const f = readFields(b);
        if (f.error) return res.status(400).json({ error: f.error });
        if (f.startsAt.getTime() < Date.now() - 5 * 60000) return res.status(400).json({ error: 'That time has already passed.' });
        const { meeting, sent } = await scheduleFor(req.app, { uid: who.uid, email: who.email, name: b.hostName }, f, { roomId: b.roomId, roomName: b.roomName });
        res.json({ meeting: hostView(meeting, who), ...sent });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Schedule meeting failed:', err);
        res.status(500).json({ error: 'Could not schedule the meeting.' });
    }
});

// Your upcoming meetings (hosting or invited).
router.get('/meetings', async (req, res) => {
    try {
        const who = await caller(req);
        if (!who) return res.status(401).json({ error: 'Sign in to see your meetings.' });
        if (req.query.past) {
            const rows = await MeetingRepository.listPastForOrganiser(who.uid, who.email);
            return res.json(rows.map((m) => ({ ...hostView(m, who), snapshotCount: m.snapshot_count || 0 })));
        }
        const rows = await MeetingRepository.listForUser(who.uid, who.email);
        res.json(rows.map((m) => viewFor(m, who)));
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
        res.json({ ...viewFor(m, who), brand: await Branding.brandFor(m.brand_org_id).catch(() => null) });
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
        if (!before || !isOrganiser(before, who)) return res.status(404).json({ error: 'Meeting not found, or not yours.' });
        if (before.cancelled_at) return res.status(400).json({ error: 'This meeting was cancelled.' });
        if (before.ended_at) return res.status(400).json({ error: 'This meeting has ended.' });
        const f = readFields(req.body || {}, before);
        if (f.error) return res.status(400).json({ error: f.error });
        const moved = f.startsAt.getTime() !== new Date(before.starts_at).getTime() || f.durationMin !== before.duration_min;
        if (moved && f.startsAt.getTime() < Date.now() - 5 * 60000) return res.status(400).json({ error: 'That time has already passed.' });

        const m = await MeetingRepository.updateMeeting(before.id, { ...f, startsAt: f.startsAt.toISOString() });
        if (!m) return res.status(404).json({ error: 'Meeting not found, or not yours.' });

        const was = new Set(before.invitees || []);
        const now = new Set(m.invitees || []);
        const kept = [...now].filter((e) => was.has(e));
        const added = [...now].filter((e) => !was.has(e));
        const removed = [...was].filter((e) => !now.has(e));

        // The room follows the guest list and who can join.
        const acc = await RoomRepository.getRoomAccess(m.room_id).catch(() => null);
        if (acc?.ownerUid === m.host_uid && !m.ended_at) {
            const allowed = (acc.allowed || []).filter((e) => !removed.includes(e)).concat(added);
            await RoomRepository.setRoomAccess(m.room_id, m.host_uid, { visibility: m.access, allowed });
            req.app.get('io')?.roomAccess?.forget(m.room_id);
        }

        const changed = moved || m.title !== before.title || m.description !== before.description || m.access !== before.access;
        let emailed = 0;
        let limited = 0;
        let failed = 0;
        const add = (r) => { emailed += r.emailed; limited += r.limited; failed += r.failed; };
        if (changed && kept.length) add(await tellPeople(m, kept, { kind: moved ? 'rescheduled' : 'updated', previous: before, by: who.uid }));
        if (added.length) add(await tellPeople(m, added, { kind: 'invite', by: who.uid }));
        if (removed.length) add(await tellPeople(m, removed, { kind: 'removed', by: who.uid }));
        // `told` says nobody needed an email (e.g. only the guest list order changed).
        res.json({ meeting: hostView(m, who), emailed, limited, failed, told: emailed + limited + failed > 0 });
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
        const sent = upcoming ? await tellInvitees(m, { kind: 'cancelled', by: who.uid }) : { emailed: 0, limited: 0, failed: 0 };
        res.json({ success: true, ...sent });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete the meeting.' });
    }
});

// --- Accept / Decline ------------------------------------------------------------------------
// Records an answer and tells the organisers (in the app). Returns the updated meeting.
async function answer(m, email, value) {
    if ((m.rsvps || {})[email] === value) return m; // unchanged: no repeat notification
    const updated = await MeetingRepository.setRsvp(m.id, email, value);
    const user = await UserRepository.getUserByEmail(email).catch(() => null);
    const who = user?.name && user.name !== 'Developer' ? user.name : nameFromEmail(email);
    const text = value === 'yes' ? `${who} is coming to ${m.title}` : `${who} can't make ${m.title}`;
    NotificationRepository.notifyUser(m.host_uid, { type: 'meeting', message: text, url: `/meet/${m.id}`, data: { meetingId: m.id } }).catch(() => { });
    for (const co of m.co_hosts || []) {
        const coUser = await UserRepository.getUserByEmail(co).catch(() => null);
        if (coUser?.auth_provider_id) NotificationRepository.notifyUser(coUser.auth_provider_id, { type: 'meeting', message: text, url: `/meet/${m.id}`, data: { meetingId: m.id } }).catch(() => { });
    }
    return updated;
}

// From the email's buttons: a signed link, no sign-in needed. Lands on the meeting page.
router.get('/meetings/:id/rsvp', async (req, res) => {
    const m = await MeetingRepository.getMeeting(req.params.id).catch(() => null);
    const email = String(req.query.e || '').toLowerCase();
    const value = req.query.r === 'no' ? 'no' : 'yes';
    if (!m) return res.redirect(`${APP()}/meet/${encodeURIComponent(req.params.id)}`);
    const ok = rsvpCheck(m.id, email, req.query.t) && (m.invitees || []).includes(email) && !m.cancelled_at && !m.ended_at;
    if (ok) await answer(m, email, value).catch(() => { });
    res.redirect(`${APP()}/meet/${m.id}?${new URLSearchParams({ rsvp: ok ? value : 'invalid', as: nameFromEmail(email) })}`);
});

// From the meeting page, signed in with the invited address.
router.post('/meetings/:id/rsvp', async (req, res) => {
    try {
        const who = await caller(req);
        if (!who) return res.status(401).json({ error: 'Sign in first.' });
        const m = await MeetingRepository.getMeeting(req.params.id);
        const email = m && invitedEmail(m, who);
        if (!email) return res.status(404).json({ error: "You're not on the guest list for this meeting." });
        if (m.cancelled_at || m.ended_at) return res.status(400).json({ error: 'This meeting is over.' });
        const value = req.body?.answer === 'no' ? 'no' : 'yes';
        res.json(viewFor(await answer(m, email, value), who));
    } catch (err) {
        res.status(500).json({ error: 'Could not save your answer.' });
    }
});

// --- Organiser tools -------------------------------------------------------------------------
// Loads the meeting and checks the caller organises it; sends the error response otherwise.
async function organiserOnly(req, res) {
    const who = await caller(req);
    if (!who) { res.status(401).json({ error: 'Sign in first.' }); return null; }
    const m = await MeetingRepository.getMeeting(req.params.id);
    if (!m || !isOrganiser(m, who)) { res.status(404).json({ error: 'Meeting not found, or not yours.' }); return null; }
    return { who, m };
}

// The room's meeting that you organise (now, next or last), for the tools inside the room.
router.get('/meetings/room/:roomId', async (req, res) => {
    try {
        const who = await caller(req);
        if (!who) return res.json({ meeting: null });
        const rows = await MeetingRepository.meetingsForRoom(req.params.roomId);
        const m = rows.find((x) => isOrganiser(x, who));
        res.json({ meeting: m ? hostView(m, who) : null });
    } catch (err) {
        res.status(500).json({ error: 'Could not load the meeting.' });
    }
});

// Private notes: only organisers ever see them.
router.put('/meetings/:id/notes', async (req, res) => {
    try {
        const ctx = await organiserOnly(req, res);
        if (!ctx) return;
        const m = await MeetingRepository.setNotes(ctx.m.id, String(req.body?.notes || '').slice(0, 20000));
        res.json({ notes: m.host_notes, savedAt: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ error: 'Could not save your notes.' });
    }
});

// Co-organisers (host only). They join the room's allowed list so they keep access after it ends.
router.put('/meetings/:id/co-hosts', async (req, res) => {
    try {
        const ctx = await organiserOnly(req, res);
        if (!ctx) return;
        if (!isOwner(ctx.m, ctx.who)) return res.status(403).json({ error: 'Only the organiser who scheduled it can change co-organisers.' });
        const host = (ctx.m.host_email || '').toLowerCase();
        const list = (Array.isArray(req.body?.coHosts) ? req.body.coHosts : [])
            .map((e) => String(e || '').trim().toLowerCase()).filter((e) => EMAIL.test(e) && e !== host);
        const emails = [...new Set(list)].slice(0, 10);
        const added = emails.filter((e) => !(ctx.m.co_hosts || []).includes(e));
        const dropped = (ctx.m.co_hosts || []).filter((e) => !emails.includes(e) && !(ctx.m.invitees || []).includes(e));
        const m = await MeetingRepository.setCoHosts(ctx.m.id, emails);
        const acc = await RoomRepository.getRoomAccess(m.room_id).catch(() => null);
        if (acc?.ownerUid === m.host_uid && (added.length || dropped.length)) {
            const allowed = [...new Set([...(acc.allowed || []).filter((e) => !dropped.includes(e)), ...added])];
            await RoomRepository.setRoomAccess(m.room_id, m.host_uid, { visibility: acc.visibility, allowed });
            req.app.get('io')?.roomAccess?.forget(m.room_id);
        }
        for (const email of added) {
            const user = await UserRepository.getUserByEmail(email).catch(() => null);
            if (user?.auth_provider_id) {
                NotificationRepository.notifyUser(user.auth_provider_id, { type: 'meeting', message: `${m.host_name || 'The host'} made you a co-organiser of ${m.title}`, url: `/meet/${m.id}`, data: { meetingId: m.id } }).catch(() => { });
            }
        }
        res.json({ meeting: hostView(m, ctx.who) });
    } catch (err) {
        console.error('Co-organisers failed:', err);
        res.status(500).json({ error: 'Could not save co-organisers.' });
    }
});

// The room's code right now, as a snapshot. From inside the room the organiser's editor sends
// its exact text (`code`); otherwise the last saved copy is used.
async function snapshotRoom(m, { kind, label, takenBy, code, language }) {
    const room = await RoomRepository.getRoom(m.room_id).catch(() => null);
    const text = typeof code === 'string' ? code.slice(0, 500000) : room?.code || '';
    return MeetingRepository.addSnapshot(m.id, { kind, label, code: text, language: language || room?.language || null, takenBy });
}
const codeFrom = (b) => ({ code: typeof b?.code === 'string' ? b.code : undefined, language: typeof b?.language === 'string' ? b.language.slice(0, 40) : undefined });

router.get('/meetings/:id/snapshots', async (req, res) => {
    try {
        const ctx = await organiserOnly(req, res);
        if (!ctx) return;
        res.json((await MeetingRepository.listSnapshots(ctx.m.id)).map(snapshotView));
    } catch (err) {
        res.status(500).json({ error: 'Could not load snapshots.' });
    }
});

router.post('/meetings/:id/snapshots', async (req, res) => {
    try {
        const ctx = await organiserOnly(req, res);
        if (!ctx) return;
        const label = String(req.body?.label || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        const takenBy = String(req.body?.takenBy || ctx.who.email || 'Organiser').slice(0, 120);
        const snap = await snapshotRoom(ctx.m, { kind: 'manual', label, takenBy, ...codeFrom(req.body) });
        res.json(snapshotView(snap));
    } catch (err) {
        console.error('Snapshot failed:', err);
        res.status(500).json({ error: 'Could not take the snapshot.' });
    }
});

router.patch('/meetings/:id/snapshots/:sid', async (req, res) => {
    try {
        const ctx = await organiserOnly(req, res);
        if (!ctx) return;
        const b = req.body || {};
        const snap = await MeetingRepository.updateSnapshot(ctx.m.id, Number(req.params.sid), {
            note: b.note === undefined ? null : String(b.note).slice(0, 5000),
            label: b.label === undefined ? null : String(b.label).slice(0, 200),
        });
        if (!snap) return res.status(404).json({ error: 'Snapshot not found.' });
        res.json(snapshotView(snap));
    } catch (err) {
        res.status(500).json({ error: 'Could not save the comment.' });
    }
});

router.delete('/meetings/:id/snapshots/:sid', async (req, res) => {
    try {
        const ctx = await organiserOnly(req, res);
        if (!ctx) return;
        const ok = await MeetingRepository.deleteSnapshot(ctx.m.id, Number(req.params.sid));
        res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'Snapshot not found.' });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete the snapshot.' });
    }
});

// --- Interview feedback, the interviewers' chat, code playback --------------------------------
// What every interviewer rates (1 = weak … 4 = strong) and the overall call.
const CRITERIA = [
    { id: 'problem', label: 'Problem solving' },
    { id: 'code', label: 'Code quality' },
    { id: 'design', label: 'System design' },
    { id: 'communication', label: 'Communication' },
    { id: 'collaboration', label: 'Collaboration' },
];
const RECOMMENDATIONS = ['strong_yes', 'yes', 'no', 'strong_no'];
const feedbackView = (f) => ({
    uid: f.uid, name: f.name || f.email || 'Interviewer', email: f.email, ratings: f.ratings || {}, recommendation: f.recommendation,
    notes: f.notes || '', submittedAt: f.submitted_at, updatedAt: f.updated_at,
});

// Your feedback, and everyone else's once you've submitted yours (so first opinions stay
// independent, as structured interviews recommend).
router.get('/meetings/:id/feedback', async (req, res) => {
    try {
        const ctx = await organiserOnly(req, res);
        if (!ctx) return;
        const rows = await InterviewRepository.getFeedback(ctx.m.id);
        const mine = rows.find((r) => r.uid === ctx.who.uid);
        const others = rows.filter((r) => r.uid !== ctx.who.uid);
        const submitted = others.filter((r) => r.submitted_at);
        res.json({
            criteria: CRITERIA,
            mine: mine ? feedbackView(mine) : null,
            others: mine?.submitted_at ? submitted.map(feedbackView) : [],
            submittedCount: submitted.length + (mine?.submitted_at ? 1 : 0),
            waitingOn: others.filter((r) => !r.submitted_at).map((r) => r.name || r.email),
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not load feedback.' });
    }
});

router.put('/meetings/:id/feedback', async (req, res) => {
    try {
        const ctx = await organiserOnly(req, res);
        if (!ctx) return;
        const b = req.body || {};
        const ratings = {};
        for (const c of CRITERIA) {
            const v = Number(b.ratings?.[c.id]);
            if (Number.isInteger(v) && v >= 1 && v <= 4) ratings[c.id] = v;
        }
        const recommendation = RECOMMENDATIONS.includes(b.recommendation) ? b.recommendation : null;
        if (b.submit && !recommendation) return res.status(400).json({ error: 'Pick your overall recommendation before submitting.' });
        const user = await UserRepository.getUser(ctx.who.uid).catch(() => null);
        const row = await InterviewRepository.saveFeedback(ctx.m.id, {
            uid: ctx.who.uid, email: ctx.who.email, name: user?.name || nameFromEmail(ctx.who.email),
            ratings, recommendation, notes: String(b.notes || '').slice(0, 20000), submit: !!b.submit,
        });
        // Tell the other organisers when someone submits.
        if (b.submit) {
            const text = `${row.name} submitted feedback for ${ctx.m.title}`;
            const uids = new Set([ctx.m.host_uid]);
            for (const email of ctx.m.co_hosts || []) {
                const u = await UserRepository.getUserByEmail(email).catch(() => null);
                if (u?.auth_provider_id) uids.add(u.auth_provider_id);
            }
            uids.delete(ctx.who.uid);
            uids.forEach((uid) => NotificationRepository.notifyUser(uid, { type: 'meeting', message: text, url: `/meet/${ctx.m.id}`, data: { meetingId: ctx.m.id } }).catch(() => { }));
        }
        res.json(feedbackView(row));
    } catch (err) {
        console.error('Feedback failed:', err);
        res.status(500).json({ error: 'Could not save your feedback.' });
    }
});

// Your private notes only (the room's side panel saves these while the call runs).
router.put('/meetings/:id/my-notes', async (req, res) => {
    try {
        const ctx = await organiserOnly(req, res);
        if (!ctx) return;
        const user = await UserRepository.getUser(ctx.who.uid).catch(() => null);
        const row = await InterviewRepository.saveNotes(ctx.m.id, { uid: ctx.who.uid, email: ctx.who.email, name: user?.name || nameFromEmail(ctx.who.email), notes: String(req.body?.notes || '').slice(0, 20000) });
        res.json({ notes: row.notes });
    } catch (err) {
        res.status(500).json({ error: 'Could not save your notes.' });
    }
});

router.get('/meetings/:id/panel', async (req, res) => {
    try {
        const ctx = await organiserOnly(req, res);
        if (!ctx) return;
        res.json((await InterviewRepository.panelMessages(ctx.m.id)).map((r) => ({ id: r.id, author: r.author, text: r.text, at: r.created_at })));
    } catch (err) {
        res.status(500).json({ error: 'Could not load the interviewers\' chat.' });
    }
});

// Code playback frames (see services/CodeRecorder.js for the format).
router.get('/meetings/:id/timeline', async (req, res) => {
    try {
        const ctx = await organiserOnly(req, res);
        if (!ctx) return;
        const rows = await InterviewRepository.frames(ctx.m.id);
        res.set('Cache-Control', 'private, max-age=30');
        res.json(rows.map((r) => ({ at: r.at, ...r.frame })));
    } catch (err) {
        res.status(500).json({ error: 'Could not load the playback.' });
    }
});

// Ends a meeting: a last snapshot, the room locked to organisers, everyone else in it sent out.
// Used by "End meeting" and by the job that ends meetings left running long past their time.
async function closeMeeting(io, meeting, { takenBy, code, language, auto = false }) {
    // Mark it ended first: that's atomic, so two "End" clicks (or End racing the auto-end job)
    // can't both take a final snapshot and send people out twice.
    const m = await MeetingRepository.endMeeting(meeting.id);
    if (!m) return { meeting: (await MeetingRepository.getMeeting(meeting.id)) || meeting, removed: 0, alreadyEnded: true };
    await CodeRecorder.finish(m.id).catch(() => { }); // last playback frame
    await snapshotRoom(m, { kind: 'end', label: auto ? 'Ended automatically after the scheduled time' : 'When the meeting ended', takenBy, code, language });
    // The room goes private. This meeting's guests lose access; organisers keep it, and so does
    // anyone the room's owner had let in for their own use (the room may outlive the meeting).
    const organisers = [m.host_email, ...(m.co_hosts || [])].filter(Boolean).map((e) => e.toLowerCase());
    const guests = new Set((m.invitees || []).filter((e) => !organisers.includes(e)));
    const acc = await RoomRepository.getRoomAccess(m.room_id).catch(() => null);
    if (acc?.ownerUid === m.host_uid) {
        const allowed = [...new Set([...(acc.allowed || []).filter((e) => !guests.has(e)), ...organisers])];
        await RoomRepository.setRoomAccess(m.room_id, m.host_uid, { visibility: 'private', allowed });
    }
    let removed = 0;
    if (io) {
        io.roomAccess?.revoke(m.room_id);
        const inRoom = [...(io.sockets.adapter.rooms.get(m.room_id) || []), ...(io.sockets.adapter.rooms.get(`call:${m.room_id}`) || [])];
        for (const id of new Set(inRoom)) {
            const socket = io.sockets.sockets.get(id);
            if (!socket) continue;
            const who = io.roomAccess?.whoIs(id);
            const allowedIn = who?.email && !guests.has(who.email.toLowerCase()) && (acc?.allowed || []).includes(who.email.toLowerCase());
            if (who && (isOrganiser(m, who) || who.uid === acc?.ownerUid || allowedIn)) {
                socket.emit('meeting-ended', { meetingId: m.id, organiser: isOrganiser(m, who), auto, stays: true });
                continue;
            }
            socket.emit('meeting-ended', { meetingId: m.id, organiser: false });
            socket.to(`call:${m.room_id}`).emit('user-left-video', { userId: id });
            socket.leave(`call:${m.room_id}`);
            socket.leave(m.room_id);
            removed += 1;
        }
    }
    return { meeting: m, removed };
}

// End the meeting for everyone: a last snapshot, then the room locks to organisers only and
// everyone else in it right now is sent out.
router.post('/meetings/:id/end', async (req, res) => {
    try {
        const ctx = await organiserOnly(req, res);
        if (!ctx) return;
        if (ctx.m.ended_at) return res.json({ meeting: hostView(ctx.m, ctx.who), alreadyEnded: true });
        const takenBy = String(req.body?.takenBy || ctx.who.email || 'Organiser').slice(0, 120);
        const { meeting: m, removed, alreadyEnded } = await closeMeeting(req.app.get('io'), ctx.m, { takenBy, ...codeFrom(req.body) });
        res.json({ meeting: hostView(m, ctx.who), removed, alreadyEnded: !!alreadyEnded });
    } catch (err) {
        console.error('End meeting failed:', err);
        res.status(500).json({ error: 'Could not end the meeting.' });
    }
});

module.exports = router;
module.exports.ics = ics;
module.exports.tellInvitees = tellInvitees;
module.exports.closeMeeting = closeMeeting;
module.exports.isOrganiser = isOrganiser;
module.exports.CRITERIA = CRITERIA;
module.exports.scheduleFor = scheduleFor;
module.exports.readFields = readFields;
