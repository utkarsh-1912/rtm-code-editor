const { sql } = require('./DatabaseClient');

async function createOrganization(userId, name) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) throw new Error("User not found");

    const org = await sql`
        INSERT INTO organizations (name, owner_id)
        VALUES (${name}, ${user[0].id})
        RETURNING *
    `;

    await sql`
        INSERT INTO organization_members (org_id, user_id, role)
        VALUES (${org[0].id}, ${user[0].id}, 'owner')
    `;

    return org[0];
}

async function getOrganizations(userId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return [];

    return await sql`
        SELECT o.*, om.role 
        FROM organizations o
        JOIN organization_members om ON o.id = om.org_id
        WHERE om.user_id = ${user[0].id}
    `;
}

async function getOrgSnippets(orgId) {
    return await sql`
        SELECT s.*, u.name as author_name 
        FROM snippets s
        JOIN users u ON s.user_id = u.id
        WHERE s.organization_id = ${orgId}
        ORDER BY s.created_at DESC
    `;
}

async function addOrgMember(orgId, email, role = 'member') {
    const user = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (!user.length) throw new Error("User with this email not found");

    return await sql`
        INSERT INTO organization_members (org_id, user_id, role)
        VALUES (${orgId}, ${user[0].id}, ${role})
        ON CONFLICT (org_id, user_id) 
        DO UPDATE SET role = EXCLUDED.role
        RETURNING *
    `;
}

async function getOrgMembers(orgId) {
    return await sql`
        SELECT u.id, u.name, u.email, om.role, om.joined_at
        FROM organization_members om
        JOIN users u ON om.user_id = u.id
        WHERE om.org_id = ${orgId}
    `;
}

async function deleteOrganization(orgId) {
    return await sql`DELETE FROM organizations WHERE id = ${orgId}`;
}

module.exports = {
    createOrganization,
    getOrganizations,
    getOrgSnippets,
    addOrgMember,
    getOrgMembers,
    deleteOrganization
};
