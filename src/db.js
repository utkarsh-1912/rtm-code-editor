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
 * Find or Create User from Firebase profile
 */
async function findOrCreateUser(firebaseUser) {
    const { uid, email, name } = firebaseUser;
    // Check if user exists
    const users = await sql`SELECT * FROM users WHERE auth_provider_id = ${uid}`;
    if (users.length > 0) return users[0];

    // Create new user
    const newUser = await sql`
        INSERT INTO users (email, name, auth_provider_id)
        VALUES (${email}, ${name}, ${uid})
        RETURNING *
    `;
    return newUser[0];
}

/**
 * Unlink a room from a user (Dashboard "Delete")
 */
async function unlinkRoomFromUser(userId, roomId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    const room = await sql`SELECT id FROM rooms WHERE room_id = ${roomId}`;

    if (user.length && room.length) {
        return await sql`
            DELETE FROM user_rooms 
            WHERE user_id = ${user[0].id} AND room_id = ${room[0].id}
        `;
    }
}

/**
 * Link a room to a user for persistence
 */
async function linkRoomToUser(userId, roomId) {
    // Get numeric IDs
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    const room = await sql`SELECT id FROM rooms WHERE room_id = ${roomId}`;

    if (user.length && room.length) {
        return await sql`
            INSERT INTO user_rooms (user_id, room_id)
            VALUES (${user[0].id}, ${room[0].id})
            ON CONFLICT DO NOTHING
        `;
    }
}

/**
 * Rename a room
 */
async function updateRoomName(roomId, newName) {
    return await sql`
        UPDATE rooms 
        SET name = ${newName}, updated_at = CURRENT_TIMESTAMP 
        WHERE room_id = ${roomId}
    `;
}

/**
 * Get full dashboard data for a user
 */
async function getUserDashboard(userId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return { rooms: [], stats: { totalRooms: 0, sessions: 0, hours: 0 } };

    const rooms = await sql`
        SELECT r.room_id, r.name, r.language, r.updated_at 
        FROM rooms r
        JOIN user_rooms ur ON r.id = ur.room_id
        WHERE ur.user_id = ${user[0].id}
        ORDER BY r.updated_at DESC
    `;

    // Mocking some stats for now, could be calculated from history
    const stats = {
        totalRooms: rooms.length,
        sessions: Math.ceil(rooms.length * 1.5),
        hours: Math.floor(rooms.length * 2.5)
    };

    return {
        rooms: rooms.map(r => ({
            id: r.room_id,
            name: r.name || r.room_id,
            lang: r.language,
            lastActive: new Date(r.updated_at).toLocaleString()
        })),
        stats,
        user: user[0]
    };
}

/**
 * Snippets Management
 */
async function getSnippets(userId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return [];

    return await sql`
        SELECT * FROM snippets 
        WHERE user_id = ${user[0].id} 
        ORDER BY updated_at DESC
    `;
}

async function createSnippet(userId, title, code, language) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) throw new Error("User not found");

    return await sql`
        INSERT INTO snippets (user_id, title, code, language)
        VALUES (${user[0].id}, ${title}, ${code}, ${language})
        RETURNING *
    `;
}

async function updateSnippet(snippetId, title, code, language) {
    return await sql`
        UPDATE snippets 
        SET title = ${title}, code = ${code}, language = ${language}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ${snippetId}
        RETURNING *
    `;
}

async function deleteSnippet(snippetId) {
    return await sql`DELETE FROM snippets WHERE id = ${snippetId}`;
}

/**
 * User Profile Management
 */
async function updateProfile(userId, { name, bio, social_links }) {
    return await sql`
        UPDATE users 
        SET name = ${name}, bio = ${bio}, social_links = ${JSON.stringify(social_links)}
        WHERE auth_provider_id = ${userId}
        RETURNING *
    `;
}

/**
 * Initialize Schema if tables don't exist
 */
async function initializeSchema() {
    try {
        console.log("Initializing database schema...");

        // Rooms Table
        await sql`
            CREATE TABLE IF NOT EXISTS rooms (
                id SERIAL PRIMARY KEY,
                room_id VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                code TEXT,
                language VARCHAR(50) DEFAULT 'javascript',
                chat_history JSONB DEFAULT '[]',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Users Table
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255),
                name VARCHAR(255),
                bio TEXT,
                social_links JSONB DEFAULT '{}',
                auth_provider_id VARCHAR(255) UNIQUE NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // User Rooms Mapping Table
        await sql`
            CREATE TABLE IF NOT EXISTS user_rooms (
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
                linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, room_id)
            )
        `;

        // Snippets Table
        await sql`
            CREATE TABLE IF NOT EXISTS snippets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                code TEXT,
                language VARCHAR(50) DEFAULT 'javascript',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        console.log("Database schema initialized successfully.");
    } catch (err) {
        console.error("Database Initialization Error:", err);
        throw err;
    }
}

module.exports = {
    initializeSchema,
    getRoom,
    saveRoom,
    updateRoomCode,
    updateRoomChat,
    findOrCreateUser,
    linkRoomToUser,
    unlinkRoomFromUser,
    updateRoomName,
    getUserDashboard,
    getSnippets,
    createSnippet,
    updateSnippet,
    deleteSnippet,
    updateProfile
};
