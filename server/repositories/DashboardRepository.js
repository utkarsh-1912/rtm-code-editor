const { sql } = require('./DatabaseClient');

async function getUserDashboard(userId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return { recentRooms: [], stats: { totalRooms: 0, totalSnippets: 0, totalOrgs: 0 } };

    const internalId = user[0].id;

    const recentRooms = await sql`
        SELECT r.room_id, r.language, r.updated_at, r.code 
        FROM rooms r
        JOIN user_rooms ur ON r.room_id = ur.room_id
        WHERE ur.user_id = ${internalId}
        ORDER BY r.updated_at DESC
        LIMIT 10
    `;

    const totalRooms = await sql`SELECT COUNT(*) FROM user_rooms WHERE user_id = ${internalId}`;
    const totalSnippets = await sql`SELECT COUNT(*) FROM snippets WHERE user_id = ${internalId}`;
    const totalOrgs = await sql`SELECT COUNT(*) FROM organization_members WHERE user_id = ${internalId}`;

    return {
        recentRooms,
        stats: {
            totalRooms: parseInt(totalRooms[0].count, 10),
            totalSnippets: parseInt(totalSnippets[0].count, 10),
            totalOrgs: parseInt(totalOrgs[0].count, 10)
        }
    };
}

async function searchAll(userId, query) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return { rooms: [], snippets: [], projects: [] };

    const internalId = user[0].id;
    const searchQuery = `%${query}%`;

    const rooms = await sql`
        SELECT r.room_id, r.language, r.updated_at 
        FROM rooms r
        JOIN user_rooms ur ON r.room_id = ur.room_id
        WHERE ur.user_id = ${internalId} AND r.room_id ILIKE ${searchQuery}
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
