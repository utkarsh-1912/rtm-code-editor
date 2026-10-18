// Opening files and folders from disk into a project, and saving a project back.
// Desktop app: native dialogs through window.colabsDesktop (can also write back and open a
// terminal in that folder). Browser: a folder/file <input>; read-only, no save-back.
import { getBackendUrl } from "./api";
import { languageForFile } from "./languages";

const SKIP_DIRS = new Set([".git", ".hg", ".svn", "node_modules", "dist", "build", "out", ".next", ".nuxt", ".cache", "__pycache__", "venv", ".venv", "env", "target", "bin", "obj", ".idea", ".vscode", "coverage", ".gradle"]);
const MAX_FILES = 500;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const ROOTS_KEY = "colabs-project-roots";

const desktop = () => (typeof window !== "undefined" ? window.colabsDesktop : null);
export const canWriteToDisk = () => !!desktop()?.writeFiles;
export const canOpenTerminal = () => !!desktop()?.openTerminal;

// ---- reading -------------------------------------------------------------------------

function chooseInBrowser({ folder }) {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        if (folder) input.webkitdirectory = true;
        input.style.display = "none";
        let settled = false;
        const done = (list) => {
            if (settled) return;
            settled = true;
            input.remove();
            resolve(list);
        };
        input.addEventListener("change", () => done(Array.from(input.files || [])));
        input.addEventListener("cancel", () => done([]));
        document.body.appendChild(input);
        input.click();
    });
}

async function readBrowserFiles(list, { folder }) {
    const files = [];
    const skipped = { large: 0, binary: 0, limit: 0 };
    let total = 0;
    let name = "";
    for (const f of list) {
        const rel = (folder && f.webkitRelativePath) || f.name;
        const parts = rel.split("/");
        if (folder) {
            name = name || parts[0];
            parts.shift(); // drop the picked folder's own name
        }
        if (parts.slice(0, -1).some((p) => SKIP_DIRS.has(p))) continue;
        if (files.length >= MAX_FILES) { skipped.limit++; continue; }
        if (f.size > MAX_FILE_BYTES) { skipped.large++; continue; }
        if (total + f.size > MAX_TOTAL_BYTES) { skipped.limit++; continue; }
        const head = new Uint8Array(await f.slice(0, 8192).arrayBuffer());
        if (head.includes(0)) { skipped.binary++; continue; }
        total += f.size;
        files.push({ path: parts.join("/"), content: await f.text() });
    }
    return { root: null, name: name || list[0]?.name || "Imported", files, skipped };
}

// Returns { root, name, files: [{ path, content }], skipped } or null if cancelled.
export async function pickFolder() {
    if (desktop()?.openFolder) return desktop().openFolder();
    const list = await chooseInBrowser({ folder: true });
    return list.length ? readBrowserFiles(list, { folder: true }) : null;
}

export async function pickFiles() {
    if (desktop()?.openFiles) return desktop().openFiles();
    const list = await chooseInBrowser({ folder: false });
    return list.length ? readBrowserFiles(list, { folder: false }) : null;
}

export function describeSkipped(skipped = {}) {
    const parts = [];
    if (skipped.binary) parts.push(`${skipped.binary} binary`);
    if (skipped.large) parts.push(`${skipped.large} over 1 MB`);
    if (skipped.limit) parts.push(`${skipped.limit} over the limit`);
    return parts.length ? `Skipped ${parts.join(", ")}.` : "";
}

// "web" when there is an index.html, otherwise the most common runnable language.
export function detectProjectType(files) {
    if (files.some((f) => /(^|\/)index\.html?$/i.test(f.path))) return "web";
    const counts = {};
    for (const f of files) {
        const id = languageForFile(f.path);
        if (id) counts[id] = (counts[id] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : "web";
}

// ---- uploading -----------------------------------------------------------------------

// Uploads in chunks that stay well under the server's 10 MB / 300 files per request.
export async function uploadFiles(projectId, files, onProgress) {
    const chunks = [];
    let cur = [];
    let bytes = 0;
    for (const f of files) {
        const size = f.content.length * 2 + f.path.length;
        if (cur.length && (cur.length >= 150 || bytes + size > 4 * 1024 * 1024)) {
            chunks.push(cur);
            cur = [];
            bytes = 0;
        }
        cur.push(f);
        bytes += size;
    }
    if (cur.length) chunks.push(cur);

    let done = 0;
    const saved = [];
    for (const chunk of chunks) {
        const res = await fetch(`${getBackendUrl()}/api/projects/${projectId}/files/bulk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: chunk }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Upload failed (${res.status})`);
        }
        const data = await res.json();
        saved.push(...(data.files || []));
        done += chunk.length;
        onProgress?.(done, files.length);
    }
    return saved;
}

export async function importProject({ userId, picked, onProgress }) {
    const type = detectProjectType(picked.files);
    const res = await fetch(`${getBackendUrl()}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: picked.name || "Imported project", description: picked.root ? `Opened from ${picked.root}` : "Imported from disk", type, empty: true }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(res.status === 402 && data.error ? data.error : "Could not create the project");
    }
    const project = await res.json();
    await uploadFiles(project.id, picked.files, onProgress);
    if (picked.root) linkRoot(project.id, picked.root);
    return project;
}

// ---- project <-> folder on this device ----------------------------------------------------

function readRoots() {
    try {
        return JSON.parse(localStorage.getItem(ROOTS_KEY)) || {};
    } catch {
        return {};
    }
}

export function linkRoot(projectId, root) {
    try {
        localStorage.setItem(ROOTS_KEY, JSON.stringify({ ...readRoots(), [projectId]: root }));
    } catch {
        /* storage blocked: save-back will ask for a folder */
    }
}

export const rootFor = (projectId) => readRoots()[projectId] || null;

// Writes project files into the linked folder (asks for one the first time).
export async function saveToDisk(projectId, files, { chooseFolder = false } = {}) {
    const d = desktop();
    if (!d?.writeFiles) throw new Error("Saving to disk needs the desktop app");
    let root = chooseFolder ? null : rootFor(projectId);
    if (!root) {
        const picked = await d.pickSaveFolder();
        if (!picked) return null;
        root = picked.root;
        linkRoot(projectId, root);
    }
    const payload = files.filter((f) => !f.is_directory && !f.isDirectory).map((f) => ({ path: String(f.path || f.name).replace(/^[\\/]+/, ""), content: f.content || "" }));
    return d.writeFiles({ root, files: payload });
}

export function openTerminal(projectId, title) {
    return desktop()?.openTerminal?.({ cwd: projectId ? rootFor(projectId) : null, title });
}
