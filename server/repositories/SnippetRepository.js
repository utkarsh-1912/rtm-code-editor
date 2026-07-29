const { sql } = require('./DatabaseClient');

async function getSnippets(userId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return [];

    return await sql`
        SELECT * FROM snippets 
        WHERE user_id = ${user[0].id} 
        ORDER BY updated_at DESC
    `;
}

async function createSnippet(userId, title, code, language, tags = [], organizationId = null) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) throw new Error("User not found");

    return await sql`
        INSERT INTO snippets (user_id, organization_id, title, code, language, tags)
        VALUES (${user[0].id}, ${organizationId}, ${title}, ${code}, ${language}, ${JSON.stringify(tags)})
        RETURNING *
    `;
}

async function updateSnippet(snippetId, title, code, language, tags = []) {
    return await sql`
        UPDATE snippets
        SET title = ${title}, code = ${code}, language = ${language}, tags = ${JSON.stringify(tags)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${snippetId}
        RETURNING *
    `;
}

async function deleteSnippet(snippetId) {
    return await sql`DELETE FROM snippets WHERE id = ${snippetId}`;
}

module.exports = {
    getSnippets,
    createSnippet,
    updateSnippet,
    deleteSnippet
};
