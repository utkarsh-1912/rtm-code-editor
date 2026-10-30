const express = require('express');
const router = express.Router();
const GitHub = require('../services/GitHubService');
const GitHubRepository = require('../repositories/GitHubRepository');
const ProjectRepository = require('../repositories/ProjectRepository');
const PlanRepository = require('../repositories/PlanRepository');
const { verifyFirebaseUser } = require('../services/BillingService');
const { languages: LANGUAGES } = require('../../src/shared/languages.json');

// Pushes and syncs carry whole projects; server.js skips its 2 MB parser for /api/github.
router.use('/github', express.json({ limit: '10mb' }));

const fail = (res, err) => {
    if (err instanceof GitHub.GitHubError) {
        return res.status(err.status || 500).json({ error: err.message, code: err.code, ...(err.conflicts ? { conflicts: err.conflicts } : {}) });
    }
    console.error('[GitHub]', err);
    res.status(500).json({ error: err.message || 'GitHub request failed' });
};

// Signed-in caller (Firebase ID token), or 401.
async function caller(req, res) {
    const uid = await verifyFirebaseUser(req);
    if (!uid) { res.status(401).json({ error: 'Sign in again to continue', code: 'SIGN_IN' }); return null; }
    return uid;
}

// Signed-in caller with a GitHub connection: { uid, conn }, or an error response.
async function connected(req, res) {
    if (!GitHub.configured()) { res.status(503).json({ error: 'GitHub is not set up on this server', code: 'NOT_CONFIGURED' }); return null; }
    const uid = await caller(req, res);
    if (!uid) return null;
    const conn = await GitHubRepository.getConnection(uid);
    if (!conn) { res.status(403).json({ error: 'Connect your GitHub account first', code: 'NOT_CONNECTED' }); return null; }
    return { uid, conn };
}

const projectIdOf = (req) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new GitHub.GitHubError('Unknown project', 400, 'BAD_REQUEST');
    return id;
};

// Project files use name = relative path, path = "/" + it (same as a folder import from disk).
const asProjectFiles = (files) => files.map((f) => ({ name: f.path, path: `/${f.path}`, content: f.content }));

// ---- Connection ------------------------------------------------------------

router.get('/github', async (req, res) => {
    try {
        if (!GitHub.configured()) return res.json({ configured: false, connected: false });
        const uid = await caller(req, res);
        if (!uid) return;
        const conn = await GitHubRepository.getConnection(uid);
        res.json({ configured: true, connected: Boolean(conn), login: conn?.login || null, scopes: conn?.scopes || '', connectedAt: conn?.createdAt || null });
    } catch (err) {
        fail(res, err);
    }
});

// The URL to send the browser to. The client navigates there itself, because this
// request carries the Firebase token in a header that a plain redirect can't.
router.get('/github/connect', async (req, res) => {
    try {
        if (!GitHub.configured()) return res.status(503).json({ error: 'GitHub is not set up on this server', code: 'NOT_CONFIGURED' });
        const uid = await caller(req, res);
        if (!uid) return;
        const state = GitHub.makeState(uid, GitHub.safeReturnTo(req.query.returnTo));
        res.json({ url: GitHub.authorizeUrl(req, state) });
    } catch (err) {
        fail(res, err);
    }
});

// GitHub sends the browser back here. Store the token, then return to the app with
// ?github=connected or ?github=error.
router.get('/github/callback', async (req, res) => {
    const state = GitHub.readState(req.query.state);
    const back = (status, reason) => {
        const url = new URL(state ? state.ret : GitHub.safeReturnTo(''));
        url.searchParams.set('github', status);
        if (reason) url.searchParams.set('reason', String(reason).slice(0, 120));
        res.redirect(url.toString());
    };
    if (!state) return back('error', 'The sign-in link expired. Try connecting again.');
    if (req.query.error) return back('error', req.query.error === 'access_denied' ? 'Access was not granted' : req.query.error_description || req.query.error);
    try {
        const { token, scopes, login } = await GitHub.exchangeCode(req, String(req.query.code || ''));
        await GitHubRepository.saveConnection(state.uid, { login, token, scopes });
        back('connected');
    } catch (err) {
        console.error('[GitHub] OAuth callback failed:', err.message);
        back('error', err.message);
    }
});

router.delete('/github', async (req, res) => {
    try {
        const uid = await caller(req, res);
        if (!uid) return;
        const conn = await GitHubRepository.getConnection(uid).catch(() => null);
        if (conn && GitHub.configured()) await GitHub.revokeGrant(conn.token);
        await GitHubRepository.deleteConnection(uid);
        res.json({ success: true });
    } catch (err) {
        fail(res, err);
    }
});

