const crypto = require('crypto');

// Every GitHub call made for a user goes through here, on the server, with the token
// stored in github_connections. The browser only ever talks to /api/github/*.

const API = 'https://api.github.com';
const SCOPES = 'repo gist';

// Same limits as a folder import from disk (projectRoutes /files/bulk).
const MAX_FILES = 300;
const MAX_FILE_BYTES = 1024 * 1024;

const configured = () => Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_TOKEN_ENCRYPTION_KEY);

class GitHubError extends Error {
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

async function gh(token, method, path, body) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'User-Agent': 'utkristi-colabs',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        // A revoked or expired grant: the person has to connect again.
        if (res.status === 401) throw new GitHubError('GitHub no longer accepts this connection. Connect GitHub again.', 401, 'GITHUB_RECONNECT');
        throw new GitHubError((data && data.message) || `GitHub responded ${res.status}`, res.status, 'GITHUB_ERROR');
    }
    return data;
}

// ---- OAuth ----------------------------------------------------------------

const stateKey = () => crypto.createHash('sha256').update(`oauth-state:${process.env.GITHUB_TOKEN_ENCRYPTION_KEY}`).digest();
const sign = (payload) => crypto.createHmac('sha256', stateKey()).update(payload).digest('base64url');

// The state carries who is connecting and where to send them back, signed so the
// callback can trust it without a server-side session. Valid for 10 minutes.
function makeState(uid, returnTo) {
    const payload = Buffer.from(JSON.stringify({ uid, ret: returnTo, exp: Date.now() + 10 * 60 * 1000, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

function readState(state) {
    const [payload, mac] = String(state || '').split('.');
    if (!payload || !mac) return null;
    const expected = sign(payload);
    if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return data.exp > Date.now() ? data : null;
    } catch {
        return null;
    }
}

// Where the person may be sent back to after connecting: the public site, or a local
// UI (development, the desktop app). Anything else falls back to APP_URL.
function safeReturnTo(value) {
    const fallback = `${(process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/settings?section=connections`;
    try {
        const url = new URL(value);
        const allowed = [process.env.APP_URL, process.env.CLIENT_URL].filter(Boolean).map((u) => new URL(u).origin);
        const local = ['localhost', '127.0.0.1'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol);
        return allowed.includes(url.origin) || local ? url.toString() : fallback;
    } catch {
        return fallback;
    }
}

function callbackUrl(req) {
    if (process.env.GITHUB_CALLBACK_URL) return process.env.GITHUB_CALLBACK_URL;
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0];
    return `${proto}://${req.get('host')}/api/github/callback`;
}

function authorizeUrl(req, state) {
    const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID,
        redirect_uri: callbackUrl(req),
        scope: SCOPES,
        state,
        allow_signup: 'true',
    });
    return `https://github.com/login/oauth/authorize?${params}`;
}

async function exchangeCode(req, code) {
    const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: callbackUrl(req),
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) throw new GitHubError(data.error_description || data.error || 'GitHub did not return a token', 502, 'GITHUB_OAUTH');
    const user = await gh(data.access_token, 'GET', '/user');
    return { token: data.access_token, scopes: data.scope || '', login: user.login };
}

