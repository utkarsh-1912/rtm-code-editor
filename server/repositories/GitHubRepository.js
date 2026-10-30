const crypto = require('crypto');
const { sql } = require('./DatabaseClient');

// GitHub OAuth tokens are stored encrypted (AES-256-GCM). The key comes from
// GITHUB_TOKEN_ENCRYPTION_KEY; any string works, it is hashed to 32 bytes.
function tokenKey() {
    const secret = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
    if (!secret) throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY is not set');
    return crypto.createHash('sha256').update(secret).digest();
}

// "v1.<iv>.<tag>.<ciphertext>", each part base64url.
function encryptToken(token) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
    const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

function decryptToken(stored) {
    const [version, iv, tag, data] = String(stored || '').split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unreadable GitHub token');
    const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

async function userIdFor(uid) {
    const rows = await sql`SELECT id FROM users WHERE auth_provider_id = ${uid}`;
    return rows[0] ? rows[0].id : null;
}

async function saveConnection(uid, { login, token, scopes }) {
    const userId = await userIdFor(uid);
    if (!userId) throw new Error('Account not found');
    const enc = encryptToken(token);
    await sql`
        INSERT INTO github_connections (user_id, gh_login, token_encrypted, scopes, created_at)
        VALUES (${userId}, ${login}, ${enc}, ${scopes || ''}, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET gh_login = EXCLUDED.gh_login, token_encrypted = EXCLUDED.token_encrypted,
                      scopes = EXCLUDED.scopes, created_at = CURRENT_TIMESTAMP
    `;
}

// { login, scopes, createdAt, token } or null. The token never leaves the server.
async function getConnection(uid) {
    const rows = await sql`
        SELECT g.* FROM github_connections g JOIN users u ON u.id = g.user_id
        WHERE u.auth_provider_id = ${uid}
    `;
    const row = rows[0];
    if (!row) return null;
    return { userId: row.user_id, login: row.gh_login, scopes: row.scopes, createdAt: row.created_at, token: decryptToken(row.token_encrypted) };
}

async function deleteConnection(uid) {
    const userId = await userIdFor(uid);
    if (!userId) return;
    await sql`DELETE FROM github_connections WHERE user_id = ${userId}`;
}

async function getLink(projectId) {
    const rows = await sql`SELECT * FROM github_links WHERE project_id = ${projectId}`;
    return rows[0] || null;
}

async function saveLink(projectId, { owner, repo, branch, path, baseSha, skipped = [], userId }) {
    const rows = await sql`
        INSERT INTO github_links (project_id, owner, repo, branch, path, base_sha, skipped, linked_by, updated_at)
        VALUES (${projectId}, ${owner}, ${repo}, ${branch}, ${path || ''}, ${baseSha}, ${JSON.stringify(skipped)}::jsonb, ${userId || null}, CURRENT_TIMESTAMP)
        ON CONFLICT (project_id)
        DO UPDATE SET owner = EXCLUDED.owner, repo = EXCLUDED.repo, branch = EXCLUDED.branch, path = EXCLUDED.path,
                      base_sha = EXCLUDED.base_sha, skipped = EXCLUDED.skipped, linked_by = EXCLUDED.linked_by, updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `;
    return rows[0];
}

// Move the agreed commit forward; `skipped` replaces the list when given.
async function setLinkBase(projectId, baseSha, skipped) {
    const rows = skipped
        ? await sql`UPDATE github_links SET base_sha = ${baseSha}, skipped = ${JSON.stringify(skipped)}::jsonb, updated_at = CURRENT_TIMESTAMP WHERE project_id = ${projectId} RETURNING *`
        : await sql`UPDATE github_links SET base_sha = ${baseSha}, updated_at = CURRENT_TIMESTAMP WHERE project_id = ${projectId} RETURNING *`;
    return rows[0] || null;
}

async function deleteLink(projectId) {
    await sql`DELETE FROM github_links WHERE project_id = ${projectId}`;
}

module.exports = {
    encryptToken,
    decryptToken,
    saveConnection,
    getConnection,
    deleteConnection,
    getLink,
    saveLink,
    setLinkBase,
    deleteLink,
};
