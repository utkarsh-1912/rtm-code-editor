const express = require('express');
const router = express.Router();
const DashboardRepository = require('../repositories/DashboardRepository');
const UserRepository = require('../repositories/UserRepository');
const RoomRepository = require('../repositories/RoomRepository');
const MailService = require('../services/MailService');

// Test Email Dispatch Endpoint
router.get('/test-email', async (req, res) => {
    try {
        const { to } = req.query;
        if (!to) return res.status(400).json({ error: "Missing recipient email" });

        const html = MailService.getEmailTemplate({
            title: "System Test Communication",
            message: "This is an automated diagnostic email from Utkristi Colabs Enterprise Node.",
            ctaText: "Open Security Console",
            ctaUrl: process.env.APP_URL || "http://localhost:5000",
            inviterName: "Diagnostic Engine",
            recipientEmail: to
        });

        const result = await MailService.sendMail({ to, subject: "Utkristi Colabs Diagnostic Test", html });
        res.json({ success: true, result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// User Dashboard Stats & Recent Activity
router.get('/user-dashboard', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const dashboard = await DashboardRepository.getUserDashboard(userId);
        res.json(dashboard);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Check user subscription / unsubscribed status
router.get('/user-subscription', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: "Missing email parameter" });
        const isUnsubscribed = await UserRepository.isUserUnsubscribed(email);
        res.json({ email, isUnsubscribed });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Rename workspace room
router.put('/rename-room', async (req, res) => {
    try {
        const { roomId, newName } = req.body;
        if (!roomId || !newName) return res.status(400).json({ error: "Missing parameters" });
        const updated = await RoomRepository.updateRoomName(roomId, newName);
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Remove workspace room from user history
router.delete('/remove-room', async (req, res) => {
    try {
        const { userId, roomId } = req.body;
        if (!userId || !roomId) return res.status(400).json({ error: "Missing parameters" });
        await RoomRepository.unlinkRoomFromUser(userId, roomId);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Global Search
router.get('/search', async (req, res) => {
    try {
        const { userId, q } = req.query;
        if (!userId || !q) return res.status(400).json({ error: "Missing query parameters" });
        const results = await DashboardRepository.searchAll(userId, q);
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Support / contact form (delivered to SUPPORT_EMAIL)
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

router.post('/support', async (req, res) => {
    try {
        const { name, email, message } = req.body || {};
        if (!name || !email || !message) return res.status(400).json({ error: "Name, email and message are required" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email address" });
        if (String(message).length > 5000) return res.status(400).json({ error: "Message is too long" });

        const to = process.env.SUPPORT_EMAIL;
        if (!to) return res.status(503).json({ error: "Support inbox is not configured yet" });

        const html = `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`;
        const result = await MailService.sendMail({ to, subject: `Support request from ${String(name).slice(0, 80)}`, html });
        if (result && result.success === false) return res.status(503).json({ error: "Email delivery is not configured" });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not send message" });
    }
});

module.exports = router;
