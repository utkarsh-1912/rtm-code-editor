const { sql } = require('./DatabaseClient');

// --- Feedback: one row per interviewer per meeting ---------------------------------------------
async function getFeedback(meetingId) {
    return await sql`SELECT * FROM meeting_feedback WHERE meeting_id = ${meetingId} ORDER BY submitted_at NULLS LAST, updated_at`;
}

async function saveFeedback(meetingId, { uid, email, name, ratings, recommendation, notes, submit }) {
    const rows = await sql`
        INSERT INTO meeting_feedback (meeting_id, uid, email, name, ratings, recommendation, notes, submitted_at, updated_at)
        VALUES (${meetingId}, ${uid}, ${email || null}, ${name || null}, ${JSON.stringify(ratings || {})}::jsonb, ${recommendation || null}, ${notes || ''},
                ${submit ? new Date().toISOString() : null}, CURRENT_TIMESTAMP)
        ON CONFLICT (meeting_id, uid) DO UPDATE SET
            email = EXCLUDED.email, name = EXCLUDED.name, ratings = EXCLUDED.ratings,
            recommendation = EXCLUDED.recommendation, notes = EXCLUDED.notes,
            submitted_at = COALESCE(meeting_feedback.submitted_at, EXCLUDED.submitted_at),
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `;
    return rows[0];
}

// Just the private notes (the room's side panel writes these while the call runs).
async function saveNotes(meetingId, { uid, email, name, notes }) {
    const rows = await sql`
        INSERT INTO meeting_feedback (meeting_id, uid, email, name, notes, updated_at)
        VALUES (${meetingId}, ${uid}, ${email || null}, ${name || null}, ${notes || ''}, CURRENT_TIMESTAMP)
        ON CONFLICT (meeting_id, uid) DO UPDATE SET notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `;
    return rows[0];
}

// --- Interviewer-only chat ------------------------------------------------------------------------
async function addPanelMessage(meetingId, author, text) {
    const rows = await sql`INSERT INTO meeting_panel (meeting_id, author, text) VALUES (${meetingId}, ${author}, ${text}) RETURNING *`;
    return rows[0];
}
async function panelMessages(meetingId, limit = 300) {
    const rows = await sql`SELECT * FROM meeting_panel WHERE meeting_id = ${meetingId} ORDER BY id DESC LIMIT ${limit}`;
    return rows.reverse();
}

// --- Code playback --------------------------------------------------------------------------------
const MAX_FRAMES = 6000;
async function addFrame(meetingId, frame) {
    const count = await sql`SELECT COUNT(*)::int AS n FROM meeting_timeline WHERE meeting_id = ${meetingId}`;
    if (count[0].n >= MAX_FRAMES) return null;
    await sql`INSERT INTO meeting_timeline (meeting_id, frame) VALUES (${meetingId}, ${JSON.stringify(frame)}::jsonb)`;
    return true;
}
async function frames(meetingId) {
    return await sql`SELECT at, frame FROM meeting_timeline WHERE meeting_id = ${meetingId} ORDER BY id`;
}

// Meetings that are on now (from 10 min before the start to an hour after the end, not ended)
// for a room: code typed there is recorded for playback.
async function liveMeetingForRoom(roomId) {
    const rows = await sql`
        SELECT id FROM meetings
        WHERE room_id = ${roomId} AND cancelled_at IS NULL AND ended_at IS NULL
          AND starts_at - INTERVAL '10 minutes' <= NOW()
          AND starts_at + make_interval(mins => duration_min + 60) >= NOW()
        ORDER BY starts_at DESC LIMIT 1
    `;
    return rows[0]?.id || null;
}

async function addGuestFeedback(meetingId, { name, rating, comment }) {
    const count = await sql`SELECT COUNT(*)::int n FROM meeting_guest_feedback WHERE meeting_id = ${meetingId}`;
    if (count[0].n >= 50) return null;
    return (await sql`INSERT INTO meeting_guest_feedback (meeting_id, name, rating, comment) VALUES (${meetingId}, ${name}, ${rating}, ${comment}) RETURNING *`)[0];
}
const guestFeedback = (meetingId) => sql`SELECT * FROM meeting_guest_feedback WHERE meeting_id = ${meetingId} ORDER BY created_at`;

async function setAiPolicy(meetingId, policy) {
    return (await sql`UPDATE meetings SET ai_policy = ${policy} WHERE id = ${meetingId} RETURNING *`)[0];
}

// The scheduled meeting running in a room right now (same window as liveMeetingForRoom).
async function liveMeetingRow(roomId) {
    const rows = await sql`
        SELECT id, ai_policy FROM meetings
        WHERE room_id = ${roomId} AND cancelled_at IS NULL AND ended_at IS NULL
          AND starts_at - INTERVAL '10 minutes' <= NOW()
          AND starts_at + make_interval(mins => duration_min + 60) >= NOW()
        ORDER BY starts_at DESC LIMIT 1
    `;
    return rows[0] || null;
}

module.exports = { addGuestFeedback, guestFeedback, setAiPolicy, liveMeetingRow, getFeedback, saveFeedback, saveNotes, addPanelMessage, panelMessages, addFrame, frames, liveMeetingForRoom };
