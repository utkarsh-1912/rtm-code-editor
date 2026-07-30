const { sql } = require('./DatabaseClient');

async function createSnapshot({ projectId = null, roomId = null, name, code = "", files = [], createdBy = "User" }) {
    const res = await sql`
        INSERT INTO snapshots (project_id, room_id, name, code, files_snapshot, created_by)
        VALUES (${projectId}, ${roomId}, ${name}, ${code}, ${JSON.stringify(files)}, ${createdBy})
        RETURNING *
    `;
    return res[0];
}

async function getSnapshots({ projectId = null, roomId = null }) {
    if (projectId) {
        return await sql`
            SELECT * FROM snapshots 
            WHERE project_id = ${projectId} 
            ORDER BY created_at DESC
        `;
    }
    if (roomId) {
        return await sql`
            SELECT * FROM snapshots 
            WHERE room_id = ${roomId} 
            ORDER BY created_at DESC
        `;
    }
    return [];
}

async function getSnapshotById(snapshotId) {
    const res = await sql`SELECT * FROM snapshots WHERE id = ${snapshotId}`;
    return res[0] || null;
}

async function deleteSnapshot(snapshotId) {
    return await sql`DELETE FROM snapshots WHERE id = ${snapshotId}`;
}

module.exports = {
    createSnapshot,
    getSnapshots,
    getSnapshotById,
    deleteSnapshot
};
