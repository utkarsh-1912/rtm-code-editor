const express = require('express');
const router = express.Router();
const AnalyticsRepository = require('../repositories/AnalyticsRepository');

// Get analytics stats
router.get('/analytics', async (req, res) => {
    try {
        const { roomId, projectId } = req.query;
        const analytics = await AnalyticsRepository.getWorkspaceAnalytics({ roomId, projectId });
        res.json(analytics);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Log custom activity event
router.post('/analytics/log', async (req, res) => {
    try {
        const { userId, roomId, projectId, actionType, metadata } = req.body;
        if (!actionType) return res.status(400).json({ error: "Missing actionType" });
        const log = await AnalyticsRepository.logActivity({ userId, roomId, projectId, actionType, metadata });
        res.json(log);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
