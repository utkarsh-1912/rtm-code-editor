// Opening files and folders from disk, VS Code style, and writing them back.
// The page never gets raw file system access: it can only read what the user picks in a
// native dialog, and only write inside folders the user picked ("allowed roots").
// Allowed roots are remembered in userData so "Save to disk" still works after a restart.
const { app, dialog } = require("electron");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");

const SKIP_DIRS = new Set([".git", ".hg", ".svn", "node_modules", "dist", "build", "out", ".next", ".nuxt", ".cache", "__pycache__", "venv", ".venv", "env", "target", "bin", "obj", ".idea", ".vscode", "coverage", ".gradle"]);
const MAX_FILES = 500;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const rootsFile = () => path.join(app.getPath("userData"), "allowed-roots.json");
let roots = null;

function loadRoots() {
    if (roots) return roots;
    try {
        roots = new Set(JSON.parse(fs.readFileSync(rootsFile(), "utf8")).filter((r) => typeof r === "string"));
    } catch {
        roots = new Set();
    }
    return roots;
}

function allowRoot(dir) {
    const set = loadRoots();
    set.add(path.resolve(dir));
    try {
        fs.mkdirSync(path.dirname(rootsFile()), { recursive: true });
        fs.writeFileSync(rootsFile(), JSON.stringify([...set].slice(-100)));
    } catch {
        /* still allowed for this session */
    }
}

const inside = (root, target) => {
    const rel = path.relative(root, target);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

// Root the path belongs to, or null.
function allowedRootFor(target) {
    const abs = path.resolve(String(target || ""));
    for (const r of loadRoots()) if (inside(r, abs)) return r;
    return null;
}

// Binary check: a NUL byte in the first 8 KB.
const isText = (buf) => !buf.subarray(0, 8192).includes(0);

async function readTree(root) {
    const files = [];
    const skipped = { large: 0, binary: 0, limit: 0 };
    let total = 0;
    const walk = async (dir) => {
        let entries;
        try {
            entries = await fsp.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const e of entries) {
            const abs = path.join(dir, e.name);
            if (e.isSymbolicLink()) continue;
            if (e.isDirectory()) {
                if (!SKIP_DIRS.has(e.name)) await walk(abs);
                continue;
            }
            if (!e.isFile()) continue;
            if (files.length >= MAX_FILES) { skipped.limit++; continue; }
            const stat = await fsp.stat(abs).catch(() => null);
            if (!stat || stat.size > MAX_FILE_BYTES) { skipped.large++; continue; }
            if (total + stat.size > MAX_TOTAL_BYTES) { skipped.limit++; continue; }
            const buf = await fsp.readFile(abs).catch(() => null);
            if (!buf) continue;
            if (!isText(buf)) { skipped.binary++; continue; }
            total += stat.size;
            files.push({ path: path.relative(root, abs).split(path.sep).join("/"), content: buf.toString("utf8") });
        }
    };
    await walk(root);
    return { files, skipped, bytes: total };
}

function createFsAccess(getWin) {
    const parent = () => {
        const w = getWin();
        return w && !w.isDestroyed() ? w : undefined;
    };

    async function openFolder() {
        const r = await dialog.showOpenDialog(parent(), { title: "Open folder", properties: ["openDirectory"] });
        if (r.canceled || !r.filePaths[0]) return null;
        const root = path.resolve(r.filePaths[0]);
        allowRoot(root);
        return { root, name: path.basename(root), ...(await readTree(root)) };
    }

    async function openFiles() {
        const r = await dialog.showOpenDialog(parent(), { title: "Open files", properties: ["openFile", "multiSelections"] });
        if (r.canceled || !r.filePaths.length) return null;
        const files = [];
        const skipped = { large: 0, binary: 0, limit: 0 };
        for (const abs of r.filePaths.slice(0, MAX_FILES)) {
            const stat = await fsp.stat(abs).catch(() => null);
            if (!stat || stat.size > MAX_FILE_BYTES) { skipped.large++; continue; }
            const buf = await fsp.readFile(abs).catch(() => null);
            if (!buf || !isText(buf)) { skipped.binary++; continue; }
            files.push({ path: path.basename(abs), content: buf.toString("utf8") });
        }
        // Saving back goes to the folder the files came from.
        const root = path.dirname(path.resolve(r.filePaths[0]));
        allowRoot(root);
        return { root, name: path.basename(r.filePaths[0]), files, skipped };
    }

    async function pickSaveFolder() {
        const r = await dialog.showOpenDialog(parent(), { title: "Save project to folder", properties: ["openDirectory", "createDirectory"] });
        if (r.canceled || !r.filePaths[0]) return null;
        const root = path.resolve(r.filePaths[0]);
        allowRoot(root);
        return { root, name: path.basename(root) };
    }

    // files: [{ path, content }] relative to root. Refuses anything outside an allowed root.
    async function writeFiles({ root, files }) {
        const base = path.resolve(String(root || ""));
        if (!root || !allowedRootFor(base)) throw new Error("That folder was not opened in this app. Pick it again with Save to disk.");
        if (!Array.isArray(files)) throw new Error("No files");
        let written = 0;
        for (const f of files.slice(0, MAX_FILES)) {
            const target = path.resolve(base, String(f.path || "").replace(/^[\\/]+/, ""));
            if (!inside(base, target) || target === base) throw new Error(`Refusing to write outside the folder: ${f.path}`);
            // Never into VCS metadata (e.g. .git/hooks would run code on the next commit).
            if (path.relative(base, target).split(path.sep).some((seg) => /^\.(git|hg|svn)$/i.test(seg))) continue;
            const content = String(f.content ?? "");
            if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error(`${f.path} is larger than 1 MB`);
            await fsp.mkdir(path.dirname(target), { recursive: true });
            await fsp.writeFile(target, content, "utf8");
            written++;
        }
        return { written, root: base };
    }

    // Terminals may start in an allowed root or the home folder, nowhere else.
    function resolveCwd(cwd) {
        if (cwd) {
            const abs = path.resolve(String(cwd));
            if (allowedRootFor(abs) && fs.existsSync(abs)) return abs;
        }
        return os.homedir();
    }

    return { openFolder, openFiles, pickSaveFolder, writeFiles, resolveCwd };
}

module.exports = { createFsAccess, readTree, allowedRootFor, SKIP_DIRS };
