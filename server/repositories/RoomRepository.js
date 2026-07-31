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

async function updateRoomName(roomId, newName) {
    return await sql`
        UPDATE rooms 
        SET room_id = ${newName}, updated_at = CURRENT_TIMESTAMP 
        WHERE room_id = ${roomId}
        RETURNING *
    `;
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

async function isRoomGuest(roomId) {
    const res = await sql`SELECT COUNT(*) as count FROM user_rooms WHERE room_id = ${roomId}`;
    return parseInt(res[0].count, 10) === 0;
}

async function deleteRoomPermanently(roomId) {
    return await sql`DELETE FROM rooms WHERE room_id = ${roomId}`;
}

module.exports = {
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
    deleteRoomPermanently
};
