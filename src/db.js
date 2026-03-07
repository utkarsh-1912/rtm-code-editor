const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

/**
 * Initial Room Recovery or Creation
 */
async function getRoom(roomId) {
    const rooms = await sql`SELECT * FROM rooms WHERE room_id = ${roomId}`;
    return rooms[0] || null;
}

/**
 * Save or Update Room State
 */
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

/**
 * Update just the code
 */
async function updateRoomCode(roomId, code) {
    return await sql`
        UPDATE rooms 
        SET code = ${code}, updated_at = CURRENT_TIMESTAMP 
        WHERE room_id = ${roomId}
    `;
}

/**
 * Update just the chat
 */
async function updateRoomChat(roomId, chatHistory) {
    return await sql`
        UPDATE rooms 
        SET chat_history = ${JSON.stringify(chatHistory)}, updated_at = CURRENT_TIMESTAMP 
        WHERE room_id = ${roomId}
    `;
}

/**
 * Get Recent Rooms for a User
 */
async function getRecentRooms(userEmail) {
    // In a real scenario, we'd join with a user_rooms table.
    // For now, let's fetch recently updated rooms.
    return await sql`
        SELECT room_id, language, updated_at 
        FROM rooms 
        ORDER BY updated_at DESC 
        LIMIT 10
    `;
}

module.exports = {
    getRoom,
    saveRoom,
    updateRoomCode,
    updateRoomChat,
    getRecentRooms
};
