// Housekeeping to keep the database small. Runs hourly (first run a few minutes after start):
//  - guest rooms (in nobody's workspace) idle for GUEST_ROOM_TTL_HOURS (default 6) are deleted,
//    unless someone is in them right now; their in-memory chat/whiteboard/problem go too
//  - device sessions that were signed out over 30 days ago, or idle for 90 days, are deleted
//  - analytics rows for rooms that no longer exist, older than 30 days, are deleted
const { sql } = require('../repositories/DatabaseClient');
const RoomRepository = require('../repositories/RoomRepository');
const health = require('../health');

const HOUR = 60 * 60 * 1000;
const TTL_HOURS = Math.max(1, Number(process.env.GUEST_ROOM_TTL_HOURS) || 6);

async function runCleanup(io, roomState = {}) {
    if (health.db !== 'ready') return null;
    const active = [...(io?.sockets?.adapter?.rooms?.keys() || [])].filter((id) => !io.sockets.sockets.has(id));
    const rooms = await RoomRepository.deleteIdleGuestRooms(TTL_HOURS, active);
    for (const id of rooms) {
        for (const store of Object.values(roomState)) if (store) delete store[id];
    }
    const sessions = await sql`
        DELETE FROM sessions
        WHERE (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')
           OR last_active < NOW() - INTERVAL '90 days'
        RETURNING id
    `;
    let logs = [];
    try {
        logs = await sql`
            DELETE FROM analytics_logs a
            WHERE a.room_id IS NOT NULL AND a.created_at < NOW() - INTERVAL '30 days'
              AND NOT EXISTS (SELECT 1 FROM rooms r WHERE r.room_id = a.room_id)
            RETURNING 1
        `;
    } catch { /* analytics table optional */ }
    const result = { rooms: rooms.length, sessions: sessions.length, analytics: logs.length };
    if (result.rooms || result.sessions || result.analytics) console.log('Cleanup:', JSON.stringify(result));
    return result;
}

function startCleanupJob(io, roomState) {
    const run = () => runCleanup(io, roomState).catch((err) => console.error('Cleanup failed:', err.message));
    const first = setTimeout(run, 3 * 60 * 1000);
    const every = setInterval(run, HOUR);
    first.unref?.();
    every.unref?.();
    return { run };
}

module.exports = { startCleanupJob, runCleanup, TTL_HOURS };
