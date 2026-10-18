const express = require('express');
const router = express.Router();
const UserRepository = require('../repositories/UserRepository');
const MailService = require('../services/MailService');

// User profile retrieval
router.get('/user/profile', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const user = await UserRepository.getUser(userId);
        res.json(user || {});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Create or refresh the signed-in user's record (name, email, avatar) after sign-in.
router.post('/user/sync', async (req, res) => {
    try {
        const { uid, email, name, photoURL } = req.body || {};
        if (!uid) return res.status(400).json({ error: "Missing uid" });
        const user = await UserRepository.findOrCreateUser({ uid, email, name, photoURL });
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Update profile details
router.put('/user/profile', async (req, res) => {
    try {
        // Accept both { name, bio, social_links } and { profileData: { … } } (the Settings page).
        const { userId } = req.body || {};
        const data = req.body.profileData || req.body;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const updated = await UserRepository.updateProfile(userId, { name: data.name, bio: data.bio, social_links: data.social_links });
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete account
router.delete('/user', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        await UserRepository.deleteAccount(userId);
        res.json({ success: true, message: "Account deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Signed-in devices. sessionKey (the caller's own key) marks "This device".
router.get('/sessions', async (req, res) => {
    try {
        const { userId, sessionKey } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        res.json(await UserRepository.getSessions(userId, sessionKey || null));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Device check-in. Returns { id, revoked }; a revoked device should sign out.
router.post('/sessions', async (req, res) => {
    try {
        const { userId, device, userAgent, sessionId } = req.body;
        if (!userId || !sessionId) return res.status(400).json({ error: "Missing userId or sessionId" });
        const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().replace(/^::ffff:/, '').slice(0, 64);
        const session = await UserRepository.createSession(userId, {
            device: String(device || 'Unknown device').slice(0, 120),
            ip,
            userAgent: String(userAgent || '').slice(0, 400),
            sessionId,
        });
        res.json(session);
    } catch (err) {
        console.error(err);
        res.status(err.message === 'Invalid session key' ? 400 : 500).json({ error: err.message });
    }
});

// Sign out every other device. Accepts query or JSON body.
router.delete('/sessions/others', async (req, res) => {
    try {
        const userId = req.body?.userId || req.query.userId;
        const currentSessionId = req.body?.currentSessionId || req.query.currentSessionId;
        if (!userId || !currentSessionId) return res.status(400).json({ error: "Missing required fields" });
        const revoked = await UserRepository.deleteOtherSessions(userId, currentSessionId);
        res.json({ success: true, count: revoked.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Rename one device.
router.patch('/sessions/:id', async (req, res) => {
    try {
        const { userId, name } = req.body || {};
        const id = Number(req.params.id);
        if (!userId || !Number.isInteger(id)) return res.status(400).json({ error: "Missing userId or id" });
        const row = await UserRepository.renameSession(userId, id, name);
        if (!row) return res.status(404).json({ error: "Device not found" });
        res.json(row);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Sign out one device.
router.delete('/sessions/:id', async (req, res) => {
    try {
        const userId = req.body?.userId || req.query.userId;
        const id = Number(req.params.id);
        if (!userId || !Number.isInteger(id)) return res.status(400).json({ error: "Missing userId or id" });
        const ok = await UserRepository.revokeSession(userId, id);
        if (!ok) return res.status(404).json({ error: "Device not found" });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Unsubscribe user from emails
router.post('/unsubscribe', async (req, res) => {
    try {
        const { email, unsubscribed } = req.body;
        if (!email) return res.status(400).json({ error: "Missing email" });
        await UserRepository.unsubscribeUser(email, unsubscribed !== false);
        res.json({ success: true, message: "Unsubscribe status updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Welcome onboard email endpoint
router.get('/welcome-new-user', async (req, res) => {
    try {
        const { email, name } = req.query;
        if (!email) return res.status(400).json({ error: "Missing email query parameter" });

        const html = MailService.getEmailTemplate({
            title: `Welcome to the Studio, ${name || 'Engineer'}`,
            message: "We're thrilled to have you here. Utkristi Colabs is designed to be the fastest, most immersive workspace for your technical team. Start by creating a project or joining a team vault.",
            ctaText: "Launch Workspace",
            ctaUrl: process.env.APP_URL || "http://localhost:5000",
            inviterName: "RTM Onboarding",
            recipientEmail: email,
            isWelcome: true
        });

        const result = await MailService.deliver({ to: email, subject: "Welcome to Utkristi Colabs - Let's build together", html });
        if (!result.success) return res.status(502).json({ error: "No email provider could deliver the message", attempts: result.attempts });
        res.json({ success: true, message: "Welcome email dispatched", provider: result.provider });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
