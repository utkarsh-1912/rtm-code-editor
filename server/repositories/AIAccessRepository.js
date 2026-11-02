const { sql } = require('./DatabaseClient');

// Who asked for which platform model, and what the developer decided.
async function requestAccess({ uid, email, name, modelId, note }) {
    const rows = await sql`
        INSERT INTO ai_access (uid, email, name, model_id, note, status)
        VALUES (${uid}, ${email || null}, ${name || null}, ${modelId}, ${note || ''}, 'pending')
        ON CONFLICT (uid, model_id) DO UPDATE
            SET note = EXCLUDED.note, email = EXCLUDED.email, name = EXCLUDED.name,
                status = CASE WHEN ai_access.status = 'approved' THEN 'approved' ELSE 'pending' END,
                created_at = CASE WHEN ai_access.status = 'approved' THEN ai_access.created_at ELSE CURRENT_TIMESTAMP END,
                decided_at = CASE WHEN ai_access.status = 'approved' THEN ai_access.decided_at ELSE NULL END
        RETURNING *
    `;
    return rows[0];
}

async function forUser(uid) {
    return await sql`SELECT model_id, status FROM ai_access WHERE uid = ${uid}`;
}

async function isApproved(uid, modelId) {
    const rows = await sql`SELECT 1 FROM ai_access WHERE uid = ${uid} AND model_id = ${modelId} AND status = 'approved'`;
    return rows.length > 0;
}

async function list(status = 'pending') {
    return status === 'all'
        ? await sql`SELECT * FROM ai_access ORDER BY created_at DESC LIMIT 200`
        : await sql`SELECT * FROM ai_access WHERE status = ${status} ORDER BY created_at ASC LIMIT 200`;
}

async function decide(id, status) {
    const rows = await sql`
        UPDATE ai_access SET status = ${status}, decided_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
    `;
    return rows[0] || null;
}

module.exports = { requestAccess, forUser, isApproved, list, decide };
