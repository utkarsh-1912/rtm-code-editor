const express = require('express');
const router = express.Router();
const ProjectRepository = require('../repositories/ProjectRepository');
const MailService = require('../services/MailService');
const UserRepository = require('../repositories/UserRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const PlanRepository = require('../repositories/PlanRepository');
const { paging } = require('../utils/paging');

// Get all projects for a user
router.get('/projects', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        // ?limit=&offset= -> { items, total }; without them, the full list (older callers).
        const page = paging(req.query, { max: 100, fallback: 50 });
        if (page) return res.json(await ProjectRepository.getProjectsPage(userId, page));
        res.json(await ProjectRepository.getProjects(userId));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Create project
router.post('/projects', async (req, res) => {
    try {
        const { userId, name, description, type, empty } = req.body;
        if (!userId || !name) return res.status(400).json({ error: "Missing required parameters" });
        const { limits } = await PlanRepository.getPlan(userId);
        if (limits.projects != null) {
            const { projects } = await PlanRepository.getUsage(userId);
            if (projects >= limits.projects) {
                return res.status(402).json({ error: `The Free plan includes ${limits.projects} projects. Upgrade to Team for unlimited projects.`, code: 'PLAN_LIMIT', limit: 'projects' });
            }
        }
        const project = await ProjectRepository.createProject(userId, name, description, type, { empty: !!empty });
        res.json(project);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Get single project metadata
router.get('/projects/:id', async (req, res) => {
    try {
        const project = await ProjectRepository.getProject(req.params.id);
        if (!project) return res.status(404).json({ error: "Project not found" });
        res.json(project);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete project
router.delete('/projects/:id', async (req, res) => {
    try {
        await ProjectRepository.deleteProject(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Get project files
router.get('/projects/:id/files', async (req, res) => {
    try {
        const files = await ProjectRepository.getProjectFiles(req.params.id);
        res.json(files);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Create or update project file
router.post('/projects/:id/files', async (req, res) => {
    try {
        const { name, path, content, isDirectory } = req.body;
        if (!name || !path) return res.status(400).json({ error: "Missing file details" });
        const clean = String(path).replace(/\\/g, '/');
        const segments = clean.replace(/^[/]+/, '').split('/');
        if (clean.length > 400 || segments.some((seg) => !seg || seg === '.' || seg === '..')) {
            return res.status(400).json({ error: `Bad path: ${path}` });
        }
        const rows = await ProjectRepository.upsertProjectFile(req.params.id, String(name).slice(0, 400), `/${segments.join('/')}`, content || "", !!isDirectory);
        res.json(rows[0] || null);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Bulk import (opened folder / several files). Has its own body limit; see server.js.
const MAX_FILES = 300;
const MAX_FILE_BYTES = 1024 * 1024;
router.post('/projects/:id/files/bulk', express.json({ limit: '10mb' }), async (req, res) => {
    try {
        const files = Array.isArray(req.body?.files) ? req.body.files : null;
        if (!files || !files.length) return res.status(400).json({ error: "No files" });
        if (files.length > MAX_FILES) return res.status(413).json({ error: `At most ${MAX_FILES} files per request` });
        const clean = [];
        for (const f of files) {
            const path = String(f.path || '').replace(/\\/g, '/').replace(/^\/+/, '');
            const segments = path.split('/');
            const bad = !path || path.length > 400 || /^[a-zA-Z]:/.test(path) || path.includes(String.fromCharCode(0)) || segments.some((seg) => !seg || seg === '.' || seg === '..');
            if (bad) return res.status(400).json({ error: `Bad path: ${f.path}` });
            const content = String(f.content ?? '');
            if (Buffer.byteLength(content) > MAX_FILE_BYTES) return res.status(413).json({ error: `${path} is larger than 1 MB` });
            // Same convention as files created in the editor: name = relative path, path = "/" + it.
            clean.push({ name: path, path: `/${path}`, content });
        }
        const saved = await ProjectRepository.upsertProjectFiles(req.params.id, clean);
        res.json({ success: true, count: saved.length, files: saved });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Rename a project (name only).
router.patch('/projects/:id', async (req, res) => {
    try {
        const project = await ProjectRepository.renameProject(req.params.id, req.body?.name);
        if (!project) return res.status(404).json({ error: "Project not found" });
        req.app.get('io')?.to(`project-${req.params.id}`).emit('project-renamed', { name: project.name });
        res.json(project);
    } catch (err) {
        res.status(err.message === "Name is required" ? 400 : 500).json({ error: err.message });
    }
});

// Delete project file
router.delete('/projects/:id/files', async (req, res) => {
    try {
        const filePath = req.query.path || req.body?.path;
        if (!filePath) return res.status(400).json({ error: "Missing path parameter" });
        const recursive = req.query.recursive === '1' || req.body?.recursive === true;
        const deleted = await ProjectRepository.deleteProjectFile(req.params.id, filePath, { recursive });
        res.json({ success: true, count: deleted.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Send project invitation email
router.post('/projects/:id/invite', async (req, res) => {
    try {
        const { email, inviterName, inviterPhoto } = req.body;
        if (!email) return res.status(400).json({ error: "Missing recipient email" });

        const project = await ProjectRepository.getProject(req.params.id);
        const projectTitle = project ? project.name : "Studio Project";

        const html = MailService.getEmailTemplate({
            title: `You've been invited to join ${projectTitle}`,
            message: `${inviterName || 'A teammate'} invited you to collaborate in real-time on the project "${projectTitle}". Click below to open the workspace.`,
            ctaText: "Join Workspace",
            ctaUrl: `${process.env.APP_URL || 'http://localhost:5000'}/project/${req.params.id}`,
            inviterName,
            inviterPhoto,
            recipientEmail: email
        });

        const mail = await MailService.deliver({ to: email, subject: `Invitation to collaborate on ${projectTitle}`, html });

        // If the invitee already has an account, also notify them in-app and by push.
        const invitee = await UserRepository.getUserByEmail(email).catch(() => null);
        if (invitee) {
            await NotificationRepository.notifyUser(invitee.auth_provider_id, {
                type: 'invite',
                message: `${inviterName || 'A teammate'} invited you to "${projectTitle}"`,
                url: `${process.env.APP_URL || 'http://localhost:5000'}/project/${req.params.id}`,
                data: { projectId: req.params.id },
            }).catch(() => { });
        }

        res.json({ success: true, emailed: mail.success, provider: mail.provider, message: mail.success ? "Invitation sent successfully" : "Invitation saved, but no email provider could deliver it" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
