// Built-in code runner for the desktop app, like running code in VS Code: it uses the
// compilers and interpreters installed on this computer, in a throwaway folder, with a time
// limit and an output cap. JavaScript always works (the app ships its own Node). Nothing
// leaves the machine, and it works offline.
//
// It is NOT a sandbox: code runs as you, so the page asks before running code in a shared
// room (see src/utils/runner.js).
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";
const exe = (name) => (isWin ? `${name}.exe` : name);
const MAX_OUTPUT = 1024 * 1024;
const MAX_SOURCE = 600 * 1024;
const TIMEOUT_MS = Number(process.env.COLABS_RUN_TIMEOUT_MS) || 15000;

// Apps started from the Dock/Finder get a short PATH on macOS (no Homebrew), and Linux
// desktop launchers can miss user installs. Add the usual places toolchains live.
const home = os.homedir();
const EXTRA_PATH = isWin
    ? [path.join(home, ".cargo", "bin"), path.join(home, "go", "bin"), "C:\\Program Files\\Go\\bin", "C:\\msys64\\ucrt64\\bin", "C:\\msys64\\mingw64\\bin", "C:\\MinGW\\bin"]
    : ["/opt/homebrew/bin", "/usr/local/bin", "/usr/local/go/bin", path.join(home, ".cargo", "bin"), path.join(home, "go", "bin"), path.join(home, ".local", "bin"), "/usr/bin", "/bin"];
const packs = require("./packs");
// Installed language packs come first, then your PATH, then the usual install folders.
const searchPath = () => [...new Set([...packs.binDirs(), ...(process.env.PATH || process.env.Path || "").split(path.delimiter), ...EXTRA_PATH].filter(Boolean))].join(path.delimiter);
// Rust from a pack keeps its toolchains inside the pack folder.
const packEnv = () => {
    const rust = packs.installed().rust;
    if (!rust?.bins?.[0]) return {};
    const dir = path.dirname(path.dirname(rust.bins[0]));
    return { RUSTUP_HOME: path.join(dir, "rustup"), CARGO_HOME: path.join(dir, "cargo") };
};

// The app's own Node (Electron run as plain Node): JavaScript needs nothing installed.
const BUILTIN_NODE = { cmd: process.execPath, env: { ELECTRON_RUN_AS_NODE: "1" } };
// Runtimes shipped inside the app (sandbox.js), used when the language isn't installed:
// TypeScript, Python, SQL and Lua then run on any computer, offline.
const BUNDLED = new Set(["typescript", "python", "sql", "lua"]);
const bundledRun = (id) => ({ ...BUILTIN_NODE, args: [path.join(__dirname, "sandbox.js"), id, LANGS[id].file] });
const BUNDLED_NAME = { typescript: "TypeScript compiler", python: "Python (WebAssembly)", sql: "SQLite (WebAssembly)", lua: "Lua (JavaScript)" };

