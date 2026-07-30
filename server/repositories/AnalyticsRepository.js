const { sql } = require('./DatabaseClient');

async function logActivity({ userId = null, roomId = null, projectId = null, actionType, metadata = {} }) {
    return await sql`
        INSERT INTO analytics_logs (user_id, room_id, project_id, action_type, metadata)
        VALUES (${userId}, ${roomId}, ${projectId}, ${actionType}, ${JSON.stringify(metadata)})
        RETURNING *
    `;
}

async function getWorkspaceAnalytics({ roomId = null, projectId = null }) {
    let logs = [];
    if (projectId) {
        logs = await sql`
            SELECT * FROM analytics_logs 
            WHERE project_id = ${projectId} 
            ORDER BY created_at DESC 
            LIMIT 100
        `;
    } else if (roomId) {
        logs = await sql`
            SELECT * FROM analytics_logs 
            WHERE room_id = ${roomId} 
            ORDER BY created_at DESC 
            LIMIT 100
        `;
    }

    const editCount = logs.filter(l => l.action_type === 'EDIT' || l.action_type === 'FILE_CHANGE').length;
    const compileCount = logs.filter(l => l.action_type === 'COMPILE' || l.action_type === 'EXECUTE').length;
    const chatCount = logs.filter(l => l.action_type === 'CHAT').length;
    const aiCount = logs.filter(l => l.action_type === 'AI_PROMPT').length;

    return {
        logs,
        summary: {
            totalActions: logs.length,
            edits: editCount,
            executions: compileCount,
            chatMessages: chatCount,
            aiInteractions: aiCount
        }
    };
}

module.exports = {
    logActivity,
    getWorkspaceAnalytics
};
