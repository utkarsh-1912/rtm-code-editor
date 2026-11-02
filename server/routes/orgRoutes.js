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

// --- Custom branding (Enterprise) -------------------------------------------------------------
const Branding = require('../services/Branding');
const { sql } = require('../repositories/DatabaseClient');

router.get('/organizations/:id/branding', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        if (!(await orgRole(me.uid, req.params.id))) return res.status(404).json({ error: "Team not found" });
        const org = (await sql`SELECT id, name, owner_id, brand_name, brand_color, brand_logo FROM organizations WHERE id = ${Number(req.params.id) || 0}`)[0];
        res.json({
            enterprise: await Branding.ownerHasBranding(org),
            name: org.brand_name || '', color: org.brand_color || '', teamName: org.name,
            logo: org.brand_logo ? `/api/brand/${org.id}/logo?v=${org.brand_logo.length}` : null,
        });
    } catch (err) {
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

router.put('/organizations/:id/branding', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        const role = await orgRole(me.uid, req.params.id);
        if (role !== 'owner' && role !== 'admin') return res.status(403).json({ error: "Only the team's owner or admins can change its branding." });
        const org = (await sql`SELECT id, owner_id FROM organizations WHERE id = ${Number(req.params.id) || 0}`)[0];
        if (!(await Branding.ownerHasBranding(org))) return res.status(402).json({ error: 'Custom branding is part of the Enterprise plan.', code: 'PLAN_LIMIT', limit: 'branding' });
        const b = req.body || {};
        const name = b.name === undefined ? undefined : String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 80) || null;
        if (b.color && !Branding.COLOR.test(String(b.color))) return res.status(400).json({ error: 'Pick the colour as a hex value like #2F62C9.' });
        const color = b.color === undefined ? undefined : (b.color ? String(b.color) : null);
        const logo = b.logo === undefined ? undefined : Branding.cleanLogo(b.logo);
        const cur = (await sql`SELECT brand_name, brand_color, brand_logo FROM organizations WHERE id = ${org.id}`)[0];
        await sql`
            UPDATE organizations SET
                brand_name = ${name === undefined ? cur.brand_name : name},
                brand_color = ${color === undefined ? cur.brand_color : color},
                brand_logo = ${logo === undefined ? cur.brand_logo : logo}
            WHERE id = ${org.id}
        `;
        res.json({ success: true });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Branding failed:', err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// The team's logo for pages and emails (public; only while the team has branding).
router.get('/brand/:orgId/logo', async (req, res) => {
    try {
        const img = await Branding.logoImage(req.params.orgId);
        if (!img) return res.status(404).end();
        res.set({ 'Content-Type': img.type, 'Cache-Control': 'public, max-age=3600', 'Content-Security-Policy': "default-src 'none'", 'X-Content-Type-Options': 'nosniff' });
        res.send(img.data);
    } catch (err) {
        res.status(404).end();
    }
});

module.exports = router;
