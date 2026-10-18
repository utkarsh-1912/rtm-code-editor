// Utkristi CoLabs desktop shell (Windows, macOS, Linux).
// Opens the hosted app, shows a splash while a cold server starts, and lets the page
// use local Judge0 / a local model through preload.js before falling back to the server.
const { app, BrowserWindow, ipcMain, shell, nativeTheme, Menu, Notification } = require("electron");
const path = require("path");
const { runLocal, llmLocal, localStatus } = require("./local");
const { createFsAccess } = require("./fsAccess");
const { openTerminal } = require("./terminal");

const argUrl = process.argv.find((a) => a.startsWith("--url="));
const APP_URL = (argUrl ? argUrl.slice(6) : process.env.COLABS_APP_URL || "https://utkristi-colabs.onrender.com").replace(/\/$/, "");
const APP_ORIGIN = new URL(APP_URL).origin;
const AUTH_HOSTS = [/\.firebaseapp\.com$/, /^accounts\.google\.com$/, /^github\.com$/, /\.googleusercontent\.com$/];

// Google blocks OAuth in browsers that identify as Electron, so present as plain Chrome.
app.userAgentFallback = app.userAgentFallback.replace(/\s?(Electron|utkristi-colabs-desktop|Utkristi CoLabs)\/[\d.]+/gi, "");

let win;
let lastRoot = null; // folder most recently opened, for "New Terminal"
const files = createFsAccess(() => win);

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
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (isAuthUrl(url)) return { action: "allow", overrideBrowserWindowOptions: { width: 520, height: 680, autoHideMenuBar: true } };
        if (url.startsWith(APP_ORIGIN)) return { action: "allow" };
        shell.openExternal(url);
        return { action: "deny" };
    });
    win.webContents.on("will-navigate", (event, url) => {
        if (url.startsWith(APP_ORIGIN) || url.startsWith("file:") || isAuthUrl(url)) return;
        event.preventDefault();
        shell.openExternal(url);
    });

    win.loadFile(path.join(__dirname, "splash.html"), { query: { url: APP_URL } });
    waitForServer().then(() => {
        if (win && !win.isDestroyed()) win.loadURL(APP_URL);
    });
}

const handle = (channel, fn) => ipcMain.handle(channel, async (event, payload) => {
    // Only our own window may use the bridge.
    const origin = new URL(event.senderFrame.url).origin;
    if (origin !== APP_ORIGIN && !event.senderFrame.url.startsWith("file:")) throw new Error("Not allowed");
    return fn(payload || {});
});

handle("colabs:runLocal", runLocal);
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
handle("colabs:info", async () => ({ version: app.getVersion(), platform: process.platform, appUrl: APP_URL, features: ["files", "terminal"] }));

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

// Opens the dashboard importer (works from any page of the app).
function importFrom(kind) {
    if (!win || win.isDestroyed()) return;
    win.loadURL(`${APP_URL}/dashboard?import=${kind}`);
    win.focus();
}

function buildMenu() {
    const isMac = process.platform === "darwin";
    const fileMenu = {
        label: "File",
        submenu: [
            { label: "Open Folder…", accelerator: "CmdOrCtrl+Shift+O", click: () => importFrom("folder") },
            { label: "Open Files…", accelerator: "CmdOrCtrl+O", click: () => importFrom("files") },
            { type: "separator" },
            { label: "New Terminal", accelerator: "CmdOrCtrl+`", click: () => openTerminal({ cwd: files.resolveCwd(lastRoot) }) },
            { type: "separator" },
            isMac ? { role: "close" } : { role: "quit" },
        ],
    };
    Menu.setApplicationMenu(Menu.buildFromTemplate([
        ...(isMac ? [{ role: "appMenu" }] : []),
        fileMenu,
        { role: "editMenu" },
        { role: "viewMenu" },
        { role: "windowMenu" },
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

    app.whenReady().then(() => {
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