// ---- Browsing ----------------------------------------------------------------

router.get('/github/repos', async (req, res) => {
    try {
        const ctx = await connected(req, res);
        if (!ctx) return;
        res.json(await GitHub.listRepos(ctx.conn.token));
    } catch (err) {
        fail(res, err);
    }
});

router.get('/github/repos/:owner/:repo/branches', async (req, res) => {
    try {
        const ctx = await connected(req, res);
        if (!ctx) return;
        res.json(await GitHub.listBranches(ctx.conn.token, req.params.owner, req.params.repo));
    } catch (err) {
        fail(res, err);
    }
});

router.get('/github/repos/:owner/:repo/folders', async (req, res) => {
    try {
        const ctx = await connected(req, res);
        if (!ctx) return;
        res.json(await GitHub.listFolders(ctx.conn.token, req.params.owner, req.params.repo, String(req.query.branch || '')));
    } catch (err) {
        fail(res, err);
    }
});

// ---- Push, import, gist --------------------------------------------------------

// One commit with the given files: { owner, repo | createRepo: { name, private }, branch, message, folder, files }.
router.post('/github/push', async (req, res) => {
    try {
        const ctx = await connected(req, res);
        if (!ctx) return;
        const { owner, repo, branch, message, folder, files, createRepo } = req.body || {};
        res.json(await GitHub.pushFiles(ctx.conn.token, { owner, repo, branch, message, folder, files, createRepo }));
    } catch (err) {
        fail(res, err);
    }
});

