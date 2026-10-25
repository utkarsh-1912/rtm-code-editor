const { sql } = require('./DatabaseClient');

async function getRoom(roomId) {
    const rooms = await sql`SELECT * FROM rooms WHERE room_id = ${roomId}`;
    return rooms[0] || null;
}

async function saveRoom(roomId, code, language, chatHistory) {
    return await sql`
        INSERT INTO rooms (room_id, code, language, chat_history, updated_at)
        VALUES (${roomId}, ${code}, ${language}, ${JSON.stringify(chatHistory)}, CURRENT_TIMESTAMP)
        ON CONFLICT (room_id) 
        DO UPDATE SET 
            code = EXCLUDED.code, 
            language = EXCLUDED.language, 
            chat_history = EXCLUDED.chat_history,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *;
    `;
}

async function updateRoomCode(roomId, code) {
    return await sql`
        UPDATE rooms 
        SET code = ${code}, updated_at = CURRENT_TIMESTAMP 
        WHERE room_id = ${roomId}
    `;
}

async function updateRoomLanguage(roomId, language) {
    return await sql`
        UPDATE rooms 
        SET language = ${language}, updated_at = CURRENT_TIMESTAMP 
        WHERE room_id = ${roomId}
    `;
}

// Project chat uses the socket room "project-<id>" and is stored on the project row.
const projectIdOf = (roomId) => {
    const m = /^project-(\d+)$/.exec(String(roomId || ''));
    return m ? Number(m[1]) : null;
};

// Stored chat for a room or a project room; null when there is no row.
async function getChatHistory(roomId) {
    const projectId = projectIdOf(roomId);
    const rows = projectId
        ? await sql`SELECT chat_history FROM projects WHERE id = ${projectId}`
        : await sql`SELECT chat_history FROM rooms WHERE room_id = ${roomId}`;
    return rows.length ? (Array.isArray(rows[0].chat_history) ? rows[0].chat_history : []) : null;
}

async function updateRoomChat(roomId, chatHistory) {
    const projectId = projectIdOf(roomId);
    if (projectId) {
        return await sql`
            UPDATE projects
            SET chat_history = ${JSON.stringify(chatHistory)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${projectId}
        `;
    }
    return await sql`
        UPDATE rooms 
        SET chat_history = ${JSON.stringify(chatHistory)}, updated_at = CURRENT_TIMESTAMP 
        WHERE room_id = ${roomId}
    `;
}

// Rename changes only the display name. room_id is the room's address (its link) and
// must never change, or everyone with the link loses the room. Empty name = show the id.
async function updateRoomName(roomId, newName) {
    const name = String(newName || '').replace(/\s+/g, ' ').trim().slice(0, 80) || null;
    const rows = await sql`
        UPDATE rooms
        SET name = ${name}, updated_at = CURRENT_TIMESTAMP
        WHERE room_id = ${roomId}
        RETURNING room_id, name
    `;
    return rows[0] || null;
}

// --- Room access -------------------------------------------------------------------------
// public: anyone with the link. invite: people ask to join and the owner lets them in.
// private: only the owner and the emails on the room's invite list (signed in).
const VISIBILITY = new Set(['public', 'invite', 'private']);
const cleanEmails = (list) => [...new Set((Array.isArray(list) ? list : [])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200))].slice(0, 200);

async function getRoomAccess(roomId) {
    const rows = await sql`SELECT owner_uid, visibility, allowed_emails FROM rooms WHERE room_id = ${roomId}`;
    if (!rows.length) return null;
    const r = rows[0];
    return {
        ownerUid: r.owner_uid || null,
        visibility: VISIBILITY.has(r.visibility) ? r.visibility : 'public',
        allowed: Array.isArray(r.allowed_emails) ? r.allowed_emails : [],
    };
}

// The first signed-in person in a room without an owner becomes its owner.
async function claimRoomOwner(roomId, uid) {
    const rows = await sql`UPDATE rooms SET owner_uid = ${uid} WHERE room_id = ${roomId} AND owner_uid IS NULL RETURNING owner_uid`;
    return rows.length > 0;
}

