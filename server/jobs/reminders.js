// Meeting housekeeping, every minute:
//  - reminders: meetings starting within 10 minutes get one (email + in-app, host and invitees);
//  - running over: 10 minutes past the end, organisers are asked to end it (in-app, and a
//    prompt in the room if they're there);
//  - forgotten: an hour past the end, the meeting is ended for them (final snapshot, room
//    locked to organisers), so a room never stays open to everyone by accident.
const MeetingRepository = require('../repositories/MeetingRepository');
const UserRepository = require('../repositories/UserRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const health = require('../health');

const MINUTE = 60 * 1000;
const NUDGE_AFTER = 10;
const AUTO_END_AFTER = 60;

// The host and co-organisers, as account ids (co-organisers may not have an account).
async function organiserUids(m) {
    const uids = [m.host_uid];
    for (const email of m.co_hosts || []) {
        const user = await UserRepository.getUserByEmail(email).catch(() => null);
        if (user?.auth_provider_id) uids.push(user.auth_provider_id);
    }
    return uids;
}

async function runReminders(io = null) {
    if (health.db !== 'ready') return 0;
    const { tellInvitees, closeMeeting, isOrganiser } = require('../routes/meetingRoutes');

    const due = await MeetingRepository.takeDueReminders(10);
    for (const m of due) {
        await tellInvitees(m, { kind: 'reminder' }).catch(() => { });
        const host = await UserRepository.getUser(m.host_uid).catch(() => null);
        if (host) NotificationRepository.notifyUser(m.host_uid, { type: 'meeting', message: `Starting soon: ${m.title}`, url: `/meet/${m.id}`, data: { meetingId: m.id } }).catch(() => { });
    }

    for (const m of await MeetingRepository.takeOverruns(NUDGE_AFTER)) {
        for (const uid of await organiserUids(m)) {
            NotificationRepository.notifyUser(uid, { type: 'meeting', message: `${m.title} is past its end time. End it when you're done; it ends by itself in ${AUTO_END_AFTER - NUDGE_AFTER} minutes.`, url: `/meet/${m.id}`, data: { meetingId: m.id } }).catch(() => { });
        }
        // Organisers in the room get a prompt with an End button.
        for (const id of io?.sockets.adapter.rooms.get(m.room_id) || []) {
            const who = io.roomAccess?.whoIs(id);
            if (who && isOrganiser(m, who)) io.to(id).emit('meeting-overrun', { meetingId: m.id, title: m.title, autoEndInMin: AUTO_END_AFTER - NUDGE_AFTER });
        }
    }

    for (const m of await MeetingRepository.dueAutoEnd(AUTO_END_AFTER)) {
        const result = await closeMeeting(io, m, { takenBy: 'Automatically', auto: true }).catch((err) => { console.error('Auto-end failed:', err.message); return null; });
        if (!result || result.alreadyEnded) continue;
        for (const uid of await organiserUids(m)) {
            NotificationRepository.notifyUser(uid, { type: 'meeting', message: `${m.title} was ended automatically an hour after its end time. Your notes and snapshots are kept.`, url: `/meet/${m.id}`, data: { meetingId: m.id } }).catch(() => { });
        }
    }
    return due.length;
}

function startReminderJob(io = null) {
    const tick = () => runReminders(io).catch((err) => console.error('Meeting job failed:', err.message));
    setTimeout(tick, 30 * 1000);
    return setInterval(tick, MINUTE);
}

module.exports = { startReminderJob, runReminders };