// id -> { file, label, tools: [names to look for], compile?(dir), run(dir), install }
const binary = (dir) => path.join(dir, exe("main"));
const LANGS = {
    javascript: { file: "main.js", label: "JavaScript", builtin: true, run: () => ({ ...BUILTIN_NODE, args: ["main.js"] }) },
    typescript: { file: "main.ts", label: "TypeScript", tools: ["node"], run: () => ({ cmd: "node", args: ["--experimental-strip-types", "--no-warnings", "main.ts"] }), install: "https://nodejs.org", note: "Node.js 22.6 or newer" },
    python: { file: "main.py", label: "Python", tools: isWin ? ["python", "py"] : ["python3", "python"], run: (dir, t) => ({ cmd: t, args: ["main.py"] }), install: "https://www.python.org/downloads/" },
    java: {
        file: "Main.java", label: "Java", tools: ["javac"],
        compile: () => ({ cmd: "javac", args: ["Main.java"] }),
        run: () => ({ cmd: "java", args: ["-cp", ".", "Main"] }),
        install: "https://adoptium.net",
    },
    c: {
        file: "main.c", label: "C", tools: ["gcc", "clang"],
        compile: (dir, t) => ({ cmd: t, args: ["-O2", "-std=c11", "main.c", "-o", exe("main"), ...(isWin ? [] : ["-lm"])] }),
        run: (dir) => ({ cmd: binary(dir), args: [] }),
        install: isWin ? "https://www.msys2.org" : isMac ? "https://developer.apple.com/xcode/resources/" : "https://gcc.gnu.org",
    },
    cpp: {
        file: "main.cpp", label: "C++", tools: ["g++", "clang++"],
        compile: (dir, t) => ({ cmd: t, args: ["-O2", "-std=c++17", "main.cpp", "-o", exe("main")] }),
        run: (dir) => ({ cmd: binary(dir), args: [] }),
        install: isWin ? "https://www.msys2.org" : isMac ? "https://developer.apple.com/xcode/resources/" : "https://gcc.gnu.org",
    },
    csharp: {
        file: "Main.cs", label: "C#", tools: isWin ? ["csc", "mcs"] : ["mcs"],
        compile: (dir, t) => ({ cmd: t, args: t === "csc" ? ["-nologo", "-out:main.exe", "Main.cs"] : ["-out:main.exe", "Main.cs"] }),
        run: (dir) => (isWin ? { cmd: path.join(dir, "main.exe"), args: [] } : { cmd: "mono", args: ["main.exe"] }),
        install: "https://www.mono-project.com/download/stable/",
    },
    go: { file: "main.go", label: "Go", tools: ["go"], run: () => ({ cmd: "go", args: ["run", "main.go"] }), install: "https://go.dev/dl/" },
    rust: {
        file: "main.rs", label: "Rust", tools: ["rustc"],
        compile: () => ({ cmd: "rustc", args: ["-O", "main.rs", "-o", exe("main")] }),
        run: (dir) => ({ cmd: binary(dir), args: [] }),
        install: "https://rustup.rs",
    },
    kotlin: {
        file: "Main.kt", label: "Kotlin", tools: ["kotlinc"],
        compile: () => ({ cmd: "kotlinc", args: ["Main.kt", "-include-runtime", "-d", "main.jar"], shell: isWin }),
        run: () => ({ cmd: "java", args: ["-jar", "main.jar"] }),
        install: "https://kotlinlang.org/docs/command-line.html",
    },
    php: { file: "main.php", label: "PHP", tools: ["php"], run: () => ({ cmd: "php", args: ["main.php"] }), install: "https://www.php.net/downloads" },
    ruby: { file: "main.rb", label: "Ruby", tools: ["ruby"], run: () => ({ cmd: "ruby", args: ["main.rb"] }), install: "https://www.ruby-lang.org/en/downloads/" },
    swift: { file: "main.swift", label: "Swift", tools: ["swift"], run: () => ({ cmd: "swift", args: ["main.swift"] }), install: "https://www.swift.org/install/" },
    bash: { file: "main.sh", label: "Bash", tools: ["bash"], run: () => ({ cmd: "bash", args: ["main.sh"] }), install: isWin ? "https://git-scm.com/download/win" : null },
    lua: { file: "main.lua", label: "Lua", tools: ["lua", "lua5.4", "luajit"], run: (dir, t) => ({ cmd: t, args: ["main.lua"] }), install: "https://www.lua.org/download.html" },
    r: { file: "main.r", label: "R", tools: ["Rscript"], run: () => ({ cmd: "Rscript", args: ["main.r"] }), install: "https://cran.r-project.org" },
    sql: { file: "main.sql", label: "SQL (SQLite)", tools: ["sqlite3"], run: () => ({ cmd: "sqlite3", args: [":memory:", ".read main.sql"] }), install: "https://www.sqlite.org/download.html" },
};

// Find a tool on PATH without running it (fast, no side effects). Windows also tries the
// usual executable extensions.
function which(name) {
    const exts = isWin ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";").map((e) => e.toLowerCase()) : [""];
    for (const dir of searchPath().split(path.delimiter)) {
        for (const ext of exts) {
            const full = path.join(dir, isWin && !path.extname(name) ? name + ext : name);
            try {
                if (fs.statSync(full).isFile()) return full;
            } catch { /* not here */ }
        }
    }
    return null;
}

// The Windows "python" stub from the Store opens the Store instead of running; skip it.
const realTool = (p) => !!p && !/WindowsApps[\\/](python|python3)\.exe$/i.test(p);

function version(cmd) {
    return new Promise((resolve) => {
        const args = /javac|java$/i.test(cmd) ? ["-version"] : ["--version"];
        execFile(cmd, args, { timeout: 4000, windowsHide: true, env: { ...process.env, ...packEnv(), PATH: searchPath() } }, (err, stdout, stderr) => {
            const line = String(stdout || stderr || "").split(/\r?\n/).find((l) => l.trim()) || "";
            resolve(err && !line ? null : line.trim().slice(0, 80));
        });
    });
}

