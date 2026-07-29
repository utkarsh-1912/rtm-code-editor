const express = require('express');
const router = express.Router();
const OrgRepository = require('../repositories/OrgRepository');

// Create organization
router.post('/organizations', async (req, res) => {
    try {
        const { userId, name } = req.body;
        if (!userId || !name) return res.status(400).json({ error: "Missing required fields" });
        const org = await OrgRepository.createOrganization(userId, name);
        res.json(org);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Get user organizations
router.get('/organizations', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const orgs = await OrgRepository.getOrganizations(userId);
        res.json(orgs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Add org member
router.post('/organizations/:id/members', async (req, res) => {
    try {
        const { email, role } = req.body;
        if (!email) return res.status(400).json({ error: "Missing email" });
        const member = await OrgRepository.addOrgMember(req.params.id, email, role);
        res.json(member);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Get org members
router.get('/organizations/:id/members', async (req, res) => {
    try {
        const members = await OrgRepository.getOrgMembers(req.params.id);
        res.json(members);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete organization
router.delete('/organizations/:id', async (req, res) => {
    try {
        await OrgRepository.deleteOrganization(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
