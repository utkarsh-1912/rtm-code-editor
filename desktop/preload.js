// Narrow bridge for the web app. It only exposes calls to local services on this machine;
// no Node APIs reach the page. File access goes through native dialogs the user answers,
// and writes are limited to folders picked that way.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("colabsDesktop", {
    platform: process.platform,
    // { backendUrl, publicUrl, bundled }: where the server and public site are when this UI
    // is served from the app itself (see localUi.js). Read once, synchronously, at startup.
    config: ipcRenderer.sendSync("colabs:config"),
    runLocal: (payload) => ipcRenderer.invoke("colabs:runLocal", payload),
    runBuiltin: (payload) => ipcRenderer.invoke("colabs:runBuiltin", payload),
    toolchains: (payload) => ipcRenderer.invoke("colabs:toolchains", payload),
    packs: () => ipcRenderer.invoke("colabs:packs"),
    installPack: (id) => ipcRenderer.invoke("colabs:installPack", { id }),
    removePack: (id) => ipcRenderer.invoke("colabs:removePack", { id }),
    installAppleTools: () => ipcRenderer.invoke("colabs:installAppleTools"),
    onPackProgress: (fn) => {
        const listener = (_e, info) => fn(info);
        ipcRenderer.on("colabs:packProgress", listener);
        return () => ipcRenderer.removeListener("colabs:packProgress", listener);
    },
    // Terminal docked in the window: the page only places it (slot position) or closes it.
    terminalDock: (payload) => ipcRenderer.invoke("colabs:terminalDock", payload),
    terminalClose: (payload) => ipcRenderer.invoke("colabs:terminalClose", payload),
    onTerminalClosed: (fn) => {
        const listener = (_e, info) => fn(info);
        ipcRenderer.on("colabs:terminalClosed", listener);
        return () => ipcRenderer.removeListener("colabs:terminalClosed", listener);
    },
    llmLocal: (payload) => ipcRenderer.invoke("colabs:llmLocal", payload),
    localStatus: () => ipcRenderer.invoke("colabs:localStatus"),
    info: () => ipcRenderer.invoke("colabs:info"),
    openFolder: () => ipcRenderer.invoke("colabs:openFolder"),
    openFiles: () => ipcRenderer.invoke("colabs:openFiles"),
    pickSaveFolder: () => ipcRenderer.invoke("colabs:pickSaveFolder"),
    writeFiles: (payload) => ipcRenderer.invoke("colabs:writeFiles", payload),
    openTerminal: (payload) => ipcRenderer.invoke("colabs:openTerminal", payload),
    notify: (payload) => ipcRenderer.invoke("colabs:notify", payload),
    openExternal: (url) => ipcRenderer.invoke("colabs:openExternal", { url }),
    // Native menu navigation (Go > Workspace etc.). Returns an unsubscribe function.
    onNavigate: (fn) => {
        const listener = (_e, route) => fn(route);
        ipcRenderer.on("colabs:navigate", listener);
        return () => ipcRenderer.removeListener("colabs:navigate", listener);
    },
});