// Best effort: remove the app's grant on GitHub too, so disconnecting really revokes access.
async function revokeGrant(token) {
    const basic = Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString('base64');
    await fetch(`${API}/applications/${process.env.GITHUB_CLIENT_ID}/grant`, {
        method: 'DELETE',
        headers: { Accept: 'application/vnd.github+json', Authorization: `Basic ${basic}`, 'User-Agent': 'utkristi-colabs', 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
    }).catch(() => { });
}

// ---- Names and paths --------------------------------------------------------

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
function checkRepo(owner, repo) {
    if (!NAME.test(owner || '') || !NAME.test(repo || '')) throw new GitHubError('Pick a repository', 400, 'BAD_REQUEST');
}

function checkBranch(branch) {
    const b = String(branch || '');
    if (!b || b.length > 200 || /\.\.|[\s~^:?*[\\]|@\{|^\/|\/$|\.lock$|^-/.test(b)) throw new GitHubError(`"${b}" is not a valid branch name`, 400, 'BAD_REQUEST');
    return b;
}

// A repo folder: "" for the root, otherwise "a/b" with no leading or trailing slash.
function cleanFolder(path) {
    const segments = String(path || '').replace(/\\/g, '/').split('/').filter(Boolean);
    if (segments.some((s) => s === '.' || s === '..')) throw new GitHubError('Folder paths cannot contain . or ..', 400, 'BAD_REQUEST');
    return segments.join('/');
}

// A project file path as a path relative to the project root ("src/app.js").
const relative = (path) => String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
const encodeRef = (branch) => branch.split('/').map(encodeURIComponent).join('/');
const repoPath = (owner, repo) => `/repos/${owner}/${repo}`;

// The SHA git gives a file's content, so local files can be compared with a tree
// without downloading anything.
const blobSha = (content) => {
    const buf = Buffer.from(content, 'utf8');
    return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
};

// Local files as Map(relative path -> content), directories and bad paths left out.
function localMap(files) {
    const map = new Map();
    for (const f of Array.isArray(files) ? files : []) {
        if (!f || f.isDirectory || f.is_directory) continue;
        const rel = relative(f.path || f.name);
        if (!rel || rel.split('/').some((s) => s === '.' || s === '..')) continue;
        map.set(rel, String(f.content ?? ''));
    }
    return map;
}

// ---- Repository reads -------------------------------------------------------

async function listRepos(token) {
    const repos = await gh(token, 'GET', '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member');
    return repos.map((r) => ({
        owner: r.owner.login,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
        canPush: Boolean(r.permissions && r.permissions.push),
        updatedAt: r.pushed_at || r.updated_at,
    }));
}

async function listBranches(token, owner, repo) {
    checkRepo(owner, repo);
    const [info, branches] = await Promise.all([
        gh(token, 'GET', repoPath(owner, repo)),
        gh(token, 'GET', `${repoPath(owner, repo)}/branches?per_page=100`),
    ]);
    return { defaultBranch: info.default_branch, branches: branches.map((b) => b.name) };
}

// Head commit of a branch: { sha } / { sha: null } if the branch doesn't exist / { empty: true } for a repo with no commits.
async function branchHead(token, owner, repo, branch) {
    try {
        const ref = await gh(token, 'GET', `${repoPath(owner, repo)}/git/ref/heads/${encodeRef(branch)}`);
        return { sha: ref.object.sha };
    } catch (err) {
        if (err.status === 404) return { sha: null };
        if (err.status === 409) return { sha: null, empty: true };
        throw err;
    }
}

// Blobs under `folder` in a commit: Map(path relative to folder -> { sha, mode, size }).
// The folder is found one level at a time, so only its own subtree is read recursively.
async function treeAt(token, owner, repo, commitSha, folder) {
    const commit = await gh(token, 'GET', `${repoPath(owner, repo)}/git/commits/${commitSha}`);
    let sha = commit.tree.sha;
    for (const segment of folder ? folder.split('/') : []) {
        const level = await gh(token, 'GET', `${repoPath(owner, repo)}/git/trees/${sha}`);
        const next = level.tree.find((e) => e.type === 'tree' && e.path === segment);
        // A folder that doesn't exist (yet) is just empty.
        if (!next) return { treeSha: commit.tree.sha, files: new Map() };
        sha = next.sha;
    }
    const tree = await gh(token, 'GET', `${repoPath(owner, repo)}/git/trees/${sha}?recursive=1`);
    if (tree.truncated) throw new GitHubError('This folder is too large to read in one go. Pick a smaller folder.', 413, 'TOO_LARGE');
    const map = new Map();
    for (const e of tree.tree) {
        if (e.type === 'blob') map.set(e.path, { sha: e.sha, mode: e.mode, size: e.size });
    }
    return { treeSha: commit.tree.sha, files: map };
}

// Folders in a branch, for the import path picker.
async function listFolders(token, owner, repo, branch) {
    checkRepo(owner, repo);
    const head = await branchHead(token, owner, repo, checkBranch(branch));
    if (!head.sha) return [];
    const commit = await gh(token, 'GET', `${repoPath(owner, repo)}/git/commits/${head.sha}`);
    const tree = await gh(token, 'GET', `${repoPath(owner, repo)}/git/trees/${commit.tree.sha}?recursive=1`);
    return tree.tree.filter((e) => e.type === 'tree').map((e) => e.path).slice(0, 2000);
}

// Text content of a blob, or null for a binary file.
async function readBlob(token, owner, repo, sha) {
    const blob = await gh(token, 'GET', `${repoPath(owner, repo)}/git/blobs/${sha}`);
    const buf = Buffer.from(blob.content || '', blob.encoding === 'base64' ? 'base64' : 'utf8');
    if (buf.includes(0)) return null;
    return buf.toString('utf8');
}

// Run `fn` over `items` a few at a time (GitHub frowns on large bursts).
async function inBatches(items, fn, size = 8) {
    const out = [];
    for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
    return out;
}

// Text files under `folder` on `branch`, ready to store as project files.
async function readFolder(token, { owner, repo, branch, path }) {
    checkRepo(owner, repo);
    checkBranch(branch);
    const folder = cleanFolder(path);
    const head = await branchHead(token, owner, repo, branch);
    if (!head.sha) throw new GitHubError(head.empty ? 'This repository is empty' : `Branch "${branch}" was not found`, 404, 'NOT_FOUND');
    const { files: tree } = await treeAt(token, owner, repo, head.sha, folder);
    if (!tree.size) throw new GitHubError(folder ? `No files under "${folder}"` : 'No files on this branch', 404, 'NOT_FOUND');
    const skipped = [];
    const wanted = [];
    for (const [rel, entry] of tree) {
        if (entry.size > MAX_FILE_BYTES) skipped.push({ path: rel, reason: 'larger than 1 MB' });
        else if (entry.mode === '120000' || entry.mode === '160000') skipped.push({ path: rel, reason: 'link or submodule' });
        else if (wanted.length >= MAX_FILES) skipped.push({ path: rel, reason: `over ${MAX_FILES} files` });
        else wanted.push([rel, entry]);
    }
    const read = await inBatches(wanted, async ([rel, entry]) => ({ path: rel, content: await readBlob(token, owner, repo, entry.sha) }));
    const files = [];
    for (const f of read) {
        if (f.content == null) skipped.push({ path: f.path, reason: 'binary' });
        else files.push(f);
    }
    return { headSha: head.sha, folder, files, skipped };
}

// ---- Writing: one commit through the git data API ---------------------------

// Commit `changes` ([{ path, content } | { path, delete: true }], repo-relative paths) on
// top of `parentSha`, then move the branch to it. Returns the new commit, or null when
// the tree would not change.
async function commitChanges(token, { owner, repo, branch, parentSha, message, changes, modes = new Map(), createRef = false }) {
    const parent = await gh(token, 'GET', `${repoPath(owner, repo)}/git/commits/${parentSha}`);
    const tree = await gh(token, 'POST', `${repoPath(owner, repo)}/git/trees`, {
        base_tree: parent.tree.sha,
        tree: changes.map((c) => (c.delete
            ? { path: c.path, mode: modes.get(c.path) || '100644', type: 'blob', sha: null }
            : { path: c.path, mode: modes.get(c.path) || '100644', type: 'blob', content: c.content })),
    });
    if (tree.sha === parent.tree.sha) return null;
    const commit = await gh(token, 'POST', `${repoPath(owner, repo)}/git/commits`, { message, tree: tree.sha, parents: [parentSha] });
    if (createRef) {
        await gh(token, 'POST', `${repoPath(owner, repo)}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
    } else {
        try {
            await gh(token, 'PATCH', `${repoPath(owner, repo)}/git/refs/heads/${encodeRef(branch)}`, { sha: commit.sha, force: false });
        } catch (err) {
            if (err.status === 422) throw new GitHubError(`"${branch}" moved on GitHub while committing. Try again.`, 409, 'BRANCH_MOVED');
            throw err;
        }
    }
    return { sha: commit.sha, url: `https://github.com/${owner}/${repo}/commit/${commit.sha}` };
}

// Push files to a new or existing repo as one commit. `files` are { path, content } with
// paths relative to `folder` in the repo.
async function pushFiles(token, { owner, repo, branch, message, folder: rawFolder, files, createRepo }) {
    const folder = cleanFolder(rawFolder);
    const local = localMap(files);
    if (!local.size) throw new GitHubError('There are no files to push', 400, 'BAD_REQUEST');
    if (local.size > MAX_FILES) throw new GitHubError(`At most ${MAX_FILES} files per push`, 413, 'TOO_LARGE');
    const msg = String(message || '').trim() || 'Update from Utkristi CoLabs';

    if (createRepo) {
        if (!NAME.test(createRepo.name || '')) throw new GitHubError('Repository names use letters, digits, ".", "-" and "_"', 400, 'BAD_REQUEST');
        // auto_init gives the repo a first commit, so the git data API has something to build on.
        const made = await gh(token, 'POST', '/user/repos', {
            name: createRepo.name,
            private: createRepo.private !== false,
            description: String(createRepo.description || '').slice(0, 300),
            auto_init: true,
        });
        owner = made.owner.login;
        repo = made.name;
        branch = branch || made.default_branch;
    }
    checkRepo(owner, repo);
    checkBranch(branch);

    const changes = [...local].map(([rel, content]) => ({ path: folder ? `${folder}/${rel}` : rel, content }));
    let head = await branchHead(token, owner, repo, branch);
    let createRef = false;

    if (head.empty) {
        // The git data API can't write to a repository with no commits; the contents API
        // can, so the first file creates the branch and the rest follow in one commit.
        const [first, ...rest] = changes;
        const made = await gh(token, 'PUT', `${repoPath(owner, repo)}/contents/${first.path.split('/').map(encodeURIComponent).join('/')}`, {
            message: msg,
            content: Buffer.from(first.content, 'utf8').toString('base64'),
            branch,
        });
        if (!rest.length) return { owner, repo, branch, sha: made.commit.sha, url: made.commit.html_url };
        changes.splice(0, changes.length, ...rest);
        head = { sha: made.commit.sha };
    } else if (!head.sha) {
        // A new branch starts from the default branch.
        const info = await gh(token, 'GET', repoPath(owner, repo));
        const base = await branchHead(token, owner, repo, info.default_branch);
        if (!base.sha) throw new GitHubError(`The default branch "${info.default_branch}" has no commits`, 409, 'NOT_FOUND');
        head = base;
        createRef = true;
    }

    // Keep the mode (e.g. executable) of files that already exist.
    const { files: existing } = await treeAt(token, owner, repo, head.sha, folder);
    const modes = new Map([...existing].map(([p, e]) => [folder ? `${folder}/${p}` : p, e.mode]));
    const commit = await commitChanges(token, { owner, repo, branch, parentSha: head.sha, message: msg, changes, modes, createRef });
    if (!commit) return { owner, repo, branch, sha: head.sha, unchanged: true, url: `https://github.com/${owner}/${repo}/tree/${encodeRef(branch)}` };
    return { owner, repo, branch, ...commit };
}

// ---- Two-way sync -------------------------------------------------------------

const stateOf = (before, after) => (before === after ? null : !before ? 'added' : !after ? 'deleted' : 'modified');

// Compare the project (local), the last agreed commit (base) and the branch head (remote).
async function syncStatus(token, link, files) {
    const { owner, repo, branch, path: folder, base_sha: baseSha } = link;
    const head = await branchHead(token, owner, repo, branch);
    if (!head.sha) throw new GitHubError(`Branch "${branch}" no longer exists on GitHub`, 404, 'NOT_FOUND');
    const [base, remote] = await Promise.all([
        treeAt(token, owner, repo, baseSha, folder),
        head.sha === baseSha ? null : treeAt(token, owner, repo, head.sha, folder),
    ]);
    const remoteFiles = remote ? remote.files : base.files;
    const local = localMap(files);
    const localShas = new Map([...local].map(([p, c]) => [p, blobSha(c)]));
    const skipped = new Set(Array.isArray(link.skipped) ? link.skipped : []);
    const paths = new Set([...base.files.keys(), ...remoteFiles.keys(), ...localShas.keys()]);
    const changes = [];
    for (const path of [...paths].sort()) {
        // A repo file the project can't hold (binary, too large) is left alone on both sides.
        if (skipped.has(path) && !localShas.has(path)) continue;
        const b = base.files.get(path)?.sha;
        const r = remoteFiles.get(path)?.sha;
        const l = localShas.get(path);
        const localState = stateOf(b, l);
        const remoteState = stateOf(b, r);
        if (!localState && !remoteState) continue;
        // Both sides changed the file the same way: nothing to resolve.
        const same = l === r;
        changes.push({ path, local: same ? null : localState, remote: same ? null : remoteState, conflict: Boolean(localState && remoteState && !same), same });
    }
    return {
        baseSha,
        headSha: head.sha,
        changes: changes.filter((c) => !c.same).map(({ same, ...c }) => c),
        settled: changes.filter((c) => c.same).map((c) => c.path),
        modes: new Map([...remoteFiles].map(([p, e]) => [p, e.mode])),
        remoteFiles,
        local,
    };
}

// Remote changes to apply to the project. Without `resolve`, conflicts stop the pull;
// "theirs" takes GitHub's version, "mine" keeps the project's.
async function planPull(token, link, status, resolve) {
    const conflicts = status.changes.filter((c) => c.conflict);
    if (conflicts.length && !['mine', 'theirs'].includes(resolve)) {
        throw Object.assign(new GitHubError(`${conflicts.length} file${conflicts.length === 1 ? '' : 's'} changed on both sides`, 409, 'CONFLICT'), { conflicts: conflicts.map((c) => c.path) });
    }
    const take = status.changes.filter((c) => c.remote && (!c.conflict || resolve === 'theirs'));
    const writes = [];
    const deletes = [];
    const skipped = [];
    await inBatches(take, async (c) => {
        const entry = status.remoteFiles.get(c.path);
        if (!entry) { deletes.push(c.path); return; }
        if (entry.size > MAX_FILE_BYTES) { skipped.push({ path: c.path, reason: 'larger than 1 MB' }); return; }
        const content = await readBlob(token, link.owner, link.repo, entry.sha);
        if (content == null) skipped.push({ path: c.path, reason: 'binary' });
        else writes.push({ path: c.path, content });
    });
    return { writes, deletes, skipped, kept: conflicts.filter(() => resolve === 'mine').map((c) => c.path) };
}

// Commit the project's changes. Refuses while GitHub has changes the project hasn't pulled.
async function pushSync(token, link, status, message) {
    if (status.changes.some((c) => c.remote)) {
        throw new GitHubError('GitHub has changes you have not pulled yet. Pull first, then commit.', 409, 'PULL_FIRST');
    }
    const prefix = link.path ? `${link.path}/` : '';
    const changes = status.changes.filter((c) => c.local).map((c) => (c.local === 'deleted'
        ? { path: prefix + c.path, delete: true }
        : { path: prefix + c.path, content: status.local.get(c.path) }));
    if (!changes.length) return { sha: status.headSha, unchanged: true };
    const modes = new Map([...status.modes].map(([p, m]) => [prefix + p, m]));
    const commit = await commitChanges(token, {
        owner: link.owner,
        repo: link.repo,
        branch: link.branch,
        parentSha: status.headSha,
        message: String(message || '').trim() || 'Update from Utkristi CoLabs',
        changes,
        modes,
    });
    return commit || { sha: status.headSha, unchanged: true };
}

// ---- Gists ----------------------------------------------------------------------

async function createGist(token, { description, isPublic, files }) {
    const list = (Array.isArray(files) ? files : []).filter((f) => f && String(f.content || '').trim());
    if (!list.length) throw new GitHubError('There is no code to share', 400, 'BAD_REQUEST');
    const out = {};
    for (const f of list.slice(0, MAX_FILES)) {
        // Gist file names can't contain "/": keep the path readable with "__".
        let name = relative(f.name || f.path).replace(/\//g, '__').replace(/[^A-Za-z0-9._-]/g, '_') || 'snippet.txt';
        while (out[name]) name = `_${name}`;
        out[name] = { content: String(f.content) };
    }
    const gist = await gh(token, 'POST', '/gists', {
        description: String(description || '').trim() || 'Shared from Utkristi CoLabs',
        public: Boolean(isPublic),
        files: out,
    });
    return { id: gist.id, url: gist.html_url };
}

module.exports = {
    GitHubError,
    MAX_FILES,
    configured,
    makeState,
    readState,
    safeReturnTo,
    authorizeUrl,
    exchangeCode,
    revokeGrant,
    checkRepo,
    checkBranch,
    cleanFolder,
    listRepos,
    listBranches,
    listFolders,
    branchHead,
    readFolder,
    pushFiles,
    syncStatus,
    planPull,
    pushSync,
    createGist,
};
