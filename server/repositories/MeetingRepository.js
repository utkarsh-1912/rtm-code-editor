const crypto = require('crypto');
const { sql } = require('./DatabaseClient');

const newId = () => `m${crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, '').slice(0, 11).toLowerCase()}`;

async function createMeeting(m) {
    const rows = await sql`
        INSERT INTO meetings (id, room_id, title, description, starts_at, duration_min, time_zone, host_uid, host_name, host_email, invitees, access)
        VALUES (${newId()}, ${m.roomId}, ${m.title}, ${m.description || ''}, ${m.startsAt}, ${m.durationMin}, ${m.timeZone || 'UTC'},
                ${m.hostUid}, ${m.hostName || null}, ${m.hostEmail || null}, ${JSON.stringify(m.invitees || [])}::jsonb, ${m.access || 'public'})
        RETURNING *
    `;
    return rows[0];
}

async function getMeeting(id) {
    const rows = await sql`SELECT * FROM meetings WHERE id = ${id}`;
    return rows[0] || null;
}

// Upcoming (or running) meetings someone hosts, co-organises or is invited to, soonest first.
async function listForUser(uid, email) {
    return await sql`
        SELECT * FROM meetings
        WHERE cancelled_at IS NULL AND ended_at IS NULL
          AND starts_at + make_interval(mins => duration_min) > NOW()
          AND (host_uid = ${uid} OR (${email || ''} <> '' AND (invitees ? ${email || ''} OR co_hosts ? ${email || ''})))
        ORDER BY starts_at ASC
        LIMIT 50
    `;
}

// Meetings you organised that are over (ended, or past their time), newest first: to review.
async function listPastForOrganiser(uid, email) {
    return await sql`
        SELECT m.*, (SELECT COUNT(*)::int FROM meeting_snapshots s WHERE s.meeting_id = m.id) AS snapshot_count
        FROM meetings m
        WHERE m.cancelled_at IS NULL
          AND (m.ended_at IS NOT NULL OR m.starts_at + make_interval(mins => m.duration_min) <= NOW())
          AND (m.host_uid = ${uid} OR (${email || ''} <> '' AND m.co_hosts ? ${email || ''}))
        ORDER BY m.starts_at DESC
        LIMIT 20
    `;
}

// Meetings a room is holding (nearest in time first), for the organiser tools in the room.
async function meetingsForRoom(roomId) {
    return await sql`
        SELECT * FROM meetings
        WHERE room_id = ${roomId} AND cancelled_at IS NULL AND ended_at IS NULL
        ORDER BY ABS(EXTRACT(EPOCH FROM (starts_at - NOW()))) ASC
        LIMIT 5
    `;
}

async function cancelMeeting(id, hostUid) {
    const rows = await sql`
        UPDATE meetings SET cancelled_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND host_uid = ${hostUid} AND cancelled_at IS NULL
        RETURNING *
    `;
    return rows[0] || null;
}

// An organiser edits a meeting (the route checks who may). A new start time re-arms the reminder.
async function updateMeeting(id, f) {
    const rows = await sql`
        UPDATE meetings SET
            title = ${f.title}, description = ${f.description || ''}, starts_at = ${f.startsAt}, duration_min = ${f.durationMin},
            time_zone = ${f.timeZone || 'UTC'}, invitees = ${JSON.stringify(f.invitees || [])}::jsonb, access = ${f.access || 'public'},
            reminded_at = CASE WHEN starts_at = ${f.startsAt}::timestamptz THEN reminded_at ELSE NULL END
        WHERE id = ${id} AND cancelled_at IS NULL
        RETURNING *
    `;
    return rows[0] || null;
}

async function setNotes(id, notes) {
    const rows = await sql`UPDATE meetings SET host_notes = ${notes} WHERE id = ${id} RETURNING *`;
    return rows[0] || null;
}

async function setCoHosts(id, emails) {
    const rows = await sql`UPDATE meetings SET co_hosts = ${JSON.stringify(emails)}::jsonb WHERE id = ${id} RETURNING *`;
    return rows[0] || null;
}

// Marks the meeting ended (once). Returns the row, or null if it had already ended.
async function endMeeting(id) {
    const rows = await sql`UPDATE meetings SET ended_at = CURRENT_TIMESTAMP WHERE id = ${id} AND ended_at IS NULL RETURNING *`;
    return rows[0] || null;
}

// Removes the meeting for good (and its snapshots); returns what it was so invitees can be told.
async function deleteMeeting(id, hostUid) {
    const rows = await sql`DELETE FROM meetings WHERE id = ${id} AND host_uid = ${hostUid} RETURNING *`;
    return rows[0] || null;
}

// --- Snapshots ---------------------------------------------------------------------------------
async function addSnapshot(meetingId, { kind = 'manual', label = '', code = '', language = null, takenBy = null }) {
    const rows = await sql`
        INSERT INTO meeting_snapshots (meeting_id, kind, label, code, language, taken_by)
        VALUES (${meetingId}, ${kind}, ${label}, ${code || ''}, ${language}, ${takenBy})
        RETURNING *
    `;
    return rows[0];
}

async function listSnapshots(meetingId) {
    return await sql`SELECT * FROM meeting_snapshots WHERE meeting_id = ${meetingId} ORDER BY created_at ASC`;
}

async function updateSnapshot(meetingId, snapshotId, { note = null, label = null }) {
    const rows = await sql`
        UPDATE meeting_snapshots SET note = COALESCE(${note}, note), label = COALESCE(${label}, label)
        WHERE id = ${snapshotId} AND meeting_id = ${meetingId}
        RETURNING *
    `;
    return rows[0] || null;
}

async function deleteSnapshot(meetingId, snapshotId) {
    const rows = await sql`DELETE FROM meeting_snapshots WHERE id = ${snapshotId} AND meeting_id = ${meetingId} RETURNING id`;
    return rows.length > 0;
}

// Meetings starting within `minutes` that haven't had their reminder; marks them as reminded.
async function takeDueReminders(minutes = 10) {
    return await sql`
        UPDATE meetings SET reminded_at = CURRENT_TIMESTAMP
        WHERE cancelled_at IS NULL AND ended_at IS NULL AND reminded_at IS NULL
          AND starts_at <= NOW() + make_interval(mins => ${minutes})
          AND starts_at > NOW() - INTERVAL '5 minutes'
        RETURNING *
    `;
}

module.exports = {
    createMeeting, getMeeting, listForUser, listPastForOrganiser, meetingsForRoom, cancelMeeting, updateMeeting,
    setNotes, setCoHosts, endMeeting, deleteMeeting, addSnapshot, listSnapshots, updateSnapshot, deleteSnapshot, takeDueReminders,
};
