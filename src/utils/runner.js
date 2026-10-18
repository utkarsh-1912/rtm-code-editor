import { getBackendUrl } from "./api";

// Where the server-side runner lives: its own service (REACT_APP_RUNNER_URL) or the API server.
export const runnerBase = () => (process.env.REACT_APP_RUNNER_URL || `${getBackendUrl()}/api`).replace(/\/$/, "");

// Desktop bridge exposed by desktop/preload.js (undefined in a normal browser).
export const desktop = () => (typeof window !== "undefined" ? window.colabsDesktop : undefined);

/**
 * Run code and return { ok, stdout, stderr, compileOutput, status, timeMs, engine }.
 * Installed app: local Judge0 first (no server round trip), server only if that fails.
 * Browser: server runner.
 */
export async function runCode({ language, source, stdin = "" }) {
    const bridge = desktop();
    if (bridge?.runLocal) {
        try {
            const local = await bridge.runLocal({ language, source, stdin });
            if (local && !local.error) return local;
        } catch (err) {
            /* local Judge0 not running: fall through to the server */
        }
    }

    const res = await fetch(`${runnerBase()}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, source, stdin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Runner responded ${res.status}`);
    return data;
}

// Plain-text rendering of a run result for consoles.
export const formatRun = (r) => {
    if (!r) return "";
    if (r.compileOutput) return r.compileOutput;
    const out = [r.stdout, r.stderr].filter(Boolean).join(r.stdout && r.stderr ? "\n" : "");
    return out || (r.ok ? "Program finished with no output." : r.status);
};
