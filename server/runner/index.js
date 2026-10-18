// Code runner: tries each configured engine in order (RUNNER_ENGINES, default
// "judge0,local") and returns the first result. No database access lives here, so the
// runner can be mounted in the API server or deployed on its own (see standalone.js).
const { LANGUAGES, resolveLanguage } = require("./languages");
const judge0 = require("./engines/judge0");
const local = require("./engines/local");

const ENGINES = { judge0, local };
const MAX_SOURCE = 600 * 1024  // SQL runs carry imported tables as INSERTs;
const MAX_STDIN = 32 * 1024;

const order = () => (process.env.RUNNER_ENGINES || "judge0,local").split(",").map((s) => s.trim()).filter((n) => ENGINES[n]);
const enabled = () => order().filter((n) => ENGINES[n].available());

async function runCode({ language, source, stdin = "" }) {
    const key = resolveLanguage(language);
    if (!key) {
        const err = new Error(`Unsupported language: ${language}`);
        err.status = 400;
        throw err;
    }
    if (typeof source !== "string" || !source.trim()) {
        const err = new Error("Nothing to run");
        err.status = 400;
        throw err;
    }
    if (source.length > MAX_SOURCE || String(stdin).length > MAX_STDIN) {
        const err = new Error("Source or input is too large");
        err.status = 413;
        throw err;
    }
    const names = enabled();
    if (!names.length) {
        const err = new Error("No code runner is configured on this server");
        err.status = 503;
        throw err;
    }
    const timeoutMs = Number(process.env.RUNNER_TIMEOUT_MS) || 10000;
    const errors = [];
    for (const name of names) {
        try {
            return await ENGINES[name].run({ spec: LANGUAGES[key], source, stdin: String(stdin), timeoutMs });
        } catch (err) {
            errors.push(`${name}: ${err.message}`);
        }
    }
    const err = new Error(`All runners failed (${errors.join("; ")})`);
    err.status = 502;
    throw err;
}

const info = () => ({
    engines: enabled(),
    languages: Object.entries(LANGUAGES).map(([id, l]) => ({ id, label: l.label })),
});

module.exports = { runCode, info };
