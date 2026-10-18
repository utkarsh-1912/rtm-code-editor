// Local services the desktop app prefers over the server:
//   Judge0 CE (open source)        COLABS_JUDGE0_URL  default http://localhost:2358
//   OpenAI-compatible model (Ollama) COLABS_LLM_URL   default http://localhost:11434/v1
// Runs in the main process, so there are no CORS issues and nothing is exposed to pages
// beyond the three calls in preload.js.
const JUDGE0_URL = (process.env.COLABS_JUDGE0_URL || "http://localhost:2358").replace(/\/$/, "");
const LLM_URL = (process.env.COLABS_LLM_URL || "http://localhost:11434/v1").replace(/\/$/, "");
const LLM_MODEL = process.env.COLABS_LLM_MODEL || "qwen2.5-coder:1.5b";

const JUDGE0_IDS = { javascript: 63, python: 71, cpp: 54, java: 62 };
const b64 = (s) => Buffer.from(String(s || ""), "utf8").toString("base64");
const unb64 = (s) => (s ? Buffer.from(s, "base64").toString("utf8") : "");

async function timed(url, init, ms) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
        clearTimeout(t);
    }
}

async function runLocal({ language, source, stdin }) {
    const id = JUDGE0_IDS[language];
    if (!id) throw new Error(`Unsupported language: ${language}`);
    if (typeof source !== "string" || source.length > 100 * 1024) throw new Error("Source is empty or too large");
    const started = Date.now();
    const res = await timed(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=true&fields=stdout,stderr,compile_output,status,time,exit_code,message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language_id: id, source_code: b64(source), stdin: b64(stdin) }),
    }, 30000);
    if (!res.ok) throw new Error(`Local Judge0 responded ${res.status}`);
    const d = await res.json();
    return {
        ok: d.status?.id === 3,
        stdout: unb64(d.stdout),
        stderr: unb64(d.stderr) || unb64(d.message),
        compileOutput: unb64(d.compile_output),
        status: d.status?.description || "Unknown",
        exitCode: d.exit_code ?? null,
        timeMs: d.time != null ? Math.round(parseFloat(d.time) * 1000) : Date.now() - started,
        engine: "judge0 (this device)",
    };
}

async function llmLocal({ messages }) {
    if (!Array.isArray(messages) || !messages.length) throw new Error("No messages");
    const clean = messages.slice(-6).map((m) => ({ role: String(m.role || "user"), content: String(m.content || "").slice(0, 16000) }));
    const res = await timed(`${LLM_URL}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: LLM_MODEL, messages: clean, temperature: 0.2, stream: false }),
    }, 180000);
    if (!res.ok) throw new Error(`Local model responded ${res.status}`);
    const d = await res.json();
    return { text: d.choices?.[0]?.message?.content || "", model: d.model || LLM_MODEL };
}

async function localStatus() {
    const probe = async (url) => {
        try {
            const r = await timed(url, {}, 1500);
            return r.ok;
        } catch {
            return false;
        }
    };
    const [judge0, llm] = await Promise.all([probe(`${JUDGE0_URL}/about`), probe(`${LLM_URL}/models`)]);
    return { judge0, llm, judge0Url: JUDGE0_URL, llmUrl: LLM_URL, model: LLM_MODEL };
}

module.exports = { runLocal, llmLocal, localStatus };
