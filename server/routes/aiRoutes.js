const express = require('express');
const router = express.Router();
const AICopilotService = require('../services/AICopilotService');
const AnalyticsRepository = require('../repositories/AnalyticsRepository');
const PlanRepository = require('../repositories/PlanRepository');
const { plans } = require('../../src/shared/plans.json');
const AIModels = require('../services/AIModels');
const AIAccessRepository = require('../repositories/AIAccessRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const UserRepository = require('../repositories/UserRepository');
const { verifyToken } = require('../services/Identity');
const { providerById } = require('../../src/shared/aiProviders');

const caller = (req) => verifyToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
// The site's developers (approve model access): ADMIN_EMAILS="you@example.com,teammate@example.com"
const isAdmin = (who) => !!who?.email && String(process.env.ADMIN_EMAILS || '').toLowerCase().split(/[\s,]+/).includes(who.email.toLowerCase());

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
        const { action, messages, language, roomId, projectId, userId, modelId } = req.body || {};
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
        // A chosen platform model (Settings > AI models); otherwise the default hosted model.
        let reply;
        const chosen = modelId ? AIModels.platformModel(String(modelId)) : null;
        if (chosen && !chosen.default) {
            if (!chosen.ready) return res.status(503).json({ success: false, error: `${chosen.label} isn't available on this server right now.` });
            if (chosen.access === 'request') {
                const who = await caller(req);
                if (!who || !(isAdmin(who) || await AIAccessRepository.isApproved(who.uid, chosen.id))) {
                    return res.status(403).json({ success: false, code: 'NO_ACCESS', error: `You don't have access to ${chosen.label} yet. Request it in Settings > AI models.` });
                }
            }
            reply = await AIModels.chat({ providerId: chosen.provider, key: AIModels.serverKey(chosen.provider), model: chosen.model, messages });
        } else {
            reply = await AICopilotService.complete({ messages });
        }
        const { text, model } = reply;

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

// --- Platform models and access ----------------------------------------------------------------
// The models this site offers, and (signed in) whether you can use each one.
router.get('/ai/models', async (req, res) => {
    try {
        const who = await caller(req).catch(() => null);
        const mine = who ? Object.fromEntries((await AIAccessRepository.forUser(who.uid)).map((r) => [r.model_id, r.status])) : {};
        const admin = isAdmin(who);
        res.json({
            admin,
            models: AIModels.platformModels().map((m) => ({
                id: m.id, label: m.label, provider: m.provider, providerName: providerById(m.provider)?.name, model: m.model,
                access: m.access, default: m.default, ready: m.ready,
                status: m.access === 'open' || admin ? 'available' : mine[m.id] || 'none', // none | pending | approved | declined | available
            })),
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not load models.' });
    }
});

router.post('/ai/models/:id/request', async (req, res) => {
    try {
        const who = await caller(req);
        if (!who) return res.status(401).json({ error: 'Sign in to request access.' });
        const m = AIModels.platformModel(req.params.id);
        if (!m || m.access !== 'request') return res.status(404).json({ error: 'No such model to request.' });
        const user = await UserRepository.getUser(who.uid).catch(() => null);
        const row = await AIAccessRepository.requestAccess({ uid: who.uid, email: who.email, name: user?.name, modelId: m.id, note: String(req.body?.note || '').slice(0, 500) });
        // Tell the developers (in the app) there's something to approve.
        for (const email of String(process.env.ADMIN_EMAILS || '').split(/[\s,]+/).filter(Boolean)) {
            const admin = await UserRepository.getUserByEmail(email.toLowerCase()).catch(() => null);
            if (admin?.auth_provider_id && row.status === 'pending') {
                NotificationRepository.notifyUser(admin.auth_provider_id, { type: 'ai-access', message: `${user?.name || who.email} asked for ${m.label}`, url: '/settings?section=ai', data: { modelId: m.id } }).catch(() => { });
            }
        }
        res.json({ status: row.status });
    } catch (err) {
        console.error('AI access request failed:', err.message);
        res.status(500).json({ error: 'Could not send the request.' });
    }
});

// Developers only: requests waiting, and approve / decline.
router.get('/ai/access-requests', async (req, res) => {
    try {
        const who = await caller(req);
        if (!isAdmin(who)) return res.status(403).json({ error: 'Only the site\'s developers can see requests.' });
        const status = ['pending', 'approved', 'declined', 'all'].includes(req.query.status) ? req.query.status : 'pending';
        const labels = Object.fromEntries(AIModels.platformModels().map((m) => [m.id, m.label]));
        res.json((await AIAccessRepository.list(status)).map((r) => ({ id: r.id, email: r.email, name: r.name, modelId: r.model_id, model: labels[r.model_id] || r.model_id, note: r.note, status: r.status, createdAt: r.created_at })));
    } catch (err) {
        res.status(500).json({ error: 'Could not load requests.' });
    }
});

router.post('/ai/access-requests/:id', async (req, res) => {
    try {
        const who = await caller(req);
        if (!isAdmin(who)) return res.status(403).json({ error: 'Only the site\'s developers can decide requests.' });
        const status = req.body?.decision === 'approve' ? 'approved' : 'declined';
        const row = await AIAccessRepository.decide(Number(req.params.id), status);
        if (!row) return res.status(404).json({ error: 'Request not found.' });
        const label = AIModels.platformModel(row.model_id)?.label || row.model_id;
        NotificationRepository.notifyUser(row.uid, { type: 'ai-access', message: status === 'approved' ? `You can now use ${label} in the AI copilot.` : `Your request for ${label} wasn't approved.`, url: '/settings?section=ai', data: { modelId: row.model_id } }).catch(() => { });
        res.json({ id: row.id, status: row.status });
    } catch (err) {
        res.status(500).json({ error: 'Could not save the decision.' });
    }
});

// --- Relay for your own key ---------------------------------------------------------------------
// Some providers don't accept calls from a browser. The web app then sends that one request here
// with your key in a header; it goes straight on to the provider and is never stored or logged.
// Only known provider addresses (no custom servers), signed in, and rate limited.
const relayUse = new Map(); // uid -> [timestamps]
router.post('/ai/relay', async (req, res) => {
    try {
        const who = await caller(req);
        if (!who) return res.status(401).json({ error: 'Sign in to use your own AI key.' });
        const now = Date.now();
        const recent = (relayUse.get(who.uid) || []).filter((t) => now - t < 60 * 60 * 1000);
        if (recent.length >= 200) return res.status(429).json({ error: 'Too many requests through the relay this hour. Try again later.' });
        relayUse.set(who.uid, [...recent, now]);
        const key = String(req.headers['x-provider-key'] || '');
        const { provider, model, messages } = req.body || {};
        const p = providerById(provider);
        if (!p || p.custom) return res.status(400).json({ error: 'That provider can only be called directly.' });
        if (!key || key.length > 500) return res.status(400).json({ error: 'Missing API key.' });
        const out = await AIModels.chat({ providerId: p.id, key, model, messages });
        res.set('Cache-Control', 'no-store');
        res.json({ text: out.text, model: out.model });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'The relay failed.' });
    }
});

module.exports = router;
