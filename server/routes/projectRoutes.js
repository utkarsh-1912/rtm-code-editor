const express = require('express');
const router = express.Router();
const ProjectRepository = require('../repositories/ProjectRepository');
const MailService = require('../services/MailService');

// Get all projects for a user
router.get('/projects', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const projects = await ProjectRepository.getProjects(userId);
        res.json(projects);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Create project
router.post('/projects', async (req, res) => {
    try {
        const { userId, name, description, type } = req.body;
        if (!userId || !name) return res.status(400).json({ error: "Missing required parameters" });
        const project = await ProjectRepository.createProject(userId, name, description, type);
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
        const file = await ProjectRepository.upsertProjectFile(req.params.id, name, path, content || "", isDirectory || false);
        res.json(file);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete project file
router.delete('/projects/:id/files', async (req, res) => {
    try {
        const { path } = req.body;
        if (!path) return res.status(400).json({ error: "Missing path parameter" });
        await ProjectRepository.deleteProjectFile(req.params.id, path);
        res.json({ success: true });
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

        const BREVO_KEY = process.env.BREVO_API_KEY;
        if (BREVO_KEY) {
            await MailService.fetchRelay("https://api.brevo.com/v3/smtp/email", {
                sender: { name: "Utkristi Colabs", email: process.env.BREVO_FROM_EMAIL || "noreply@rtm-edit.com" },
                to: [{ email }],
                subject: `Invitation to collaborate on ${projectTitle}`,
                htmlContent: html
            }, BREVO_KEY);
        }

        res.json({ success: true, message: "Invitation sent successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
