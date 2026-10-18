const express = require('express');
const router = express.Router();
const AICopilotService = require('../services/AICopilotService');
const AnalyticsRepository = require('../repositories/AnalyticsRepository');

// AI copilot: the client builds the prompt; the server forwards it to its model.
router.post('/copilot', async (req, res) => {
    try {
        const { action, messages, language, roomId, projectId, userId } = req.body || {};
        const { text, model } = await AICopilotService.complete({ messages });

        if (roomId || projectId) {
            AnalyticsRepository.logActivity({
                userId,
                roomId,
                projectId,
                actionType: 'AI_PROMPT',
                metadata: { action, language, model }
            }).catch(() => { });
        }

        res.json({ success: true, text, model });
    } catch (err) {
        console.error("AI Copilot Error:", err.message);
        res.status(err.status || 500).json({ success: false, error: err.message });
    }
});

module.exports = router;
