const { sql } = require('./DatabaseClient');

/**
 * Get user profile by Auth Provider ID
 */
async function getUser(userId) {
    const users = await sql`SELECT * FROM users WHERE auth_provider_id = ${userId}`;
    return users[0] || null;
}

/**
 * Create the user or refresh their identity. Fixes rows auto-created by a session
 * call (placeholder email, name "Developer") once the real profile arrives.
 */
async function findOrCreateUser(firebaseUser) {
    const { uid } = firebaseUser;
    const email = firebaseUser.email || `${uid}@user.local`;
    const name = firebaseUser.name || firebaseUser.displayName || email.split('@')[0];
    const photo = typeof firebaseUser.photoURL === 'string' && /^https:\/\//.test(firebaseUser.photoURL) ? firebaseUser.photoURL.slice(0, 500) : null;
    const rows = await sql`
        INSERT INTO users (email, name, auth_provider_id, photo_url)
        VALUES (${email}, ${name}, ${uid}, ${photo})
        ON CONFLICT (auth_provider_id) DO UPDATE SET
            email = CASE WHEN users.email LIKE '%@user.local' THEN EXCLUDED.email ELSE users.email END,
            name = CASE WHEN users.name IS NULL OR users.name = '' OR users.name = 'Developer' THEN EXCLUDED.name ELSE users.name END,
            photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url)
        RETURNING *
    `;
    return rows[0];
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
    // Make sure the row exists (a profile can be saved before any room was joined).
    await sql`
        INSERT INTO users (email, name, auth_provider_id)
        VALUES (${`${userId}@user.local`}, ${name || 'Developer'}, ${userId})
        ON CONFLICT (auth_provider_id) DO NOTHING
    `;
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
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return [];
    return await sql`
        SELECT * FROM sessions 
        WHERE user_id = ${user[0].id}
        ORDER BY last_active DESC
    `;
}

async function createSession(userId, { device, ip, userAgent, sessionId }) {
    let user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    let internalUserId;
    if (!user.length) {
        // Auto-provision user record if not present
        const newUser = await sql`
            INSERT INTO users (email, name, auth_provider_id)
            VALUES (${userId + '@user.local'}, 'Developer', ${userId})
            ON CONFLICT (auth_provider_id) DO NOTHING
            RETURNING id
        `;
        if (newUser.length) {
            internalUserId = newUser[0].id;
        } else {
            const fetched = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
            internalUserId = fetched[0]?.id;
        }
    } else {
        internalUserId = user[0].id;
    }

    if (!internalUserId) throw new Error("User record unavailable");

    if (sessionId) {
        const existing = await sql`
            UPDATE sessions 
            SET last_active = CURRENT_TIMESTAMP, ip = ${ip}, device = ${device}, user_agent = ${userAgent}
            WHERE session_id = ${sessionId}
            RETURNING *
        `;
        if (existing.length > 0) return existing;
    }

    const newSessionId = (sessionId && typeof sessionId === 'string' && sessionId.length > 5) 
        ? sessionId 
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    return await sql`
        INSERT INTO sessions (user_id, device, ip, user_agent, session_id)
        VALUES (${internalUserId}, ${device}, ${ip}, ${userAgent}, ${newSessionId})
        RETURNING *
    `;
}

async function deleteOtherSessions(userId, currentSessionId) {
    if (!currentSessionId) return [];
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return [];
    return await sql`
        DELETE FROM sessions 
        WHERE user_id = ${user[0].id} AND session_id != ${currentSessionId}
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
