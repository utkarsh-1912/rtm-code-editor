const { sql } = require('./DatabaseClient');

/**
 * Get user profile by Auth Provider ID
 */
async function getUser(userId) {
    const users = await sql`SELECT * FROM users WHERE auth_provider_id = ${userId}`;
    return users[0] || null;
}

/**
 * Find or Create User from Firebase profile
 */
async function findOrCreateUser(firebaseUser) {
    const { uid, email, name } = firebaseUser;
    const users = await sql`SELECT * FROM users WHERE auth_provider_id = ${uid}`;
    if (users.length > 0) return users[0];

    const newUser = await sql`
        INSERT INTO users (email, name, auth_provider_id)
        VALUES (${email}, ${name}, ${uid})
        RETURNING *
    `;
    return newUser[0];
}

/**
 * Subscription Management
 */
async function unsubscribeUser(email, unsubscribed = true) {
    return await sql`
        UPDATE users 
        SET is_unsubscribed = ${unsubscribed} 
        WHERE email = ${email}
    `;
}

async function isUserUnsubscribed(email) {
    const res = await sql`SELECT is_unsubscribed FROM users WHERE email = ${email}`;
    return res.length > 0 ? res[0].is_unsubscribed : false;
}

/**
 * Profile updates
 */
async function updateProfile(userId, { name, bio, social_links }) {
    const updated = await sql`
        UPDATE users
        SET 
            name = COALESCE(${name}, name),
            bio = COALESCE(${bio}, bio),
            social_links = COALESCE(${social_links ? JSON.stringify(social_links) : null}::jsonb, social_links)
        WHERE auth_provider_id = ${userId}
        RETURNING *
    `;
    return updated[0];
}

/**
 * Active session tracking
 */
async function getSessions(userId) {
    return await sql`
        SELECT * FROM sessions 
        WHERE user_id = ${userId} 
        ORDER BY last_active DESC
    `;
}

async function createSession(userId, { device, ip, userAgent, sessionId }) {
    if (sessionId) {
        const existing = await sql`
            UPDATE sessions 
            SET last_active = CURRENT_TIMESTAMP, ip = ${ip}, device = ${device}, user_agent = ${userAgent}
            WHERE session_id = ${sessionId} AND user_id = ${userId}
            RETURNING *
        `;
        if (existing.length > 0) return existing;
    }

    return await sql`
        INSERT INTO sessions (user_id, device, ip, user_agent, session_id)
        VALUES (${userId}, ${device}, ${ip}, ${userAgent}, ${sessionId || Math.random().toString(36).substring(2, 15)})
        RETURNING *
    `;
}

async function deleteOtherSessions(userId, currentSessionId) {
    if (!currentSessionId) return [];
    return await sql`
        DELETE FROM sessions 
        WHERE user_id = ${userId} AND session_id != ${currentSessionId}
        RETURNING *
    `;
}

/**
 * Account deletion
 */
async function deleteAccount(userId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return null;
    const internalId = user[0].id;

    await sql`DELETE FROM users WHERE id = ${internalId}`;
    return true;
}

module.exports = {
    getUser,
    findOrCreateUser,
    unsubscribeUser,
    isUserUnsubscribed,
    updateProfile,
    getSessions,
    createSession,
    deleteOtherSessions,
    deleteAccount
};
