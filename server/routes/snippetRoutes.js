const express = require('express');
const router = express.Router();
const { requireUser, ownsSnippet } = require('../security/access');
const SnippetRepository = require('../repositories/SnippetRepository');
const { paging } = require('../utils/paging');

// Get snippets for user
router.get('/snippets', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        // ?limit=&offset= -> { items, total }; without them, the full list (older callers).
        const page = paging(req.query, { max: 100, fallback: 60 });
        if (page) return res.json(await SnippetRepository.getSnippetsPage(userId, page));
        res.json(await SnippetRepository.getSnippets(userId));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// Create snippet
router.post('/snippets', async (req, res) => {
    try {
        const { userId, title, code, language, tags, organizationId } = req.body;
        if (!userId || !title || !code || !language) return res.status(400).json({ error: "Missing required fields" });
        const snippet = await SnippetRepository.createSnippet(userId, title, code, language, tags, organizationId);
        res.json(snippet);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// Update snippet
router.put('/snippets/:id', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        if (!(await ownsSnippet(me.uid, req.params.id))) return res.status(404).json({ error: "Snippet not found" });
        const { title, code, language, tags } = req.body;
        const updated = await SnippetRepository.updateSnippet(req.params.id, title, code, language, tags);
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// Delete snippet
router.delete('/snippets/:id', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        if (!(await ownsSnippet(me.uid, req.params.id))) return res.status(404).json({ error: "Snippet not found" });
        await SnippetRepository.deleteSnippet(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

module.exports = router;
