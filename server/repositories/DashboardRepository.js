const { sql } = require('./DatabaseClient');

async function getUserDashboard(userId) {
    const user = await sql`SELECT id, COALESCE(pairing_seconds, 0) AS pairing_seconds FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return { recentRooms: [], rooms: [], stats: { totalRooms: 0, totalSnippets: 0, totalOrgs: 0, pairingSeconds: 0, hours: 0 } };

    const internalId = user[0].id;

    const recentRooms = await sql`
        SELECT r.id as internal_id, r.room_id, r.name, r.language, r.updated_at, r.code
        FROM rooms r
        JOIN user_rooms ur ON r.id = ur.room_id
        WHERE ur.user_id = ${internalId}
        ORDER BY r.updated_at DESC
        LIMIT 10
    `;

    const totalRooms = await sql`SELECT COUNT(*) FROM user_rooms WHERE user_id = ${internalId}`;
    const totalSnippets = await sql`SELECT COUNT(*) FROM snippets WHERE user_id = ${internalId}`;
    const totalOrgs = await sql`SELECT COUNT(*) FROM organization_members WHERE user_id = ${internalId}`;

    // id = the room's address (never changes); name = what people call it.
    const formattedRooms = recentRooms.map(r => ({
        ...r,
        id: r.room_id,
        name: r.name || r.room_id,
        customName: !!r.name,
    }));

    return {
        recentRooms: formattedRooms,
        rooms: formattedRooms,
        stats: {
            totalRooms: parseInt(totalRooms[0]?.count || 0, 10),
            totalSnippets: parseInt(totalSnippets[0]?.count || 0, 10),
            totalOrgs: parseInt(totalOrgs[0]?.count || 0, 10),
            pairingSeconds: Number(user[0].pairing_seconds) || 0,
            hours: Math.round(((Number(user[0].pairing_seconds) || 0) / 3600) * 10) / 10,
        }
    };
}

// Search everything a person can open: rooms, projects, files in their projects, snippets
// and meetings. Matches anywhere (case-insensitive); names that start with the query first.
async function searchAll(userId, query) {
    const empty = { rooms: [], projects: [], files: [], snippets: [], meetings: [] };
    const q = String(query || '').trim().slice(0, 100);
    if (!q) return empty;
    const user = await sql`SELECT id, email FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return empty;
    const uid = user[0].id;
    const email = String(user[0].email || '').toLowerCase();
    // LIKE patterns: the query's own % and _ are literal.
    const lit = q.replace(/[\\%_]/g, (c) => `\\${c}`);
    const any = `%${lit}%`;
    const start = `${lit}%`;

    const [rooms, projects, files, snippets, meetings] = await Promise.all([
        sql`
            SELECT r.room_id, r.name, r.language, GREATEST(r.updated_at, COALESCE(ur.last_opened_at, r.updated_at)) AS updated_at
            FROM rooms r JOIN user_rooms ur ON r.id = ur.room_id
            WHERE ur.user_id = ${uid} AND (r.room_id ILIKE ${any} OR r.name ILIKE ${any})
            ORDER BY (COALESCE(r.name, r.room_id) ILIKE ${start}) DESC, 4 DESC
            LIMIT 6`,
        sql`
            SELECT id, name, description, type, updated_at FROM projects
            WHERE user_id = ${uid} AND (name ILIKE ${any} OR description ILIKE ${any})
            ORDER BY (name ILIKE ${start}) DESC, updated_at DESC
            LIMIT 6`,
        sql`
            SELECT f.id, f.path, f.project_id, p.name AS project_name FROM project_files f JOIN projects p ON p.id = f.project_id
            WHERE p.user_id = ${uid} AND f.is_directory = FALSE AND f.path ILIKE ${any}
            ORDER BY (regexp_replace(f.path, '^.*/', '') ILIKE ${start}) DESC, f.updated_at DESC
            LIMIT 8`,
        sql`
            SELECT id, title, language, tags, updated_at,
                   (SELECT line FROM regexp_split_to_table(code, E'\\n') AS line WHERE line ILIKE ${any} LIMIT 1) AS match_line
            FROM snippets
            WHERE user_id = ${uid} AND (title ILIKE ${any} OR code ILIKE ${any} OR COALESCE(tags::text, '') ILIKE ${any})
            ORDER BY (title ILIKE ${start}) DESC, updated_at DESC
            LIMIT 6`,
        sql`
            SELECT id, title, starts_at, duration_min, room_id FROM meetings
            WHERE cancelled_at IS NULL AND title ILIKE ${any}
              AND (host_uid = ${userId} OR (${email} <> '' AND invitees ? ${email}))
            ORDER BY starts_at DESC
            LIMIT 5`.catch(() => []),
    ]);
    return { rooms, projects, files, snippets, meetings };
}

module.exports = {
    getUserDashboard,
    searchAll
};
