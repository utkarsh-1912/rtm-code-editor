// Integrated terminal: a separate local window (terminal.html) that runs shell commands
// on this machine. Commands only ever come from keystrokes in that window; the web app
// can open a terminal (in a folder the user picked) but cannot send it commands.
//
// No native PTY module is needed: each command line runs through the system shell
// (cmd.exe / $SHELL, or COLABS_SHELL), stdin is forwarded while it runs, Ctrl+C stops it.
// `cd`, `clear` and `exit` are handled by the terminal itself so the directory persists.
const { BrowserWindow, WebContentsView, ipcMain, nativeTheme } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const isWin = process.platform === "win32";
const sessions = new Map(); // webContents.id -> { cwd, child, win }

const shellFor = () => {
    if (process.env.COLABS_SHELL) return { shell: process.env.COLABS_SHELL };
    if (isWin) return { shell: process.env.ComSpec || "cmd.exe" };
    return { shell: process.env.SHELL || "/bin/sh" };
};

function expandHome(p) {
    if (p === "~") return os.homedir();
    if (p.startsWith("~/") || p.startsWith("~\\")) return path.join(os.homedir(), p.slice(2));
    return p;
}

// Returns the new directory or throws with a shell-like message.
function changeDir(cwd, arg) {
    const target = arg ? path.resolve(cwd, expandHome(arg.replace(/^["']|["']$/g, ""))) : os.homedir();
    let stat;
    try {
        stat = fs.statSync(target);
    } catch {
        throw new Error(`cd: no such directory: ${arg}`);
    }
    if (!stat.isDirectory()) throw new Error(`cd: not a directory: ${arg}`);
    return target;
}

function kill(child) {
    if (!child || child.exitCode !== null) return;
    if (isWin) {
        // Kill the whole tree (cmd.exe -> program).
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else {
        try {
            process.kill(-child.pid, "SIGINT");
        } catch {
            child.kill("SIGINT");
        }
    }
}

function run(session, line, send) {
    const trimmed = line.trim();
    if (!trimmed) return send("term:exit", { code: 0, cwd: session.cwd });

    // Built-ins only for a bare command; "cd src && npm test" goes to the shell as a whole.
    const plain = !/[&|;<>]/.test(trimmed);
    // cd, cd dir, cd /d D:\dir (cmd), cd.. (cmd), cd -
    const cd = plain && trimmed.match(/^(?:cd|chdir)(?:\s+(?:\/d\s+)?(.*)|(\.\..*))?$/i);
    if (cd) {
        try {
            const arg = (cd[1] ?? cd[2] ?? "").trim();
            if (!arg && isWin) {
                // cmd.exe: a bare "cd" prints the current directory.
                send("term:data", { stream: "stdout", text: session.cwd + String.fromCharCode(10) });
                return send("term:exit", { code: 0, cwd: session.cwd });
            }
            const next = arg === "-" ? session.prevCwd || session.cwd : changeDir(session.cwd, arg);
            session.prevCwd = session.cwd;
            session.cwd = next;
            return send("term:exit", { code: 0, cwd: session.cwd });
        } catch (err) {
            send("term:data", { stream: "stderr", text: `${err.message}\n` });
            return send("term:exit", { code: 1, cwd: session.cwd });
        }
    }
    const lower = plain ? trimmed.toLowerCase() : "";
    if (lower === "clear" || lower === "cls") return send("term:clear", { cwd: session.cwd });
    if (lower === "exit") return session.win.close();

    const env = { ...process.env, FORCE_COLOR: "1", TERM: "xterm-256color", COLUMNS: "120" };
    const child = spawn(trimmed, [], {
        cwd: session.cwd,
        env,
        shell: shellFor().shell,
        windowsHide: true,
        detached: !isWin, // own process group so Ctrl+C reaches children
    });
    session.child = child;
    child.stdout.on("data", (d) => send("term:data", { stream: "stdout", text: d.toString() }));
    child.stderr.on("data", (d) => send("term:data", { stream: "stderr", text: d.toString() }));
    child.on("error", (err) => send("term:data", { stream: "stderr", text: `${err.message}\n` }));
    child.on("close", (code, signal) => {
        if (session.child === child) session.child = null;
        // 130 = stopped by the user (taskkill on Windows reports 1).
        const stopped = child.stoppedByUser || (!code && signal);
        send("term:exit", { code: stopped ? 130 : code ?? 1, cwd: session.cwd });
    });
}

let registered = false;
function registerIpc() {
    if (registered) return;
    registered = true;
    // Only terminal windows created below may use these channels.
    const from = (event) => sessions.get(event.sender.id);
    ipcMain.handle("term:init", (event) => {
        const s = from(event);
        if (!s) throw new Error("Not allowed");
        return { cwd: s.cwd, shell: path.basename(shellFor().shell), platform: process.platform, home: os.homedir() };
    });
    ipcMain.on("term:run", (event, line) => {
        const s = from(event);
        if (!s || s.child || typeof line !== "string") return;
        run(s, line.slice(0, 8000), (ch, payload) => !event.sender.isDestroyed() && event.sender.send(ch, payload));
    });
    ipcMain.on("term:input", (event, text) => {
        const s = from(event);
        if (s?.child?.stdin?.writable && typeof text === "string") s.child.stdin.write(text);
    });
    ipcMain.on("term:dock", (event, action) => {
        const s = from(event);
        if (!s) return;
        if (action === "close") s.win.close();
        if (action === "popout" && s.onPopOut) s.onPopOut(s.cwd);
    });
    ipcMain.on("term:interrupt", (event) => {
        const s = from(event);
        if (s?.child) {
            s.child.stoppedByUser = true;
            kill(s.child);
        }
    });
}

function openTerminal({ cwd, title } = {}) {
    registerIpc();
    const dark = nativeTheme.shouldUseDarkColors;
    const win = new BrowserWindow({
        width: 900,
        height: 560,
        minWidth: 480,
        minHeight: 280,
        title: title ? `Terminal — ${title}` : "Terminal",
        backgroundColor: dark ? "#0B0B0A" : "#F5F7FB",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "terminal-preload.js"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
        },
    });
    const id = win.webContents.id;
    sessions.set(id, { cwd, child: null, win });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    win.on("closed", () => {
        const s = sessions.get(id);
        if (s?.child) kill(s.child);
        sessions.delete(id);
    });
    win.loadFile(path.join(__dirname, "terminal.html"));
    return { ok: true };
}

// A terminal inside the main window: the same terminal page (its own web contents, its own
// preload) shown as a native view over a slot in the app's layout. The app decides where it
// sits and whether it shows, but, exactly like the separate window, it cannot type into it.
// `onExit` runs when the terminal ends itself ("exit").
function createTerminalView({ cwd, title, onExit, onPopOut } = {}) {
    registerIpc();
    const view = new WebContentsView({
        webPreferences: {
            preload: path.join(__dirname, "terminal-preload.js"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
        },
    });
    view.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#0B0B0A" : "#F5F7FB");
    const wc = view.webContents;
    const id = wc.id;
    sessions.set(id, { cwd, child: null, title, onPopOut, win: { close: () => onExit && onExit() } });
    wc.setWindowOpenHandler(() => ({ action: "deny" }));
    wc.on("will-navigate", (e) => e.preventDefault());
    wc.on("destroyed", () => {
        const s = sessions.get(id);
        if (s?.child) kill(s.child);
        sessions.delete(id);
    });
    wc.loadFile(path.join(__dirname, "terminal.html"), { query: { docked: "1" } });
    return view;
}

module.exports = { openTerminal, createTerminalView, changeDir, _run: run };