// Only the owner can change access. Returns the new access, or null if not allowed.
async function setRoomAccess(roomId, ownerUid, { visibility, allowed }) {
    const vis = VISIBILITY.has(visibility) ? visibility : 'public';
    const emails = cleanEmails(allowed);
    const rows = await sql`
        UPDATE rooms SET visibility = ${vis}, allowed_emails = ${JSON.stringify(emails)}::jsonb
        WHERE room_id = ${roomId} AND owner_uid = ${ownerUid}
        RETURNING owner_uid, visibility, allowed_emails
    `;
    if (!rows.length) return null;
    return { ownerUid: rows[0].owner_uid, visibility: rows[0].visibility, allowed: rows[0].allowed_emails || [] };
}

async function updateLastRoom(userId, roomId) {
    return await sql`
        UPDATE users 
        SET last_room_id = ${roomId} 
        WHERE auth_provider_id = ${userId}
    `;
}

async function linkRoomToUser(userId, roomId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return null;
    const room = await sql`SELECT id FROM rooms WHERE room_id = ${roomId}`;
    if (!room.length) return null;

    return await sql`
        INSERT INTO user_rooms (user_id, room_id, last_opened_at)
        VALUES (${user[0].id}, ${room[0].id}, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, room_id) DO UPDATE SET last_opened_at = CURRENT_TIMESTAMP
        RETURNING *
    `;
}

async function unlinkRoomFromUser(userId, roomId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return null;
    const room = await sql`SELECT id FROM rooms WHERE room_id = ${roomId}`;
    const roomInternalId = room.length ? room[0].id : null;

    if (roomInternalId) {
        await sql`
            DELETE FROM user_rooms 
            WHERE user_id = ${user[0].id} AND room_id = ${roomInternalId}
        `;
    }

    await sql`
        UPDATE users 
        SET last_room_id = NULL 
        WHERE id = ${user[0].id} AND last_room_id = ${roomId}
    `;

    return true;
}

// A guest room is one no signed-in person has in their workspace.
// (user_rooms.room_id holds rooms.id, the numeric key, not the room's text id.)
async function isRoomGuest(roomId) {
    const res = await sql`
        SELECT COUNT(*)::int AS count FROM user_rooms ur JOIN rooms r ON r.id = ur.room_id
        WHERE r.room_id = ${roomId}
    `;
    return res[0].count === 0;
}

// Delete guest rooms idle for longer than `hours`, except rooms someone is in right now.
// Returns the deleted room ids.
async function deleteIdleGuestRooms(hours, activeRoomIds = []) {
    const rows = await sql`
        DELETE FROM rooms r
        WHERE r.updated_at < NOW() - make_interval(hours => ${hours})
          AND NOT EXISTS (SELECT 1 FROM user_rooms ur WHERE ur.room_id = r.id)
          AND NOT (r.room_id = ANY(${activeRoomIds}::text[]))
        RETURNING r.room_id
    `;
    return rows.map((r) => r.room_id);
}

async function deleteRoomPermanently(roomId) {
    return await sql`DELETE FROM rooms WHERE room_id = ${roomId}`;
}

// A user's rooms, newest first, one page at a time. id = the room's link (never changes).
async function getUserRoomsPage(userId, { limit, offset }) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return { items: [], total: 0, limit, offset };
    const uid = user[0].id;
    const [rows, count] = await Promise.all([
        sql`
            SELECT r.room_id, r.name, r.language,
                   GREATEST(r.updated_at, COALESCE(ur.last_opened_at, r.updated_at)) AS updated_at
            FROM rooms r JOIN user_rooms ur ON r.id = ur.room_id
            WHERE ur.user_id = ${uid}
            ORDER BY 4 DESC, r.id DESC
            LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int AS n FROM user_rooms WHERE user_id = ${uid}`,
    ]);
    return {
        items: rows.map((r) => ({ ...r, id: r.room_id, name: r.name || r.room_id, customName: !!r.name })),
        total: count[0].n,
        limit,
        offset,
    };
}

module.exports = {
    getUserRoomsPage,
    getRoom,
    saveRoom,
    updateRoomCode,
    updateRoomLanguage,
    updateRoomChat,
    getChatHistory,
    getRoomAccess,
    claimRoomOwner,
    setRoomAccess,
    updateRoomName,
    updateLastRoom,
    linkRoomToUser,
    unlinkRoomFromUser,
    isRoomGuest,
    deleteIdleGuestRooms,
    deleteRoomPermanently
};
