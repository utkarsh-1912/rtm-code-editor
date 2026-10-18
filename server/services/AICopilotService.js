/**
 * AI copilot: forwards chat messages to any OpenAI-compatible endpoint.
 * Defaults to a local Ollama with a small open-weight code model, so nothing leaves
 * your machine unless you point LLM_BASE_URL somewhere else.
 *
 *   LLM_BASE_URL  default http://localhost:11434/v1   (Ollama, llama.cpp server, LM Studio, vLLM…)
 *   LLM_MODEL     default qwen2.5-coder:1.5b           (try qwen2.5-coder:7b or qwen3-coder:30b on bigger machines)
 *   LLM_API_KEY   optional bearer token
 */
const BASE = () => (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, "");
const MODEL = () => process.env.LLM_MODEL || "qwen2.5-coder:1.5b";
const MAX_CHARS = 16000;

function sanitize(messages) {
    if (!Array.isArray(messages) || !messages.length) throw Object.assign(new Error("No messages"), { status: 400 });
    let total = 0;
    return messages.slice(-6).map((m) => {
        const role = ["system", "user", "assistant"].includes(m?.role) ? m.role : "user";
        const content = String(m?.content || "").slice(0, MAX_CHARS);
        total += content.length;
        if (total > MAX_CHARS * 2) throw Object.assign(new Error("Request is too large"), { status: 413 });
        return { role, content };
    });
}

async function complete({ messages }) {
    const body = { model: MODEL(), messages: sanitize(messages), temperature: 0.2, stream: false };
    const headers = { "content-type": "application/json" };
    if (process.env.LLM_API_KEY) headers.authorization = `Bearer ${process.env.LLM_API_KEY}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Number(process.env.LLM_TIMEOUT_MS) || 120000);
    try {
        const res = await fetch(`${BASE()}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            if (res.status === 404 && /not found/i.test(detail)) {
                throw Object.assign(new Error(`The model "${body.model}" is not installed on the model server. Run: ollama pull ${body.model}`), { status: 503 });
            }
            throw Object.assign(new Error(`Model endpoint responded ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`), { status: 502 });
        }
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        return { text, model: data.model || body.model };
    } catch (err) {
        if (err.name === "AbortError") throw Object.assign(new Error("The model took too long to answer"), { status: 504 });
        if (err.status) throw err;
        throw Object.assign(new Error(`No AI model reachable at ${BASE()}. Start Ollama (ollama serve) and pull ${MODEL()}, or set LLM_BASE_URL.`), { status: 503 });
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { complete };