// Which languages this computer can run, and with what. Cached for a minute.
let cache = null;
async function toolchains({ fresh = false } = {}) {
    if (!fresh && cache && Date.now() - cache.at < 60000) return cache.list;
    const list = await Promise.all(Object.entries(LANGS).map(async ([id, l]) => {
        if (l.builtin) return { id, label: l.label, ready: true, builtin: true, tool: "built in", version: `Node ${process.versions.node}` };
        const found = l.tools.map((t) => ({ t, p: which(t) })).find(({ p }) => realTool(p));
        const bundled = { id, label: l.label, ready: true, bundled: true, tool: "bundled", version: `${BUNDLED_NAME[id]}, built in` };
        const pack = packs.available().find((p) => p.langs.includes(id));
        if (!found) return BUNDLED.has(id) ? bundled : { id, label: l.label, ready: false, install: l.install, note: l.note || null, pack: pack?.id || null, packSize: pack?.approx || null };
        // TypeScript with your own Node needs one new enough to strip types; else use the bundled compiler.
        if (id === "typescript") {
            const v = await version(found.p);
            const [maj, min] = String(v || "").replace(/^v/, "").split(".").map(Number);
            const ok = maj > 22 || (maj === 22 && min >= 6);
            return ok ? { id, label: l.label, ready: true, tool: found.t, version: v } : bundled;
        }
        return { id, label: l.label, ready: true, tool: found.t, path: found.p, version: await version(found.p) };
    }));
    cache = { at: Date.now(), list };
    return list;
}

function kill(child) {
    if (!child || child.exitCode !== null) return;
    if (isWin) execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }, () => { });
    else try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
}

function exec({ cmd, args, env = {}, shell = false }, { cwd, stdin, timeoutMs }) {
    return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let killed = false;
        let child;
        try {
            child = spawn(cmd, args, {
                cwd, windowsHide: true, shell, detached: !isWin,
                env: { ...process.env, ...packEnv(), PATH: searchPath(), ...env, HOME: process.env.HOME || home, TMP: cwd, TEMP: cwd, TMPDIR: cwd },
            });
        } catch (err) {
            return resolve({ code: -1, stdout, stderr: err.message, killed, missing: err.code === "ENOENT" });
        }
        const timer = setTimeout(() => { killed = true; kill(child); }, timeoutMs);
        const cap = (buf, add) => (buf.length >= MAX_OUTPUT ? buf : (buf + add).slice(0, MAX_OUTPUT));
        child.stdout.on("data", (d) => { stdout = cap(stdout, d.toString()); });
        child.stderr.on("data", (d) => { stderr = cap(stderr, d.toString()); });
        child.on("error", (err) => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: err.message, killed, missing: err.code === "ENOENT" }); });
        child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, killed }); });
        child.stdin.on("error", () => { }); // program exited before reading its input
        if (stdin) child.stdin.write(stdin);
        child.stdin.end();
    });
}

// Run one program. Throws { code: "NO_TOOLCHAIN" } when this computer can't run the language,
// so the caller can try the next runner.
async function runBuiltin({ language, source, stdin = "" }) {
    const spec = LANGS[String(language || "").toLowerCase()];
    const noTool = (msg) => Object.assign(new Error(msg), { code: "NO_TOOLCHAIN" });
    if (!spec) throw noTool(`${language} can't run on this computer`);
    if (typeof source !== "string" || !source.trim()) throw new Error("Nothing to run");
    if (source.length > MAX_SOURCE || String(stdin).length > 64 * 1024) throw new Error("Source or input is too large");

    const chains = await toolchains();
    const chain = chains.find((c) => c.id === String(language).toLowerCase());
    if (!chain?.ready) throw noTool(`${spec.label} isn't installed on this computer`);
    const tool = chain.tool;
    const plan = chain.bundled ? { run: () => bundledRun(chain.id) } : spec; // bundled: no compile step

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "colabs-run-"));
    const started = Date.now();
    try {
        fs.writeFileSync(path.join(dir, spec.file), source);
        if (plan.compile) {
            const c = await exec(plan.compile(dir, tool), { cwd: dir, stdin: "", timeoutMs: TIMEOUT_MS * 3 });
            if (c.missing) throw noTool(`${spec.label} compiler not found`);
            if (c.code !== 0) {
                return { ok: false, stdout: "", stderr: "", compileOutput: c.stderr || c.stdout, status: c.killed ? "Compilation timed out" : "Compilation Error", exitCode: c.code, timeMs: Date.now() - started, engine: "this computer" };
            }
        }
        // Python in WebAssembly takes a moment to start; give bundled runtimes extra time.
        const r = await exec(plan.run(dir, tool), { cwd: dir, stdin: String(stdin), timeoutMs: chain.bundled ? TIMEOUT_MS + 10000 : TIMEOUT_MS });
        if (r.missing) throw noTool(`${spec.label} runtime not found`);
        return {
            ok: r.code === 0 && !r.killed,
            stdout: r.stdout,
            stderr: r.stderr,
            compileOutput: "",
            status: r.killed ? "Time Limit Exceeded" : r.code === 0 ? "Accepted" : "Runtime Error",
            exitCode: r.code,
            timeMs: Date.now() - started,
            engine: "this computer",
        };
    } finally {
        fs.rm(dir, { recursive: true, force: true }, () => { });
    }
}

module.exports = { runBuiltin, toolchains };
