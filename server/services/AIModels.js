// AI models on the server side:
//  - platform models: ones you (the site's developer) provide with your own keys. Gemini is open
//    to everyone; others can need approval ("Request access"). Configure with PLATFORM_MODELS
//    (JSON list) and the provider keys, e.g. ANTHROPIC_API_KEY, XAI_API_KEY, QWEN_API_KEY,
//    KIMI_API_KEY, SARVAM_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY.
//      PLATFORM_MODELS='[{"id":"sonnet","label":"Claude Sonnet 5.5","provider":"anthropic","model":"claude-sonnet-5-5","access":"request"}]'
//  - one chat call to any provider, used for platform models and for the relay that carries a
//    person's own key for a single request (never stored, never logged).
const { providerById, buildRequest, parseResponse, errorFor } = require('../../src/shared/aiProviders');

const KEY_ENV = {
    gemini: 'GEMINI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', openrouter: 'OPENROUTER_API_KEY',
    xai: 'XAI_API_KEY', qwen: 'QWEN_API_KEY', kimi: 'KIMI_API_KEY', sarvam: 'SARVAM_API_KEY',
};
const serverKey = (providerId) => process.env[KEY_ENV[providerId]] || null;

// The models this server offers. Without PLATFORM_MODELS: the hosted Gemini (open to all) and,
// when an Anthropic key is set, Sonnet and Haiku on request.
function platformModels() {
    let list = [];
    try { list = JSON.parse(process.env.PLATFORM_MODELS || '[]'); } catch { list = []; }
    if (!Array.isArray(list) || !list.length) {
        list = [
            { id: 'gemini', label: 'Gemini (hosted)', provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-3.6-flash', access: 'open', default: true },
            { id: 'claude-sonnet', label: 'Claude Sonnet 5.5', provider: 'anthropic', model: 'claude-sonnet-5-5', access: 'request' },
            { id: 'claude-haiku', label: 'Claude Haiku 5.5', provider: 'anthropic', model: 'claude-haiku-5-5', access: 'request' },
        ];
    }
    return list
        .filter((m) => m && m.id && providerById(m.provider) && !providerById(m.provider).custom)
        .map((m) => ({
            id: String(m.id).slice(0, 60), label: String(m.label || m.model).slice(0, 80), provider: m.provider, model: String(m.model).slice(0, 120),
            access: m.access === 'request' ? 'request' : 'open', default: !!m.default, ready: !!serverKey(m.provider),
        }));
}
const platformModel = (id) => platformModels().find((m) => m.id === id) || null;

const MAX_CHARS = 16000;
function sanitize(messages) {
    if (!Array.isArray(messages) || !messages.length) throw Object.assign(new Error('No messages'), { status: 400 });
    let total = 0;
    return messages.slice(-8).map((m) => {
        const role = ['system', 'user', 'assistant'].includes(m?.role) ? m.role : 'user';
        const content = String(m?.content || '').slice(0, MAX_CHARS);
        total += content.length;
        if (total > MAX_CHARS * 3) throw Object.assign(new Error('Request is too large'), { status: 413 });
        return { role, content };
    });
}

// One chat call. Errors carry a status and a message that never contains the key.
async function chat({ providerId, key, model, messages, timeoutMs = 120000 }) {
    const p = providerById(providerId);
    if (!p || p.custom) throw Object.assign(new Error('Unknown AI provider'), { status: 400 });
    if (!key) throw Object.assign(new Error(`${p.name} isn't set up on this server.`), { status: 503 });
    const cleanModel = String(model || '').trim().slice(0, 120);
    if (!cleanModel) throw Object.assign(new Error('Choose a model.'), { status: 400 });
    const req = buildRequest({ provider: p, model: cleanModel, messages: sanitize(messages), key });
    delete req.headers['anthropic-dangerous-direct-browser-access']; // not a browser
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal: ctrl.signal });
        const text = await res.text();
        if (!res.ok) throw Object.assign(new Error(errorFor(p, res.status, text.replace(key, '[key]'))), { status: res.status === 429 ? 429 : 502 });
        const out = parseResponse(p, JSON.parse(text || '{}'));
        return { text: out.text, model: out.model || cleanModel };
    } catch (err) {
        if (err.name === 'AbortError') throw Object.assign(new Error('The model took too long to answer'), { status: 504 });
        if (err.status) throw err;
        throw Object.assign(new Error(`Couldn't reach ${p.name}.`), { status: 502 });
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { platformModels, platformModel, serverKey, chat, sanitize };
