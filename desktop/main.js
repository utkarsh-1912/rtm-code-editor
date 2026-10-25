// Utkristi CoLabs desktop shell (Windows, macOS, Linux).
// Opens the web UI bundled with the app (served from localhost, so it starts instantly) and
// talks to the hosted server for data. Without a bundle, or with --url= / COLABS_APP_URL /
// COLABS_REMOTE_UI=1, it opens the hosted site instead and shows a splash while it wakes.
// The page can use local Judge0 / a local model through preload.js before the server.
const { app, BrowserWindow, ipcMain, shell, nativeTheme, Menu, Notification, dialog } = require("electron");
const path = require("path");
const { runLocal, llmLocal, localStatus } = require("./local");
const { runBuiltin, toolchains } = require("./runner");
const packs = require("./packs");
const { createFsAccess } = require("./fsAccess");
const { openTerminal, createTerminalView } = require("./terminal");
const { startLocalUi } = require("./localUi");

const argUrl = process.argv.find((a) => a.startsWith("--url="));
const APP_URL = (argUrl ? argUrl.slice(6) : process.env.COLABS_APP_URL || "https://utkristi-colabs.onrender.com").replace(/\/$/, "");
const APP_ORIGIN = new URL(APP_URL).origin;
// The bundled UI is used unless a server URL was given explicitly (dev / self-hosting).
const WANT_BUNDLED = !argUrl && !process.env.COLABS_APP_URL && process.env.COLABS_REMOTE_UI !== "1";
let UI_URL = APP_URL; // where the window loads the interface from
let UI_ORIGIN = APP_ORIGIN;
let bundled = false;
const AUTH_HOSTS = [/\.firebaseapp\.com$/, /^accounts\.google\.com$/, /^github\.com$/, /\.googleusercontent\.com$/];

// Google blocks OAuth in browsers that identify as Electron, so present as plain Chrome.
app.userAgentFallback = app.userAgentFallback.replace(/\s?(Electron|utkristi-colabs-desktop|Utkristi CoLabs)\/[\d.]+/gi, "");

let win;
let lastRoot = null; // folder most recently opened, for "New Terminal"
const files = createFsAccess(() => win);

// Exact origin match ("startsWith" would also accept https://app.example.com.evil.com).
function isAppUrl(url) {
    try {
        const { origin } = new URL(url);
        return origin === APP_ORIGIN || origin === UI_ORIGIN;
    } catch {
        return false;
    }
}
const SPLASH_URL = require("url").pathToFileURL(path.join(__dirname, "splash.html")).href;

function isAuthUrl(url) {
    try {
        const { hostname } = new URL(url);
        return AUTH_HOSTS.some((re) => re.test(hostname));
    } catch {
        return false;
    }
}

async function waitForServer() {
    for (let attempt = 1; ; attempt++) {
        try {
            const res = await fetch(`${APP_URL}/api/ping`, { cache: "no-store" });
            if (res.ok) return;
        } catch {
            /* still asleep or offline */
        }
        if (win && !win.isDestroyed()) win.webContents.send("splash:status", { attempt });
        await new Promise((r) => setTimeout(r, 2500));
    }
}

function createWindow() {
    const dark = nativeTheme.shouldUseDarkColors;
    win = new BrowserWindow({
        width: 1360,
        height: 860,
        minWidth: 900,
        minHeight: 600,
        title: "Utkristi CoLabs",
        backgroundColor: dark ? "#0B0B0A" : "#F5F7FB",
        icon: path.join(__dirname, "build", "icon.png"),
        autoHideMenuBar: process.platform !== "darwin",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
        },
    });

    // Same-origin pages and sign-in popups stay in the app; everything else opens in the browser.
    // A full reload or navigation of the app page drops its docked terminals.
    win.webContents.on("did-start-navigation", (details) => {
        if (details?.isMainFrame && !details.isSameDocument) for (const k of [...docked.keys()]) closeDocked(k, { tell: false });
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        if (isAuthUrl(url)) return { action: "allow", overrideBrowserWindowOptions: { width: 520, height: 680, autoHideMenuBar: true } };
        if (isAppUrl(url)) return { action: "allow" };
        shell.openExternal(url);
        return { action: "deny" };
    });
    win.webContents.on("will-navigate", (event, url) => {
        if (isAppUrl(url) || url.startsWith(SPLASH_URL) || isAuthUrl(url)) return;
        event.preventDefault();
        shell.openExternal(url);
    });

    if (bundled) {
        // The interface is local; the page shows its own notice while the server wakes.
        win.loadURL(UI_URL);
        return;
    }
    win.loadFile(path.join(__dirname, "splash.html"), { query: { url: APP_URL } });
    waitForServer().then(() => {
        if (win && !win.isDestroyed()) win.loadURL(APP_URL);
    });
}

// Only the top frame of our own pages (the app or the splash), never an embedded frame.
const trusted = (frame) => !!frame && !frame.parent && (isAppUrl(frame.url) || frame.url.startsWith(SPLASH_URL));

