const { sql } = require('./DatabaseClient');

/**
 * Get user profile by Auth Provider ID
 */
async function getUser(userId) {
    const users = await sql`SELECT * FROM users WHERE auth_provider_id = ${userId}`;
    return users[0] || null;
}

async function getUserByEmail(email) {
    const users = await sql`SELECT * FROM users WHERE lower(email) = lower(${email})`;
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
const internalIdFor = async (userId) => (await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`)[0]?.id || null;

// Signed-in devices, newest first. currentKey marks the caller's own device; session keys
// of other devices are never returned. Revoked and long-idle (90 days) devices are hidden.
async function getSessions(userId, currentKey = null) {
    const uid = await internalIdFor(userId);
    if (!uid) return [];
    const rows = await sql`
        SELECT id, device, name, ip, user_agent, created_at, last_active, session_id
        FROM sessions
        WHERE user_id = ${String(uid)} AND revoked_at IS NULL
          AND last_active > CURRENT_TIMESTAMP - INTERVAL '90 days'
        ORDER BY last_active DESC
    `;
    return rows.map(({ session_id: key, ...row }) => ({ ...row, current: !!currentKey && key === currentKey }));
}

// Check-in from a device (sign-in, app start, focus). The device keeps a random key; the
// first check-in creates its row, later ones refresh it. A revoked key reports revoked so
// that device signs out.
async function createSession(userId, { device, ip, userAgent, sessionId }) {
    let uid = await internalIdFor(userId);
    if (!uid) {
        // Auto-provision user record if not present
        await sql`
            INSERT INTO users (email, name, auth_provider_id)
            VALUES (${userId + '@user.local'}, 'Developer', ${userId})
            ON CONFLICT (auth_provider_id) DO NOTHING
        `;
        uid = await internalIdFor(userId);
    }
    if (!uid) throw new Error("User record unavailable");

    const key = typeof sessionId === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(sessionId) ? sessionId : null;
    if (!key) throw new Error("Invalid session key");

    const existing = await sql`SELECT id, user_id, revoked_at FROM sessions WHERE session_id = ${key}`;
    if (existing.length) {
        const row = existing[0];
        if (String(row.user_id) !== String(uid) || row.revoked_at) return { id: row.id, revoked: true };
        const updated = await sql`
            UPDATE sessions
            SET last_active = CURRENT_TIMESTAMP, ip = ${ip}, device = ${device}, user_agent = ${userAgent}
            WHERE id = ${row.id}
            RETURNING id, device, name, ip, last_active
        `;
        return { ...updated[0], revoked: false };
    }
    const created = await sql`
        INSERT INTO sessions (user_id, device, ip, user_agent, session_id)
        VALUES (${String(uid)}, ${device}, ${ip}, ${userAgent}, ${key})
        RETURNING id, device, name, ip, last_active
    `;
    return { ...created[0], revoked: false };
}

// Rename one of the user's devices. Empty name = back to the detected device name.
async function renameSession(userId, id, name) {
    const uid = await internalIdFor(userId);
    if (!uid) return null;
    const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80) || null;
    const rows = await sql`
        UPDATE sessions SET name = ${clean}
        WHERE id = ${id} AND user_id = ${String(uid)} AND revoked_at IS NULL
        RETURNING id, device, name, ip, last_active
    `;
    return rows[0] || null;
}

// Sign out one device (it signs itself out on its next check-in).
async function revokeSession(userId, id) {
    const uid = await internalIdFor(userId);
    if (!uid) return false;
    const rows = await sql`
        UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND user_id = ${String(uid)} AND revoked_at IS NULL
        RETURNING id
    `;
    return rows.length > 0;
}

// Sign out every device except the caller's.
async function deleteOtherSessions(userId, currentKey) {
    if (!currentKey) return [];
    const uid = await internalIdFor(userId);
    if (!uid) return [];
    return await sql`
        UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = ${String(uid)} AND session_id IS DISTINCT FROM ${currentKey} AND revoked_at IS NULL
        RETURNING id
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

// Add time spent in a room with at least one other person.
async function addPairingSeconds(userId, seconds) {
    await sql`UPDATE users SET pairing_seconds = COALESCE(pairing_seconds, 0) + ${seconds} WHERE auth_provider_id = ${userId}`;
}

module.exports = {
    addPairingSeconds,
    getUser,
    getUserByEmail,
    findOrCreateUser,
    unsubscribeUser,
    isUserUnsubscribed,
    updateProfile,
    getSessions,
    createSession,
    deleteOtherSessions,
    renameSession,
    revokeSession,
    deleteAccount
};
