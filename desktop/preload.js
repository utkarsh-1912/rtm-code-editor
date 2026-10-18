// Narrow bridge for the web app. It only exposes calls to local services on this machine;
// no Node APIs reach the page.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("colabsDesktop", {
    platform: process.platform,
    runLocal: (payload) => ipcRenderer.invoke("colabs:runLocal", payload),
    llmLocal: (payload) => ipcRenderer.invoke("colabs:llmLocal", payload),
    localStatus: () => ipcRenderer.invoke("colabs:localStatus"),
    info: () => ipcRenderer.invoke("colabs:info"),
});