const handle = (channel, fn) => ipcMain.handle(channel, async (event, payload) => {
    if (!trusted(event.senderFrame)) throw new Error("Not allowed");
    return fn(payload || {});
});

// Read synchronously by preload.js so the page knows its server before any code runs.
ipcMain.on("colabs:config", (event) => {
    event.returnValue = trusted(event.senderFrame)
        ? { backendUrl: bundled ? APP_URL : null, publicUrl: APP_URL, bundled }
        : null;
});

handle("colabs:runLocal", runLocal);
// Built-in runner: this computer's own compilers and interpreters (works offline).
handle("colabs:runBuiltin", async (p) => {
    try {
        return await runBuiltin(p);
    } catch (err) {
        return { error: err.message, code: err.code || null };
    }
});
handle("colabs:toolchains", (p) => toolchains(p));
// Language packs: official portable toolchains downloaded into the app's data folder.
handle("colabs:packs", async () => ({ available: packs.available(), installed: packs.installed() }));
handle("colabs:installPack", async ({ id }) => {
    const send = (info) => { if (win && !win.isDestroyed()) win.webContents.send("colabs:packProgress", { id, ...info }); };
    try {
        const r = await packs.install(String(id || ""), send);
        await toolchains({ fresh: true });
        return r;
    } catch (err) {
        send({ phase: "error", message: err.message });
        return { ok: false, error: err.message };
    }
});
handle("colabs:removePack", async ({ id }) => {
    const r = await packs.remove(String(id || ""));
    await toolchains({ fresh: true });
    return r;
});
handle("colabs:installAppleTools", async () => packs.installAppleTools());

