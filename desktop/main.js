// Utkristi CoLabs desktop shell (Windows, macOS, Linux).
// Opens the hosted app, shows a splash while a cold server starts, and lets the page
// use local Judge0 / a local model through preload.js before falling back to the server.
const { app, BrowserWindow, ipcMain, shell, nativeTheme, Menu } = require("electron");
const path = require("path");
const { runLocal, llmLocal, localStatus } = require("./local");

const argUrl = process.argv.find((a) => a.startsWith("--url="));
const APP_URL = (argUrl ? argUrl.slice(6) : process.env.COLABS_APP_URL || "https://utkristi-colabs.onrender.com").replace(/\/$/, "");
const APP_ORIGIN = new URL(APP_URL).origin;
const AUTH_HOSTS = [/\.firebaseapp\.com$/, /^accounts\.google\.com$/, /^github\.com$/, /\.googleusercontent\.com$/];

// Google blocks OAuth in browsers that identify as Electron, so present as plain Chrome.
app.userAgentFallback = app.userAgentFallback.replace(/\s?(Electron|utkristi-colabs-desktop|Utkristi CoLabs)\/[\d.]+/gi, "");

let win;

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
handle("colabs:info", async () => ({ version: app.getVersion(), platform: process.platform, appUrl: APP_URL }));

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
        if (process.platform === "darwin") {
            Menu.setApplicationMenu(Menu.buildFromTemplate([
                { role: "appMenu" }, { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" },
            ]));
        }
        createWindow();
        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") app.quit();
    });
}
