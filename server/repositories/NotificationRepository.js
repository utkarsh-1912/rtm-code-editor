const { sql } = require('./DatabaseClient');
const OneSignal = require('../services/OneSignalService');

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

// Store an in-app notification and push it to the user's devices (best effort).
async function notifyUser(userId, { type, message, url, data = {} }) {
    const rows = await createNotification(userId, type, message, data);
    OneSignal.pushToUser(userId, { message, url, data: { type, ...data } })
        .then((r) => { if (!r.ok && r.reason !== "OneSignal is not configured") console.warn("Push not sent:", r.reason); });
    return rows;
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
    notifyUser,
    markNotificationsRead,
    clearNotifications,
    deleteNotification
};
