const express = require('express');
const router = express.Router();
const AICopilotService = require('../services/AICopilotService');
const AnalyticsRepository = require('../repositories/AnalyticsRepository');
const PlanRepository = require('../repositories/PlanRepository');
const { plans } = require('../../src/shared/plans.json');

// Signed-out callers cannot be attributed to a plan, so they share a small per-IP daily allowance.
const anon = new Map();
const anonAllowed = (ip) => {
    const day = new Date().toISOString().slice(0, 10);
    const key = `${day}:${ip}`;
    for (const k of anon.keys()) if (!k.startsWith(day)) anon.delete(k);
    const n = (anon.get(key) || 0) + 1;
    anon.set(key, n);
    return n <= plans.free.limits.aiPerDay;
};

// AI copilot: the client builds the prompt; the server forwards it to its model.
router.post('/copilot', async (req, res) => {
    try {
        const { action, messages, language, roomId, projectId, userId } = req.body || {};
        if (userId) {
            const { limits } = await PlanRepository.getPlan(userId);
            if (limits.aiPerDay != null) {
                const { aiToday } = await PlanRepository.getUsage(userId);
                if (aiToday >= limits.aiPerDay) {
                    return res.status(402).json({ success: false, code: 'PLAN_LIMIT', limit: 'ai', error: `You have used today's ${limits.aiPerDay} free AI prompts. Upgrade to Team for unlimited AI, or run a local model in the desktop app.` });
                }
            }
        } else if (!anonAllowed(req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '?')) {
            return res.status(402).json({ success: false, code: 'PLAN_LIMIT', limit: 'ai', error: 'Sign in to keep using the AI copilot, or run a local model in the desktop app.' });
        }
        const { text, model } = await AICopilotService.complete({ messages });

        if (userId || roomId || projectId) {
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
