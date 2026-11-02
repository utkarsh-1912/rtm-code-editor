const express = require('express');
const router = express.Router();
const { requireUser, orgRole } = require('../security/access');
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
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
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
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// Add org member
router.post('/organizations/:id/members', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        const mine = await orgRole(me.uid, req.params.id);
        if (mine !== 'owner' && mine !== 'admin') return res.status(403).json({ error: "Only the team's owner or admins can add people." });
        const { email, role } = req.body;
        if (!email) return res.status(400).json({ error: "Missing email" });
        // Nobody can be made owner this way; only owners can add admins.
        const safeRole = role === 'admin' && mine === 'owner' ? 'admin' : 'member';
        const member = await OrgRepository.addOrgMember(req.params.id, email, safeRole);
        res.json(member);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// Get org members
router.get('/organizations/:id/members', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        if (!(await orgRole(me.uid, req.params.id))) return res.status(404).json({ error: "Team not found" });
        const members = await OrgRepository.getOrgMembers(req.params.id);
        res.json(members);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// Delete organization
router.delete('/organizations/:id', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        if ((await orgRole(me.uid, req.params.id)) !== 'owner') return res.status(403).json({ error: "Only the team's owner can delete it." });
        await OrgRepository.deleteOrganization(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

module.exports = router;
