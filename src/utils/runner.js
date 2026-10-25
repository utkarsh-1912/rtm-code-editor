import { getBackendUrl } from "./api";

// Where the server-side runner lives: its own service (REACT_APP_RUNNER_URL) or the API server.
export const runnerBase = () => (process.env.REACT_APP_RUNNER_URL || `${getBackendUrl()}/api`).replace(/\/$/, "");

// Desktop bridge exposed by desktop/preload.js (undefined in a normal browser).
export const desktop = () => (typeof window !== "undefined" ? window.colabsDesktop : undefined);

// Desktop app: where Run goes. "local" = this computer first (default), "cloud" = always the server.
const WHERE_KEY = "colabs-run-where";
export const runWhere = () => {
    try { return localStorage.getItem(WHERE_KEY) === "cloud" ? "cloud" : "local"; } catch { return "local"; }
};
export const setRunWhere = (v) => {
    try { localStorage.setItem(WHERE_KEY, v === "cloud" ? "cloud" : "local"); } catch { /* storage blocked */ }
};

// Code in a shared room may come from other people, and the built-in runner is not a sandbox
// (code runs as you). Ask once per room before running it on this computer.
const TRUST_KEY = "colabs-run-trusted";
function trustedHere(scope) {
    if (!scope) return true;
    try {
        const list = JSON.parse(localStorage.getItem(TRUST_KEY)) || [];
        if (list.includes(scope)) return true;
        // eslint-disable-next-line no-alert
        const ok = window.confirm("Run this code on your computer?\n\nOther people can edit this room, and code run here has the same access to your files as you. Choose Cancel to run it in the cloud sandbox instead.\n\nYou won't be asked again for this room.");
        if (ok) localStorage.setItem(TRUST_KEY, JSON.stringify([...list, scope].slice(-200)));
        return ok;
    } catch {
        return false;
    }
}

const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;

async function runOnServer({ language, source, stdin }) {
    const res = await fetch(`${runnerBase()}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, source, stdin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Runner responded ${res.status}`);
    return data;
}

/**
 * Run code and return { ok, stdout, stderr, compileOutput, status, timeMs, engine }.
 *
 * Desktop app (like running code in VS Code):
 *   1. this computer's own compilers/interpreters (built in; works offline, no server load)
 *   2. a Judge0 running on this computer, if any
 *   3. the server's sandboxed runner
 * Browser: the server's runner.
 *
 * `sharedScope` (e.g. "room:abc") marks code other people can edit: the desktop app asks
 * before running it locally the first time. `localOnly` never uses the cloud (offline editor).
 */
export async function runCode({ language, source, stdin = "", sharedScope = null, localOnly = false }) {
    const bridge = desktop();
    let localProblem = null;

    if (bridge?.runBuiltin && runWhere() === "local" && trustedHere(sharedScope)) {
        const r = await bridge.runBuiltin({ language, source, stdin }).catch((err) => ({ error: err.message }));
        if (r && !r.error) return r;
        localProblem = r?.error || null;
        if (r?.code !== "NO_TOOLCHAIN" && localProblem) throw new Error(localProblem); // e.g. "Nothing to run"
    }

    if (bridge?.runLocal) {
        try {
            const local = await bridge.runLocal({ language, source, stdin });
            if (local && !local.error) return local;
        } catch {
            /* no Judge0 on this computer */
        }
    }

    if (localOnly) throw new Error(`${localProblem || "This language can't run on this computer"}. Install it to run it here (Settings › Desktop app lists what's missing).`);
    if (bridge && offline()) {
        throw new Error(`${localProblem || "This language can't run on this computer"}, and you're offline. Install it (Settings › Desktop app shows what's missing) or reconnect to use the cloud runner.`);
    }
    try {
        return await runOnServer({ language, source, stdin });
    } catch (err) {
        if (bridge && localProblem) throw new Error(`${localProblem}, and the cloud runner isn't reachable (${err.message}).`);
        throw err;
    }
}

// Plain-text rendering of a run result for consoles.
export const formatRun = (r) => {
    if (!r) return "";
    if (r.compileOutput) return r.compileOutput;
    const out = [r.stdout, r.stderr].filter(Boolean).join(r.stdout && r.stderr ? "\n" : "");
    return out || (r.ok ? "Program finished with no output." : r.status);
};
