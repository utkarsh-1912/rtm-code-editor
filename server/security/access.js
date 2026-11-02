// Who is calling, and may they touch this? One place for the API's access rules.
//
//  attachUser          verifies the sign-in token (Authorization: Bearer <Firebase ID token>)
//                      once per request -> req.user = { uid, email } or null.
//  enforceClaimedUser  any request that names a user (userId / uid in the query or body) must be
//                      signed in as that user. Stops "pass someone else's id" attacks on every
//                      route that trusts a user id.
//  projectAccess       a project is open to its owner, people invited by email, and anyone
//                      holding its share link (a random key, not the guessable number).
//  orgRole / ownsSnippet  the same idea for teams and snippets.
const crypto = require('crypto');
const { sql } = require('../repositories/DatabaseClient');
const { verifyToken } = require('../services/Identity');

const bearer = (req) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');

async function attachUser(req, res, next) {
    try { req.user = (await verifyToken(bearer(req))) || null; } catch { req.user = null; }
    next();
}

const fail = (res, status, error, code) => res.status(status).json({ error, ...(code ? { code } : {}) });

function enforceClaimedUser(req, res, next) {
    const body = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : {};
    const claimed = [req.query?.userId, body.userId, body.uid].filter((v) => v !== undefined && v !== null && v !== '');
    if (!claimed.length) return next();
    if (!req.user) return fail(res, 401, 'Sign in again to continue.', 'SIGN_IN');
    if (claimed.some((v) => String(v) !== req.user.uid)) return fail(res, 403, "That isn't your account.", 'FORBIDDEN');
    next();
}

const requireUser = (req, res) => {
    if (req.user) return req.user;
    fail(res, 401, 'Sign in again to continue.', 'SIGN_IN');
    return null;
};

// --- Projects -------------------------------------------------------------------------------------
const newKey = () => crypto.randomBytes(18).toString('base64url');
const sameKey = (a, b) => {
    const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
    return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};

async function projectRow(projectId) {
    const id = Number.parseInt(projectId, 10);
    if (!Number.isInteger(id) || id <= 0) return null;
    const rows = await sql`
        SELECT p.id, p.name, p.share_key, u.auth_provider_id AS owner_uid
        FROM projects p LEFT JOIN users u ON u.id = p.user_id
        WHERE p.id = ${id}
    `;
    const p = rows[0];
    if (p && !p.share_key) {
        p.share_key = newKey();
        await sql`UPDATE projects SET share_key = ${p.share_key} WHERE id = ${p.id} AND share_key IS NULL`;
        p.share_key = (await sql`SELECT share_key FROM projects WHERE id = ${p.id}`)[0].share_key;
    }
    return p || null;
}

const isMember = async (projectId, email) => !!email && (await sql`SELECT 1 FROM project_members WHERE project_id = ${projectId} AND email = ${email.toLowerCase()}`).length > 0;
const addMember = (projectId, email) => (email ? sql`INSERT INTO project_members (project_id, email) VALUES (${projectId}, ${email.toLowerCase()}) ON CONFLICT DO NOTHING` : null);

/**
 * Checks the caller may use a project. `key` comes from the share link (X-Project-Key header).
 * Returns { project, owner } or null after sending 401/403/404. owner: the caller owns it.
 * { owner: true } in opts: only the owner may continue (delete, rename, invite).
 */
async function projectAccessFor({ user, key }, projectId, opts = {}) {
    const p = await projectRow(projectId);
    if (!p) return { status: 404, error: 'Project not found' };
    const owner = !!user && !!p.owner_uid && p.owner_uid === user.uid;
    if (opts.owner) return owner ? { project: p, owner } : { status: 403, error: 'Only the project owner can do that.' };
    if (owner) return { project: p, owner };
    if (user && await isMember(p.id, user.email)) return { project: p, owner };
    if (sameKey(key, p.share_key)) {
        // A signed-in person who opened the share link keeps access without it from now on.
        if (user?.email) await addMember(p.id, user.email);
        return { project: p, owner };
    }
    return user ? { status: 403, error: "You don't have access to this project. Ask its owner for an invite." } : { status: 401, error: 'Sign in to open this project.', code: 'SIGN_IN' };
}

async function projectAccess(req, res, projectId, opts) {
    const r = await projectAccessFor({ user: req.user, key: req.headers['x-project-key'] }, projectId, opts);
    if (r.status) { fail(res, r.status, r.error, r.code); return null; }
    return r;
}

// --- Teams & snippets -----------------------------------------------------------------------------
async function orgRole(uid, orgId) {
    const rows = await sql`
        SELECT om.role FROM organization_members om JOIN users u ON u.id = om.user_id
        WHERE om.org_id = ${Number(orgId) || 0} AND u.auth_provider_id = ${uid}
    `;
    return rows[0]?.role || null;
}

async function ownsSnippet(uid, snippetId) {
    const rows = await sql`
        SELECT 1 FROM snippets s JOIN users u ON u.id = s.user_id
        WHERE s.id = ${Number(snippetId) || 0} AND u.auth_provider_id = ${uid}
    `;
    return rows.length > 0;
}

// The site's developers (ADMIN_EMAILS="a@x.com,b@y.com").
const isAdmin = (user) => !!user?.email && String(process.env.ADMIN_EMAILS || '').toLowerCase().split(/[\s,]+/).includes(user.email.toLowerCase());

module.exports = { attachUser, enforceClaimedUser, requireUser, projectAccess, projectAccessFor, addMember, orgRole, ownsSnippet, isAdmin, fail };
