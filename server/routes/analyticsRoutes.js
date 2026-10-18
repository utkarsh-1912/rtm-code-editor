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

// Funnel events the browser may report. Server-side steps (ROOM_STARTED, SECOND_USER_JOINED,
// TRIAL_STARTED) are logged where they happen and cannot be sent from here.
const CLIENT_EVENTS = new Set(['CODE_RUN', 'UPGRADE_CLICKED']);
router.post('/analytics/event', async (req, res) => {
    try {
        const { type, userId, roomId, projectId, metadata } = req.body || {};
        if (!CLIENT_EVENTS.has(type)) return res.status(400).json({ error: 'Unknown event' });
        const safe = {};
        for (const k of ['language', 'ok', 'engine', 'source', 'interval']) if (metadata && metadata[k] !== undefined) safe[k] = String(metadata[k]).slice(0, 40);
        await AnalyticsRepository.logActivity({ userId: userId || null, roomId: roomId || null, projectId: projectId || null, actionType: type, metadata: safe });
        res.status(204).end();
    } catch (err) {
        res.status(204).end(); // tracking must never surface errors to people
    }
});

// Funnel report for the team: GET /api/analytics/funnel?days=30 with header x-admin-key.
router.get('/analytics/funnel', async (req, res) => {
    const key = process.env.ANALYTICS_ADMIN_KEY;
    if (!key || req.headers['x-admin-key'] !== key) return res.status(404).json({ error: 'Not found' });
    try {
        const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
        const steps = await AnalyticsRepository.getFunnel(days);
        const n = (k, f) => (steps[k] ? steps[k][f] : 0);
        const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
        res.json({
            days,
            steps,
            rates: {
                roomsWithSecondPerson: pct(n('SECOND_USER_JOINED', 'rooms'), n('ROOM_STARTED', 'rooms')),
                roomsThatRanCode: pct(n('CODE_RUN', 'rooms'), n('ROOM_STARTED', 'rooms')),
                upgradeClickToTrial: pct(n('TRIAL_STARTED', 'people'), n('UPGRADE_CLICKED', 'people')),
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not build the funnel' });
    }
});

module.exports = router;
