// Language packs: official portable toolchains, downloaded once into the app's data folder
// (never system-wide) so the built-in runner can use them offline afterwards.
//
// Each pack resolves its download from the project's own release feed at install time:
//   Go (go.dev), Java (Adoptium Temurin), Kotlin (JetBrains), C/C++ on Windows (WinLibs GCC),
//   PHP on Windows (windows.php.net), Bash on Windows (BusyBox), Rust (rustup, GNU toolchain).
const fs = require("fs");
const fsp = fs.promises;
const os = require("os");
const path = require("path");
const { execFile, spawn } = require("child_process");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";
const arch = process.arch === "arm64" ? "arm64" : "x64";
let ROOT = path.join(os.homedir(), ".colabs-packs"); // replaced by the app's data folder at startup
const setRoot = (dir) => { ROOT = dir; };

const getJson = async (url) => {
    const res = await fetch(url, { headers: { "user-agent": "utkristi-colabs-desktop", accept: "application/json" } });
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
    return res.json();
};
const ghAsset = async (repo, test) => {
    const rel = await getJson(`https://api.github.com/repos/${repo}/releases/latest`);
    const a = (rel.assets || []).find((x) => test(x.name));
    if (!a) throw new Error(`No download found in ${repo} ${rel.tag_name}`);
    return { url: a.browser_download_url, size: a.size, version: rel.tag_name.replace(/^v/, "") };
};

// id -> { label, langs, platforms, approx size, resolve() -> { url, size, version, kind }, bins(dir) }
const PACKS = {
    go: {
        label: "Go", langs: ["go"], approx: "75 MB",
        resolve: async () => {
            const rel = (await getJson("https://go.dev/dl/?mode=json"))[0];
            const os_ = isWin ? "windows" : isMac ? "darwin" : "linux";
            const f = rel.files.find((x) => x.kind === "archive" && x.os === os_ && x.arch === (arch === "arm64" ? "arm64" : "amd64"));
            if (!f) throw new Error("No Go download for this computer");
            return { url: `https://go.dev/dl/${f.filename}`, size: f.size, version: rel.version.replace(/^go/, ""), kind: f.filename.endsWith(".zip") ? "zip" : "tar.gz" };
        },
        bins: (dir) => [path.join(dir, "go", "bin")],
    },
    java: {
        label: "Java (JDK 21)", langs: ["java", "kotlin"], approx: "200 MB",
        resolve: async () => {
            const os_ = isWin ? "windows" : isMac ? "mac" : "linux";
            const list = await getJson(`https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=${arch === "arm64" ? "aarch64" : "x64"}&image_type=jdk&os=${os_}&vendor=eclipse`);
            const pkg = list[0]?.binary?.package;
            if (!pkg) throw new Error("No JDK download for this computer");
            return { url: pkg.link, size: pkg.size, version: list[0].version?.semver || "21", kind: pkg.name.endsWith(".zip") ? "zip" : "tar.gz" };
        },
        bins: (dir) => {
            const top = fs.readdirSync(dir).find((d) => /^jdk/i.test(d));
            if (!top) return [];
            return [isMac ? path.join(dir, top, "Contents", "Home", "bin") : path.join(dir, top, "bin")];
        },
    },
    kotlin: {
        label: "Kotlin compiler", langs: ["kotlin"], approx: "90 MB", needs: "java",
        resolve: async () => ({ ...(await ghAsset("JetBrains/kotlin", (n) => /^kotlin-compiler-[\d.]+\.zip$/.test(n))), kind: "zip" }),
        bins: (dir) => [path.join(dir, "kotlinc", "bin")],
    },
    gcc: {
        label: "C and C++ (GCC)", langs: ["c", "cpp"], approx: "280 MB", platforms: ["win32"],
        resolve: async () => ({ ...(await ghAsset("brechtsanders/winlibs_mingw", (n) => /x86_64-posix-seh.*ucrt.*\.zip$/.test(n) && !/llvm/i.test(n))), kind: "zip" }),
        bins: (dir) => [path.join(dir, "mingw64", "bin")],
    },
    php: {
        label: "PHP", langs: ["php"], approx: "35 MB", platforms: ["win32"],
        resolve: async () => {
            const all = await getJson("https://windows.php.net/downloads/releases/releases.json");
            const branch = Object.keys(all).sort((a, b) => parseFloat(b) - parseFloat(a))[0];
            const rel = all[branch];
            const entry = Object.entries(rel).find(([k, v]) => /^nts-.*x64$/.test(k) && v?.zip?.path);
            if (!entry) throw new Error("No PHP download found");
            return { url: `https://windows.php.net/downloads/releases/${entry[1].zip.path}`, version: rel.version, kind: "zip" };
        },
        bins: (dir) => [dir],
    },
    bash: {
        label: "Bash (BusyBox)", langs: ["bash"], approx: "1 MB", platforms: ["win32"],
        resolve: async () => ({ url: "https://frippery.org/files/busybox/busybox64.exe", version: "latest", kind: "exe", as: "bash.exe" }),
        bins: (dir) => [dir],
    },
    rust: {
        label: "Rust", langs: ["rust"], approx: "100 MB",
        resolve: async () => {
            const triple = isWin ? "x86_64-pc-windows-gnu" : isMac ? `${arch === "arm64" ? "aarch64" : "x86_64"}-apple-darwin` : `${arch === "arm64" ? "aarch64" : "x86_64"}-unknown-linux-gnu`;
            return { url: `https://static.rust-lang.org/rustup/dist/${triple}/rustup-init${isWin ? ".exe" : ""}`, version: "stable", kind: "rustup", triple };
        },
        bins: (dir) => [path.join(dir, "cargo", "bin")],
    },
};

