const express = require('express');
const router = express.Router();
const DashboardRepository = require('../repositories/DashboardRepository');
const UserRepository = require('../repositories/UserRepository');
const RoomRepository = require('../repositories/RoomRepository');
const MailService = require('../services/MailService');
const { paging } = require('../utils/paging');

// Header announcements: server/config/announcements.json, or the ANNOUNCEMENTS_JSON env var
// (an array) to change them without a deploy. ?audience=site|app; only entries within their
// from/until window are returned.
function loadAnnouncements() {
    try {
        if (process.env.ANNOUNCEMENTS_JSON) {
            const list = JSON.parse(process.env.ANNOUNCEMENTS_JSON);
            if (Array.isArray(list)) return list;
        }
    } catch (err) {
        console.error("ANNOUNCEMENTS_JSON is not valid JSON:", err.message);
    }
    try {
        delete require.cache[require.resolve('../config/announcements.json')];
        return require('../config/announcements.json').announcements || [];
    } catch {
        return [];
    }
}

router.get('/announcements', (req, res) => {
    const audience = req.query.audience === 'app' ? 'app' : 'site';
    const now = Date.now();
    const items = loadAnnouncements()
        .filter((a) => a && a.id && a.text)
        .filter((a) => !a.audience || a.audience === 'all' || a.audience === audience)
        .filter((a) => (!a.from || Date.parse(a.from) <= now) && (!a.until || Date.parse(a.until) > now))
        .map(({ id, text, href, cta, tone }) => ({
            id: String(id).slice(0, 60),
            text: String(text).slice(0, 160),
            href: typeof href === 'string' && /^(\/|https:\/\/)/.test(href) ? href : null,
            cta: cta ? String(cta).slice(0, 30) : null,
            tone: ['info', 'new', 'warn'].includes(tone) ? tone : 'info',
        }));
    res.set('Cache-Control', 'public, max-age=300');
    res.json(items);
});

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

        const result = await MailService.deliver({ to, subject: "Utkristi Colabs Diagnostic Test", html });
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

// A user's rooms, paged: /api/rooms?userId=…&limit=50&offset=0 -> { items, total }
router.get('/rooms', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const page = paging(req.query, { max: 100, fallback: 50 }) || { limit: 50, offset: 0 };
        res.json(await RoomRepository.getUserRoomsPage(userId, page));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Rename workspace room
router.put('/rename-room', async (req, res) => {
    try {
        const { roomId, newName } = req.body;
        if (!roomId) return res.status(400).json({ error: "Missing roomId" });
        const updated = await RoomRepository.updateRoomName(roomId, newName);
        if (!updated) return res.status(404).json({ error: "Room not found" });
        // People in the room see the new name right away.
        req.app.get('io')?.to(roomId).emit('room-meta', { name: updated.name });
        res.json({ id: updated.room_id, name: updated.name || updated.room_id, customName: !!updated.name });
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
        const result = await MailService.deliver({ to, subject: `Support request from ${String(name).slice(0, 80)}`, html });
        if (!result.success) return res.status(503).json({ error: "Email delivery is not configured" });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not send message" });
    }
});

// Latest desktop release, cached server-side so the download page never hits GitHub's
// anonymous rate limit. Set GITHUB_TOKEN to raise that limit further.
const RELEASE_REPO = process.env.GITHUB_REPO || 'utkarsh-1912/rtm-code-editor';
let releaseCache = { at: 0, data: null };
router.get('/release/latest', async (req, res) => {
    try {
        if (releaseCache.data && Date.now() - releaseCache.at < 10 * 60 * 1000) return res.json(releaseCache.data);
        const r = await fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`, {
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'utkristi-colabs', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
        });
        if (!r.ok) return res.status(r.status === 404 ? 404 : 502).json(releaseCache.data || { error: 'No release published yet' });
        const d = await r.json();
        releaseCache = {
            at: Date.now(),
            data: {
                tag: d.tag_name,
                date: d.published_at,
                url: d.html_url,
                assets: (d.assets || []).map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })),
            },
        };
        res.json(releaseCache.data);
    } catch (err) {
        res.status(releaseCache.data ? 200 : 502).json(releaseCache.data || { error: 'Release lookup failed' });
    }
});

module.exports = router;
