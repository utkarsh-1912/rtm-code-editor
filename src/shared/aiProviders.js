// AI providers people can connect with their own API key, and how to talk to each.
// Shared by the web app (direct calls), the desktop app (requests are built here; its main
// process adds the key) and the server (relay + platform models). CommonJS so all three load it.
//
// style: "openai"    POST {base}/chat/completions, OpenAI-compatible
//        "anthropic" POST {base}/messages
// auth:  how the key is sent ("bearer" | "x-api-key" | "api-subscription-key")
// direct: the provider accepts calls straight from a browser (CORS). Otherwise the web app
//         sends the request through our relay for that one call (key never stored or logged).
// models: suggestions only; any model id the provider offers can be typed in.

const PROVIDERS = [
    { id: "gemini", name: "Google Gemini", style: "openai", base: "https://generativelanguage.googleapis.com/v1beta/openai", auth: "bearer", direct: true, models: ["gemini-3.6-flash"], keyUrl: "https://aistudio.google.com/apikey" },
    { id: "anthropic", name: "Anthropic Claude", style: "anthropic", base: "https://api.anthropic.com/v1", auth: "x-api-key", direct: true, models: ["claude-sonnet-5-5", "claude-haiku-5-5"], keyUrl: "https://console.anthropic.com/settings/keys" },
    { id: "openai", name: "OpenAI", style: "openai", base: "https://api.openai.com/v1", auth: "bearer", direct: true, models: [], modelHint: "Model id from your OpenAI account", keyUrl: "https://platform.openai.com/api-keys" },
    { id: "openrouter", name: "OpenRouter", style: "openai", base: "https://openrouter.ai/api/v1", auth: "bearer", direct: true, models: [], modelHint: "e.g. anthropic/claude-sonnet-5-5", keyUrl: "https://openrouter.ai/keys" },
    { id: "xai", name: "xAI Grok", style: "openai", base: "https://api.x.ai/v1", auth: "bearer", direct: false, models: [], modelHint: "Grok model id from console.x.ai", keyUrl: "https://console.x.ai" },
    { id: "qwen", name: "Alibaba Qwen", style: "openai", base: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", auth: "bearer", direct: false, models: [], modelHint: "e.g. qwen-plus", keyUrl: "https://modelstudio.console.alibabacloud.com" },
    { id: "kimi", name: "Moonshot Kimi", style: "openai", base: "https://api.moonshot.ai/v1", auth: "bearer", direct: false, models: [], modelHint: "Kimi model id from platform.moonshot.ai", keyUrl: "https://platform.moonshot.ai" },
    { id: "sarvam", name: "Sarvam AI", style: "openai", base: "https://api.sarvam.ai/v1", auth: "api-subscription-key", direct: false, models: [], modelHint: "e.g. sarvam-m", keyUrl: "https://dashboard.sarvam.ai" },
    // Any OpenAI-compatible server (self-hosted, a company gateway). Never sent through the relay.
    { id: "custom", name: "Other (OpenAI-compatible)", style: "openai", base: "", auth: "bearer", direct: true, custom: true, models: [], modelHint: "Model id on that server" },
];

const providerById = (id) => PROVIDERS.find((p) => p.id === id) || null;

const MAX_TOKENS = 4096;

// The HTTP request for one chat: { url, headers, body }. `key` may be a placeholder that the
// desktop app swaps for the real key in its main process.
function buildRequest({ provider, base, model, messages, key }) {
    const p = typeof provider === "string" ? providerById(provider) : provider;
    if (!p) throw new Error("Unknown AI provider");
    const root = String((p.custom ? base : p.base) || "").replace(/\/+$/, "");
    if (!root) throw new Error("Add the server address for this model");
    const headers = { "content-type": "application/json" };
    if (key) {
        if (p.auth === "x-api-key") headers["x-api-key"] = key;
        else if (p.auth === "api-subscription-key") headers["api-subscription-key"] = key;
        else headers.authorization = `Bearer ${key}`;
    }
    if (p.style === "anthropic") {
        headers["anthropic-version"] = "2023-06-01";
        // Lets a browser call the API directly with the user's own key (their key, their browser).
        headers["anthropic-dangerous-direct-browser-access"] = "true";
        const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
        const rest = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") }));
        return { url: `${root}/messages`, headers, body: { model, max_tokens: MAX_TOKENS, ...(system ? { system } : {}), messages: rest } };
    }
    return { url: `${root}/chat/completions`, headers, body: { model, messages, stream: false, max_tokens: MAX_TOKENS } };
}

// The reply text from a provider's JSON response.
function parseResponse(provider, data) {
    const p = typeof provider === "string" ? providerById(provider) : provider;
    if (p?.style === "anthropic") {
        return { text: (data?.content || []).filter((c) => c.type === "text").map((c) => c.text).join(""), model: data?.model };
    }
    return { text: data?.choices?.[0]?.message?.content || "", model: data?.model };
}

// A short, safe message for a failed call. Provider error bodies can echo request headers, so
// anything that looks like a key is cut out.
function errorFor(provider, status, detail = "") {
    const p = typeof provider === "string" ? providerById(provider) : provider;
    const name = p?.name || "The AI provider";
    const clean = String(detail || "").replace(/(sk|xai|AIza|key)[-_A-Za-z0-9]{8,}/g, "[key]").slice(0, 180);
    if (status === 401 || status === 403 || (status === 400 && /api[ _-]?key|unauthori[sz]ed|invalid.*key/i.test(clean))) return `${name} rejected the API key. Check it in Settings > AI models.`;
    if (status === 404) return `${name} doesn't know that model. Check the model id in Settings > AI models.`;
    if (status === 429) return `${name} is rate-limiting this key right now. Try again in a minute, or check your quota.`;
    if (status === 402) return `${name} says this account is out of credit.`;
    return `${name} responded ${status}${clean ? `: ${clean}` : ""}`;
}

// Allowed destinations for requests that leave through our relay or the desktop app.
const isProviderUrl = (url) => PROVIDERS.some((p) => p.base && String(url).startsWith(`${p.base}/`));

module.exports = { PROVIDERS, providerById, buildRequest, parseResponse, errorFor, isProviderUrl, MAX_TOKENS };
