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

// Funnel counts for the marketing dashboard: distinct rooms or people per step.
async function getFunnel(days = 30) {
    const rows = await sql`
        SELECT action_type,
               COUNT(*)::int AS events,
               COUNT(DISTINCT room_id)::int AS rooms,
               COUNT(DISTINCT user_id)::int AS people
        FROM analytics_logs
        WHERE action_type IN ('ROOM_STARTED', 'SECOND_USER_JOINED', 'CODE_RUN', 'UPGRADE_CLICKED', 'TRIAL_STARTED')
          AND created_at >= now() - (${days}::int * interval '1 day')
        GROUP BY action_type
    `;
    return Object.fromEntries(rows.map((r) => [r.action_type, { events: r.events, rooms: r.rooms, people: r.people }]));
}

module.exports = {
    getFunnel,
    logActivity,
    getWorkspaceAnalytics
};
