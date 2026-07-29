const { sql } = require('./DatabaseClient');

async function getNotifications(userId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return [];

    return await sql`
        SELECT * FROM notifications 
        WHERE user_id = ${user[0].id} 
        ORDER BY created_at DESC 
        LIMIT 50
    `;
}

async function createNotification(userId, type, message, data = {}) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return null;

    return await sql`
        INSERT INTO notifications (user_id, type, message, data)
        VALUES (${user[0].id}, ${type}, ${message}, ${JSON.stringify(data)})
        RETURNING *
    `;
}

async function markNotificationsRead(userId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return [];

    return await sql`
        UPDATE notifications 
        SET read = TRUE 
        WHERE user_id = ${user[0].id} AND read = FALSE
        RETURNING *
    `;
}

async function clearNotifications(userId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return [];

    return await sql`DELETE FROM notifications WHERE user_id = ${user[0].id}`;
}

async function deleteNotification(notificationId) {
    return await sql`DELETE FROM notifications WHERE id = ${notificationId}`;
}

module.exports = {
    getNotifications,
    createNotification,
    markNotificationsRead,
    clearNotifications,
    deleteNotification
};
