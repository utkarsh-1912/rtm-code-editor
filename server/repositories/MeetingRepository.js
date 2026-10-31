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

// Upcoming (or running) meetings someone hosts or is invited to, soonest first.
async function listForUser(uid, email) {
    return await sql`
        SELECT * FROM meetings
        WHERE cancelled_at IS NULL
          AND starts_at + make_interval(mins => duration_min) > NOW()
          AND (host_uid = ${uid} OR (${email || ''} <> '' AND invitees ? ${email || ''}))
        ORDER BY starts_at ASC
        LIMIT 50
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

// Host edits a meeting. A new start time re-arms the reminder.
async function updateMeeting(id, hostUid, f) {
    const rows = await sql`
        UPDATE meetings SET
            title = ${f.title}, description = ${f.description || ''}, starts_at = ${f.startsAt}, duration_min = ${f.durationMin},
            time_zone = ${f.timeZone || 'UTC'}, invitees = ${JSON.stringify(f.invitees || [])}::jsonb, access = ${f.access || 'public'},
            reminded_at = CASE WHEN starts_at = ${f.startsAt}::timestamptz THEN reminded_at ELSE NULL END
        WHERE id = ${id} AND host_uid = ${hostUid} AND cancelled_at IS NULL
        RETURNING *
    `;
    return rows[0] || null;
}

// Removes the meeting for good; returns what it was so invitees can be told.
async function deleteMeeting(id, hostUid) {
    const rows = await sql`DELETE FROM meetings WHERE id = ${id} AND host_uid = ${hostUid} RETURNING *`;
    return rows[0] || null;
}

// Meetings starting within `minutes` that haven't had their reminder; marks them as reminded.
async function takeDueReminders(minutes = 10) {
    return await sql`
        UPDATE meetings SET reminded_at = CURRENT_TIMESTAMP
        WHERE cancelled_at IS NULL AND reminded_at IS NULL
          AND starts_at <= NOW() + make_interval(mins => ${minutes})
          AND starts_at > NOW() - INTERVAL '5 minutes'
        RETURNING *
    `;
}

module.exports = { createMeeting, getMeeting, listForUser, cancelMeeting, updateMeeting, deleteMeeting, takeDueReminders };
