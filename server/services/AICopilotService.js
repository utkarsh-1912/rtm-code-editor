/**
 * AI copilot: forwards chat messages to a model over the OpenAI-compatible chat API.
 *
 * Hosted (the website): Google Gemini, with the key kept on the server.
 *   GEMINI_API_KEY  required for the hosted copilot
 *   GEMINI_MODEL    default gemini-3.6-flash
 *
 * Self-hosting instead: set LLM_BASE_URL to any OpenAI-compatible server (Ollama,
 * llama.cpp, LM Studio, vLLM…). It wins over Gemini when set.
 *   LLM_BASE_URL    e.g. http://localhost:11434/v1
 *   LLM_MODEL       default qwen2.5-coder:1.5b
 *   LLM_API_KEY     optional bearer token
 *
 * The desktop app runs its local model itself (see src/utils/copilot.js) and only falls back
 * to this server.
 */
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const MAX_CHARS = 16000;

function provider() {
    if (process.env.LLM_BASE_URL) {
        return {
            name: "custom",
            base: process.env.LLM_BASE_URL.replace(/\/$/, ""),
            model: process.env.LLM_MODEL || "qwen2.5-coder:1.5b",
            key: process.env.LLM_API_KEY || null,
        };
    }
    if (process.env.GEMINI_API_KEY) {
        return { name: "gemini", base: GEMINI_BASE, model: process.env.GEMINI_MODEL || "gemini-3.6-flash", key: process.env.GEMINI_API_KEY };
    }
    return null;
}

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
    const p = provider();
    if (!p) {
        throw Object.assign(new Error("The AI copilot isn't set up on this server yet. Set GEMINI_API_KEY (or LLM_BASE_URL for a self-hosted model)."), { status: 503 });
    }
    // Gemini picks its own sampling defaults; small local models answer better a bit cooler.
    const body = { model: p.model, messages: sanitize(messages), stream: false, ...(p.name === "custom" ? { temperature: 0.2 } : {}) };
    const headers = { "content-type": "application/json" };
    if (p.key) headers.authorization = `Bearer ${p.key}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Number(process.env.LLM_TIMEOUT_MS) || 120000);
    try {
        const res = await fetch(`${p.base}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            // Gemini answers a bad key with 400 "Please pass a valid API key" (or 401/403).
            if (p.name === "gemini" && (res.status === 401 || res.status === 403 || (res.status === 400 && /api key/i.test(detail)))) {
                throw Object.assign(new Error("The server's Gemini API key was rejected. Check GEMINI_API_KEY."), { status: 502 });
            }
            if (res.status === 429) throw Object.assign(new Error("The AI model is busy right now. Try again in a minute."), { status: 429 });
            if (p.name === "custom" && res.status === 404 && /not found/i.test(detail)) {
                throw Object.assign(new Error(`The model "${p.model}" is not installed on the model server. Run: ollama pull ${p.model}`), { status: 503 });
            }
            throw Object.assign(new Error(`Model endpoint responded ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`), { status: 502 });
        }
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        return { text, model: data.model || p.model };
    } catch (err) {
        if (err.name === "AbortError") throw Object.assign(new Error("The model took too long to answer"), { status: 504 });
        if (err.status) throw err;
        throw Object.assign(new Error(p.name === "gemini"
            ? "Could not reach Gemini from the server. Check its internet access."
            : `No AI model reachable at ${p.base}. Start your model server, or unset LLM_BASE_URL to use Gemini.`), { status: 503 });
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { complete };
