const express = require('express');
const router = express.Router();
const NotificationRepository = require('../repositories/NotificationRepository');

// Get notifications
router.get('/notifications', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const notifications = await NotificationRepository.getNotifications(userId);
        res.json(notifications);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
    }
});

// Delete single notification
router.delete('/notifications/:id', async (req, res) => {
    try {
        await NotificationRepository.deleteNotification(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
