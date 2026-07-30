const express = require('express');
const router = express.Router();
const AICopilotService = require('../services/AICopilotService');
const AnalyticsRepository = require('../repositories/AnalyticsRepository');

// AI Copilot endpoint
router.post('/copilot', async (req, res) => {
    try {
        const { action, code, language, prompt, error, roomId, projectId, userId } = req.body;
        const result = await AICopilotService.processCopilotRequest({ action, code, language, prompt, error });

        // Log AI action in analytics
        if (roomId || projectId) {
            AnalyticsRepository.logActivity({
                userId,
                roomId,
                projectId,
                actionType: 'AI_PROMPT',
                metadata: { action, language }
            }).catch(() => { });
        }

        res.json({ success: true, result });
    } catch (err) {
        console.error("AI Copilot Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
