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

// Update profile details
router.put('/user/profile', async (req, res) => {
    try {
        const { userId, name, bio, social_links } = req.body;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const updated = await UserRepository.updateProfile(userId, { name, bio, social_links });
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

// Get user active sessions
router.get('/sessions', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const sessions = await UserRepository.getSessions(userId);
        res.json(sessions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Register session
router.post('/sessions', async (req, res) => {
    try {
        const { userId, device, ip, userAgent, sessionId } = req.body;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const session = await UserRepository.createSession(userId, { device, ip, userAgent, sessionId });
        res.json(session);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete other sessions
router.delete('/sessions/others', async (req, res) => {
    try {
        const { userId, currentSessionId } = req.body;
        if (!userId || !currentSessionId) return res.status(400).json({ error: "Missing required fields" });
        const deleted = await UserRepository.deleteOtherSessions(userId, currentSessionId);
        res.json({ success: true, count: deleted.length });
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

        const BREVO_KEY = process.env.BREVO_API_KEY;
        if (!BREVO_KEY) return res.status(500).json({ error: "BREVO_API_KEY not configured" });

        const html = MailService.getEmailTemplate({
            title: `Welcome to the Studio, ${name || 'Engineer'}`,
            message: "We're thrilled to have you here. Utkristi Colabs is designed to be the fastest, most immersive workspace for your technical team. Start by creating a project or joining a team vault.",
            ctaText: "Launch Workspace",
            ctaUrl: process.env.APP_URL || "http://localhost:5000",
            inviterName: "RTM Onboarding",
            recipientEmail: email,
            isWelcome: true
        });

        const result = await MailService.fetchRelay("https://api.brevo.com/v3/smtp/email", {
            sender: { name: "Utkristi Colabs", email: process.env.BREVO_FROM_EMAIL || "noreply@rtm-edit.com" },
            to: [{ email }],
            subject: "Welcome to Utkristi Colabs - Let's build together",
            htmlContent: html
        }, BREVO_KEY);

        res.json({ success: true, message: "Welcome email dispatched", status: result.status });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