// The project type for imported files: web if there's an index.html, else the language
// most of the files are written in.
function guessType(files) {
    if (files.some((f) => /^index\.html?$/i.test(f.path))) return 'web';
    const counts = new Map();
    for (const f of files) {
        const ext = (f.path.split('.').pop() || '').toLowerCase();
        const lang = LANGUAGES.find((l) => l.ext.includes(ext));
        if (lang) counts.set(lang.id, (counts.get(lang.id) || 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || 'web';
}

// Import a repo folder into a new project ({ newProject: { name } }) or an existing one
// ({ projectId }). With `link`, the project is then kept in sync with that folder.
router.post('/github/import', async (req, res) => {
    try {
        const ctx = await connected(req, res);
        if (!ctx) return;
        const { owner, repo, branch, path, projectId, newProject, link } = req.body || {};
        const read = await GitHub.readFolder(ctx.conn.token, { owner, repo, branch, path });
        if (!read.files.length) throw new GitHub.GitHubError('Every file there is binary or too large to import', 422, 'NOTHING_TO_IMPORT');

        let project;
        if (newProject) {
            const { limits } = await PlanRepository.getPlan(ctx.uid);
            if (limits.projects != null) {
                const { projects } = await PlanRepository.getUsage(ctx.uid);
                if (projects >= limits.projects) {
                    return res.status(402).json({ error: `The Free plan includes ${limits.projects} projects. Upgrade to Team for unlimited projects.`, code: 'PLAN_LIMIT', limit: 'projects' });
                }
            }
            const name = String(newProject.name || repo).trim().slice(0, 120) || repo;
            project = await ProjectRepository.createProject(ctx.uid, name, `Imported from github.com/${owner}/${repo}`, guessType(read.files), { empty: true });
        } else {
            project = await ProjectRepository.getProject(Number.parseInt(projectId, 10));
            if (!project) throw new GitHub.GitHubError('Project not found', 404, 'NOT_FOUND');
        }

        await ProjectRepository.upsertProjectFiles(project.id, asProjectFiles(read.files));
        let linked = null;
        if (link) {
            linked = await GitHubRepository.saveLink(project.id, {
                owner, repo, branch, path: read.folder, baseSha: read.headSha, skipped: read.skipped.map((s) => s.path), userId: ctx.conn.userId,
            });
        }
        res.json({ projectId: project.id, count: read.files.length, skipped: read.skipped, link: linked });
    } catch (err) {
        fail(res, err);
    }
});

router.post('/github/gists', async (req, res) => {
    try {
        const ctx = await connected(req, res);
        if (!ctx) return;
        const { description, isPublic, files } = req.body || {};
        res.json(await GitHub.createGist(ctx.conn.token, { description, isPublic, files }));
    } catch (err) {
        fail(res, err);
    }
});

// ---- Two-way project sync --------------------------------------------------------

const linkView = (link) => link && ({ owner: link.owner, repo: link.repo, branch: link.branch, path: link.path, baseSha: link.base_sha, updatedAt: link.updated_at });

async function requireLink(projectId) {
    const link = await GitHubRepository.getLink(projectId);
    if (!link) throw new GitHub.GitHubError('This project is not linked to a repository', 404, 'NOT_LINKED');
    return link;
}

router.get('/github/projects/:id/link', async (req, res) => {
    try {
        const uid = await caller(req, res);
        if (!uid) return;
        res.json({ link: linkView(await GitHubRepository.getLink(projectIdOf(req))) });
    } catch (err) {
        fail(res, err);
    }
});

// Link to a branch as it is now. Files that differ show up as local changes.
router.post('/github/projects/:id/link', async (req, res) => {
    try {
        const ctx = await connected(req, res);
        if (!ctx) return;
        const id = projectIdOf(req);
        if (!(await ProjectRepository.getProject(id))) throw new GitHub.GitHubError('Project not found', 404, 'NOT_FOUND');
        const { owner, repo, branch, path } = req.body || {};
        GitHub.checkRepo(owner, repo);
        GitHub.checkBranch(branch);
        const head = await GitHub.branchHead(ctx.conn.token, owner, repo, branch);
        if (!head.sha) throw new GitHub.GitHubError(head.empty ? 'This repository is empty. Push the project to it first.' : `Branch "${branch}" was not found`, 404, 'NOT_FOUND');
        const link = await GitHubRepository.saveLink(id, { owner, repo, branch, path: GitHub.cleanFolder(path), baseSha: head.sha, userId: ctx.conn.userId });
        res.json({ link: linkView(link) });
    } catch (err) {
        fail(res, err);
    }
});

router.delete('/github/projects/:id/link', async (req, res) => {
    try {
        const uid = await caller(req, res);
        if (!uid) return;
        await GitHubRepository.deleteLink(projectIdOf(req));
        res.json({ success: true });
    } catch (err) {
        fail(res, err);
    }
});

// Changes on each side since the last sync. Body: { files } (the project as the client has it).
router.post('/github/projects/:id/status', async (req, res) => {
    try {
        const ctx = await connected(req, res);
        if (!ctx) return;
        const link = await requireLink(projectIdOf(req));
        const status = await GitHub.syncStatus(ctx.conn.token, link, req.body?.files);
        res.json({ link: linkView(link), baseSha: status.baseSha, headSha: status.headSha, changes: status.changes });
    } catch (err) {
        fail(res, err);
    }
});

// Bring GitHub's changes into the project. Body: { files, resolve?: "mine" | "theirs" }.
router.post('/github/projects/:id/pull', async (req, res) => {
    try {
        const ctx = await connected(req, res);
        if (!ctx) return;
        const id = projectIdOf(req);
        const link = await requireLink(id);
        const status = await GitHub.syncStatus(ctx.conn.token, link, req.body?.files);
        const plan = await GitHub.planPull(ctx.conn.token, link, status, req.body?.resolve);
        if (plan.writes.length) await ProjectRepository.upsertProjectFiles(id, asProjectFiles(plan.writes));
        for (const path of plan.deletes) await ProjectRepository.deleteProjectFile(id, path);
        const skipped = [...new Set([...(link.skipped || []), ...plan.skipped.map((s) => s.path)])];
        await GitHubRepository.setLinkBase(id, status.headSha, skipped);
        if (plan.writes.length || plan.deletes.length) req.app.get('io')?.to(`project-${id}`).emit('project-files-synced', { by: ctx.conn.login });
        res.json({ headSha: status.headSha, updated: plan.writes.map((w) => w.path), deleted: plan.deletes, kept: plan.kept, skipped: plan.skipped });
    } catch (err) {
        fail(res, err);
    }
});

// Commit the project's changes and push. Body: { files, message }.
router.post('/github/projects/:id/push', async (req, res) => {
    try {
        const ctx = await connected(req, res);
        if (!ctx) return;
        const id = projectIdOf(req);
        const link = await requireLink(id);
        const status = await GitHub.syncStatus(ctx.conn.token, link, req.body?.files);
        const commit = await GitHub.pushSync(ctx.conn.token, link, status, req.body?.message);
        await GitHubRepository.setLinkBase(id, commit.sha);
        res.json({ ...commit, pushed: status.changes.filter((c) => c.local).map((c) => ({ path: c.path, change: c.local })) });
    } catch (err) {
        fail(res, err);
    }
});

module.exports = router;
