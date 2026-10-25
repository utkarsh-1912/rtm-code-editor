// Meeting reminders: every minute, meetings starting within 10 minutes get one reminder (email
// and in-app notification to the host and everyone invited).
const MeetingRepository = require('../repositories/MeetingRepository');
const UserRepository = require('../repositories/UserRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const health = require('../health');

const MINUTE = 60 * 1000;

async function runReminders() {
    if (health.db !== 'ready') return 0;
    const { tellInvitees, when } = require('../routes/meetingRoutes');
    const due = await MeetingRepository.takeDueReminders(10);
    for (const m of due) {
        await tellInvitees(m, {
            subject: `Starting soon: ${m.title}`,
            title: `Starting soon: ${m.title}`,
            message: `${when(m)}\n\nJoin from the link when you're ready.`,
            ctaText: 'Join meeting',
        }).catch(() => { });
        const host = await UserRepository.getUser(m.host_uid).catch(() => null);
        if (host) NotificationRepository.notifyUser(m.host_uid, { type: 'meeting', message: `Starting soon: ${m.title}`, url: `/meet/${m.id}`, data: { meetingId: m.id } }).catch(() => { });
    }
    return due.length;
}

function startReminderJob() {
    const tick = () => runReminders().catch((err) => console.error('Reminders failed:', err.message));
    setTimeout(tick, 30 * 1000);
    return setInterval(tick, MINUTE);
}

module.exports = { startReminderJob, runReminders };