const available = () => Object.entries(PACKS)
    .filter(([, p]) => !p.platforms || p.platforms.includes(process.platform))
    .map(([id, p]) => ({ id, label: p.label, langs: p.langs, approx: p.approx, needs: p.needs || null }));

const manifestPath = () => path.join(ROOT, "packs.json");
function installed() {
    try { return JSON.parse(fs.readFileSync(manifestPath(), "utf8")) || {}; } catch { return {}; }
}
function saveManifest(m) {
    fs.mkdirSync(ROOT, { recursive: true });
    fs.writeFileSync(manifestPath(), JSON.stringify(m, null, 2));
}
// Folders the runner should search, from installed packs that still exist on disk.
const binDirs = () => Object.values(installed()).flatMap((p) => p.bins || []).filter((d) => { try { return fs.statSync(d).isDirectory(); } catch { return false; } });

const run = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 16 * 1024 * 1024, ...opts }, (err, stdout, stderr) => (err ? reject(new Error(String(stderr || err.message).slice(0, 400))) : resolve(stdout)));
});

async function download(url, file, onProgress) {
    const res = await fetch(url, { headers: { "user-agent": "utkristi-colabs-desktop" }, redirect: "follow" });
    if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
    const total = Number(res.headers.get("content-length")) || 0;
    let done = 0;
    let lastTick = 0;
    const body = Readable.fromWeb(res.body);
    body.on("data", (chunk) => {
        done += chunk.length;
        const now = Date.now();
        if (now - lastTick > 250) { lastTick = now; onProgress?.({ phase: "download", done, total }); }
    });
    await pipeline(body, fs.createWriteStream(file));
    onProgress?.({ phase: "download", done, total: total || done });
}

const installing = new Map(); // id -> promise

async function install(id, onProgress) {
    const pack = PACKS[id];
    if (!pack || (pack.platforms && !pack.platforms.includes(process.platform))) throw new Error("This pack isn't available for this computer");
    if (installing.has(id)) return installing.get(id);
    const job = (async () => {
        if (pack.needs && !installed()[pack.needs]) await install(pack.needs, onProgress);
        const target = await pack.resolve();
        const dir = path.join(ROOT, id);
        const tmp = path.join(ROOT, `.${id}-download`);
        await fsp.rm(dir, { recursive: true, force: true });
        await fsp.mkdir(dir, { recursive: true });
        await fsp.mkdir(ROOT, { recursive: true });
        onProgress?.({ phase: "download", done: 0, total: target.size || 0 });

        if (target.kind === "exe") {
            await download(target.url, path.join(dir, target.as), onProgress);
        } else if (target.kind === "rustup") {
            const init = path.join(dir, isWin ? "rustup-init.exe" : "rustup-init");
            await download(target.url, init, onProgress);
            if (!isWin) await fsp.chmod(init, 0o755);
            onProgress?.({ phase: "install" });
            await run(init, ["-y", "--no-modify-path", "--profile", "minimal", "--default-toolchain", "stable", "--default-host", target.triple], {
                env: { ...process.env, RUSTUP_HOME: path.join(dir, "rustup"), CARGO_HOME: path.join(dir, "cargo") },
                timeout: 20 * 60 * 1000,
            });
        } else {
            const archive = `${tmp}.${target.kind === "zip" ? "zip" : "tar.gz"}`;
            await download(target.url, archive, onProgress);
            onProgress?.({ phase: "extract" });
            if (target.kind === "zip") await require("extract-zip")(archive, { dir });
            else await run("tar", ["-xzf", archive, "-C", dir], { timeout: 10 * 60 * 1000 });
            await fsp.rm(archive, { force: true });
        }

        const m = installed();
        m[id] = { version: target.version, bins: pack.bins(dir), at: new Date().toISOString(), langs: pack.langs };
        saveManifest(m);
        onProgress?.({ phase: "done" });
        return { ok: true, version: target.version };
    })();
    installing.set(id, job);
    try {
        return await job;
    } catch (err) {
        await fsp.rm(path.join(ROOT, id), { recursive: true, force: true }).catch(() => { });
        throw err;
    } finally {
        installing.delete(id);
    }
}

async function remove(id) {
    if (!PACKS[id]) throw new Error("Unknown pack");
    await fsp.rm(path.join(ROOT, id), { recursive: true, force: true });
    const m = installed();
    delete m[id];
    saveManifest(m);
    return { ok: true };
}

// macOS: the C/C++ compilers come with Apple's Command Line Tools (opens Apple's installer).
function installAppleTools() {
    if (!isMac) return { ok: false };
    spawn("xcode-select", ["--install"], { detached: true, stdio: "ignore" }).unref();
    return { ok: true };
}

module.exports = { setRoot, available, installed, binDirs, install, remove, installAppleTools };