// Terminals docked inside the window (one per key, e.g. a project's panel). The page sends
// the slot's position; it can show, move or close a terminal but never send it commands.
const docked = new Map(); // key -> view
function closeDocked(key, { tell = true } = {}) {
    const view = docked.get(key);
    if (!view) return;
    docked.delete(key);
    // Tell the page first: closing can be triggered from inside the terminal itself ("exit"),
    // so the view is closed on the next tick, outside that terminal's own message handler.
    if (tell && win && !win.isDestroyed()) win.webContents.send("colabs:terminalClosed", { key });
    try { win?.contentView.removeChildView(view); } catch { /* window gone */ }
    setImmediate(() => { try { if (!view.webContents.isDestroyed()) view.webContents.close(); } catch { /* already closed */ } });
}
handle("colabs:terminalDock", async ({ key = "main", cwd, title, rect, visible = true }) => {
    if (!win || win.isDestroyed()) return { ok: false };
    const k = String(key).slice(0, 80);
    let view = docked.get(k);
    const fresh = !view;
    if (fresh) {
        view = createTerminalView({
            cwd: files.resolveCwd(cwd || lastRoot),
            title,
            onExit: () => closeDocked(k),
            // Pop out: the same folder in its own window, and the panel closes.
            onPopOut: (dir) => { openTerminal({ cwd: dir, title }); closeDocked(k); },
        });
        win.contentView.addChildView(view);
        docked.set(k, view);
    }
    if (rect && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) {
        const z = win.webContents.getZoomFactor();
        view.setBounds({ x: Math.round(rect.x * z), y: Math.round(rect.y * z), width: Math.max(0, Math.round(rect.width * z)), height: Math.max(0, Math.round(rect.height * z)) });
    }
    view.setVisible(!!visible);
    if (fresh && visible) view.webContents.focus();
    return { ok: true };
});
handle("colabs:terminalClose", async ({ key = "main" }) => {
    closeDocked(String(key).slice(0, 80), { tell: false });
    return { ok: true };
});
handle("colabs:llmLocal", llmLocal);
handle("colabs:localStatus", localStatus);
handle("colabs:notify", async ({ title, body }) => {
    // Web push does not exist inside Electron, so unread alerts surface as native notifications.
    if (!Notification.isSupported()) return false;
    const n = new Notification({ title: String(title || "Utkristi CoLabs").slice(0, 80), body: String(body || "").slice(0, 200), icon: path.join(__dirname, "build", "icon.png") });
    n.on("click", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
    n.show();
    return true;
});
handle("colabs:info", async () => ({ version: app.getVersion(), platform: process.platform, appUrl: APP_URL, uiUrl: UI_URL, bundled, features: ["files", "terminal", "runner"] }));

// Files and terminal. Reading needs a native dialog the user answers; writing and terminals
// are limited to folders picked that way (see fsAccess.js).
const remember = (r) => {
    if (r?.root) lastRoot = r.root;
    return r;
};
handle("colabs:openFolder", async () => remember(await files.openFolder()));
handle("colabs:openFiles", async () => remember(await files.openFiles()));
handle("colabs:pickSaveFolder", async () => remember(await files.pickSaveFolder()));
handle("colabs:writeFiles", async (p) => remember(await files.writeFiles(p)));
handle("colabs:openTerminal", async ({ cwd, title }) => openTerminal({ cwd: files.resolveCwd(cwd || lastRoot), title }));

// Website pages (help, legal, status) and other links open in the default browser.
handle("colabs:openExternal", async ({ url }) => {
    const u = new URL(String(url || ""));
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only web links can be opened");
    await shell.openExternal(u.href);
    return true;
});

// Navigate inside the app. When the app UI is showing, the page routes in place (no reload,
// calls and sockets stay connected); otherwise (splash, error page) load the URL.
function goTo(route) {
    if (!win || win.isDestroyed()) return;
    if (isAppUrl(win.webContents.getURL())) win.webContents.send("colabs:navigate", route);
    else win.loadURL(`${UI_URL}${route}`);
    if (win.isMinimized()) win.restore();
    win.focus();
}

const importFrom = (kind) => goTo(`/dashboard?import=${kind}`);
const newRoomId = () => Math.random().toString(36).slice(2, 10);

function buildMenu() {
    const isMac = process.platform === "darwin";
    const site = (route) => () => shell.openExternal(`${APP_URL}${route}`);
    const fileMenu = {
        label: "File",
        submenu: [
            { label: "New Room", accelerator: "CmdOrCtrl+N", click: () => goTo(`/editor/${newRoomId()}`) },
            { type: "separator" },
            { label: "Open Folder…", accelerator: "CmdOrCtrl+Shift+O", click: () => importFrom("folder") },
            { label: "Open Files…", accelerator: "CmdOrCtrl+O", click: () => importFrom("files") },
            { type: "separator" },
            { label: "New Terminal", accelerator: "CmdOrCtrl+`", click: () => openTerminal({ cwd: files.resolveCwd(lastRoot) }) },
            { type: "separator" },
            ...(isMac ? [] : [{ label: "Settings", accelerator: "Ctrl+,", click: () => goTo("/settings") }, { type: "separator" }]),
            isMac ? { role: "close" } : { role: "quit" },
        ],
    };
    const goMenu = {
        label: "Go",
        submenu: [
            { label: "Workspace", accelerator: "CmdOrCtrl+1", click: () => goTo("/dashboard") },
            { label: "Snippets", accelerator: "CmdOrCtrl+2", click: () => goTo("/snippets") },
            { label: "Settings", accelerator: "CmdOrCtrl+3", click: () => goTo("/settings") },
            { label: "Offline Editor", accelerator: "CmdOrCtrl+4", click: () => goTo("/offline") },
            { type: "separator" },
            { label: "Back", accelerator: isMac ? "Cmd+[" : "Alt+Left", click: () => win?.webContents.navigationHistory?.canGoBack() && win.webContents.navigationHistory.goBack() },
            { label: "Forward", accelerator: isMac ? "Cmd+]" : "Alt+Right", click: () => win?.webContents.navigationHistory?.canGoForward() && win.webContents.navigationHistory.goForward() },
        ],
    };
    const viewMenu = {
        label: "View",
        submenu: [
            { role: "reload" },
            ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }]),
            { type: "separator" },
            { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
            { type: "separator" },
            { role: "togglefullscreen" },
        ],
    };
    const helpMenu = {
        role: "help",
        submenu: [
            { label: "Help and Support", click: site("/support") },
            { label: "Service Status", click: site("/status") },
            { label: "Check for Updates", click: site("/download") },
            { label: "Documentation", click: () => goTo("/docs") },
            { label: "Report an Issue", click: site("/support") },
            { type: "separator" },
            { label: "Open Website", click: site("/") },
            ...(isMac ? [] : [{ type: "separator" }, {
                label: "About Utkristi CoLabs",
                click: () => dialog.showMessageBox(win, {
                    type: "info",
                    title: "About",
                    message: `Utkristi CoLabs ${app.getVersion()}`,
                    detail: `Interface: ${bundled ? "bundled with this install" : UI_URL}
Server: ${APP_URL}
Electron ${process.versions.electron} · ${process.platform}-${process.arch}`,
                }),
            }]),
        ],
    };
    Menu.setApplicationMenu(Menu.buildFromTemplate([
        ...(isMac ? [{ role: "appMenu" }] : []),
        fileMenu,
        { role: "editMenu" },
        viewMenu,
        goMenu,
        { role: "windowMenu" },
        helpMenu,
    ]));
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    app.whenReady().then(async () => {
        packs.setRoot(path.join(app.getPath("userData"), "packs")); // language packs live with the app's data
        if (WANT_BUNDLED) {
            try {
                const local = await startLocalUi();
                if (local) {
                    UI_URL = local.url;
                    UI_ORIGIN = new URL(local.url).origin;
                    bundled = true;
                }
            } catch (err) {
                console.error("Bundled UI unavailable, using the hosted site:", err.message);
            }
        }
        buildMenu();
        createWindow();
        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") app.quit();
    });
}
