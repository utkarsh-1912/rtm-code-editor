const express = require('express');
const router = express.Router();
const SnippetRepository = require('../repositories/SnippetRepository');

// Get snippets for user
router.get('/snippets', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const snippets = await SnippetRepository.getSnippets(userId);
        res.json(snippets);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
    }
});

// Update snippet
router.put('/snippets/:id', async (req, res) => {
    try {
        const { title, code, language, tags } = req.body;
        const updated = await SnippetRepository.updateSnippet(req.params.id, title, code, language, tags);
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete snippet
router.delete('/snippets/:id', async (req, res) => {
    try {
        await SnippetRepository.deleteSnippet(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
