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

async function updateRoomChat(roomId, chatHistory) {
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
        INSERT INTO user_rooms (user_id, room_id)
        VALUES (${user[0].id}, ${room[0].id})
        ON CONFLICT (user_id, room_id) DO NOTHING
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
            SELECT r.room_id, r.name, r.language, r.updated_at
            FROM rooms r JOIN user_rooms ur ON r.id = ur.room_id
            WHERE ur.user_id = ${uid}
            ORDER BY r.updated_at DESC, r.id DESC
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
    updateRoomName,
    updateLastRoom,
    linkRoomToUser,
    unlinkRoomFromUser,
    isRoomGuest,
    deleteIdleGuestRooms,
    deleteRoomPermanently
};
