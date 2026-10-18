// Bridge for terminal.html only (a local file, never a web page).
const { contextBridge, ipcRenderer } = require("electron");

const on = (channel) => (fn) => {
    const listener = (_e, payload) => fn(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld("term", {
    init: () => ipcRenderer.invoke("term:init"),
    run: (line) => ipcRenderer.send("term:run", line),
    input: (text) => ipcRenderer.send("term:input", text),
    interrupt: () => ipcRenderer.send("term:interrupt"),
    onData: on("term:data"),
    onExit: on("term:exit"),
    onClear: on("term:clear"),
});
