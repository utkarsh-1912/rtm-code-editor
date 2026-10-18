// Narrow bridge for the web app. It only exposes calls to local services on this machine;
// no Node APIs reach the page. File access goes through native dialogs the user answers,
// and writes are limited to folders picked that way.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("colabsDesktop", {
    platform: process.platform,
    runLocal: (payload) => ipcRenderer.invoke("colabs:runLocal", payload),
    llmLocal: (payload) => ipcRenderer.invoke("colabs:llmLocal", payload),
    localStatus: () => ipcRenderer.invoke("colabs:localStatus"),
    info: () => ipcRenderer.invoke("colabs:info"),
    openFolder: () => ipcRenderer.invoke("colabs:openFolder"),
    openFiles: () => ipcRenderer.invoke("colabs:openFiles"),
    pickSaveFolder: () => ipcRenderer.invoke("colabs:pickSaveFolder"),
    writeFiles: (payload) => ipcRenderer.invoke("colabs:writeFiles", payload),
    openTerminal: (payload) => ipcRenderer.invoke("colabs:openTerminal", payload),
    notify: (payload) => ipcRenderer.invoke("colabs:notify", payload),
});
