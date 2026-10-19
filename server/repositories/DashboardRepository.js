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

async function searchAll(userId, query) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return { rooms: [], snippets: [], projects: [] };

    const internalId = user[0].id;
    const searchQuery = `%${query}%`;

    const rooms = await sql`
        SELECT r.room_id, r.name, r.language, r.updated_at
        FROM rooms r
        JOIN user_rooms ur ON r.id = ur.room_id
        WHERE ur.user_id = ${internalId} AND (r.room_id ILIKE ${searchQuery} OR r.name ILIKE ${searchQuery})
        LIMIT 5
    `;

    const snippets = await sql`
        SELECT id, title, language, updated_at 
        FROM snippets 
        WHERE user_id = ${internalId} AND (title ILIKE ${searchQuery} OR code ILIKE ${searchQuery})
        LIMIT 5
    `;

    const projects = await sql`
        SELECT id, name, description, type, updated_at 
        FROM projects 
        WHERE user_id = ${internalId} AND (name ILIKE ${searchQuery} OR description ILIKE ${searchQuery})
        LIMIT 5
    `;

    return { rooms, snippets, projects };
}

module.exports = {
    getUserDashboard,
    searchAll
};
