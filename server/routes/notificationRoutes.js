const express = require('express');
const router = express.Router();
const NotificationRepository = require('../repositories/NotificationRepository');
const OneSignal = require('../services/OneSignalService');

// Get notifications
router.get('/notifications', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const notifications = await NotificationRepository.getNotifications(userId);
        res.json(notifications);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// Mark all as read
router.put('/notifications/read', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const read = await NotificationRepository.markNotificationsRead(userId);
        res.json(read);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// Clear all notifications
router.delete('/notifications', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        await NotificationRepository.clearNotifications(userId);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// Delete single notification
router.delete('/notifications/:id', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Sign in again to continue.' });
        await NotificationRepository.deleteNotification(req.params.id, req.user.uid);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// Send a test push to the signed-in user (Settings > Notifications).
router.post('/notifications/test', async (req, res) => {
    try {
        const { userId } = req.body || {};
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        if (!OneSignal.configured()) return res.status(503).json({ error: "Push is not configured on the server" });
        const r = await OneSignal.pushToUser(userId, { message: "Push notifications are working.", url: process.env.APP_URL });
        if (!r.ok) return res.status(502).json({ error: r.reason || "Push was not delivered (is this device subscribed?)" });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

module.exports = router;
