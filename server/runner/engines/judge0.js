// Judge0 engine. Works with a self-hosted Judge0 CE (JUDGE0_URL, open source) or the
// hosted RapidAPI instance (JUDGE0_RAPIDAPI_KEY). Keys stay on the server.
const b64 = (s) => Buffer.from(String(s || ""), "utf8").toString("base64");
const unb64 = (s) => (s ? Buffer.from(s, "base64").toString("utf8") : "");

function target() {
    if (process.env.JUDGE0_URL) {
        const headers = { "content-type": "application/json" };
        if (process.env.JUDGE0_AUTH_TOKEN) headers["X-Auth-Token"] = process.env.JUDGE0_AUTH_TOKEN;
        return { base: process.env.JUDGE0_URL.replace(/\/$/, ""), headers, name: "judge0" };
    }
    const key = process.env.JUDGE0_RAPIDAPI_KEY || process.env.REACT_APP_RAPIDAPI_KEY;
    if (key) {
        return {
            base: "https://judge0-ce.p.rapidapi.com",
            headers: { "content-type": "application/json", "X-RapidAPI-Key": key, "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com" },
            name: "judge0-hosted",
        };
    }
    return null;
}

const available = () => Boolean(target());

async function run({ spec, source, stdin, timeoutMs }) {
    const t = target();
    if (!t) throw new Error("Judge0 is not configured");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs + 15000);
    const started = Date.now();
    try {
        const res = await fetch(`${t.base}/submissions?base64_encoded=true&wait=true&fields=stdout,stderr,compile_output,status,time,exit_code,message`, {
            method: "POST",
            headers: t.headers,
            body: JSON.stringify({ language_id: spec.judge0Id, source_code: b64(source), stdin: b64(stdin), cpu_time_limit: Math.ceil(timeoutMs / 1000) }),
            signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Judge0 responded ${res.status}`);
        const d = await res.json();
        const statusId = d.status?.id;
        return {
            ok: statusId === 3,
            stdout: unb64(d.stdout),
            stderr: unb64(d.stderr) || (d.message ? unb64(d.message) : ""),
            compileOutput: unb64(d.compile_output),
            status: d.status?.description || "Unknown",
            exitCode: d.exit_code ?? null,
            timeMs: d.time != null ? Math.round(parseFloat(d.time) * 1000) : Date.now() - started,
            engine: t.name,
        };
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { name: "judge0", available, run };
