// Which AI model the copilot uses, and the models you connected with your own key.
// Connections (provider, model, label) are plain settings in this browser; the keys themselves
// live in the encrypted vault (keyVault.js).
import { getBackendUrl } from "./api";
import { auth } from "../firebase";
import { PROVIDERS, providerById, buildRequest, parseResponse, errorFor } from "../shared/aiProviders";
import * as vault from "./keyVault";

export { PROVIDERS, providerById };

const slot = (uid, what) => `ai-${what}-${uid || "guest"}`;
const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

const authHeader = async () => {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// --- Your connected models ----------------------------------------------------------------------
// [{ id, provider, model, label, base? }]; the key is in the vault under `${uid}:${id}`.
export const listConnections = (uid) => read(slot(uid, "connections"), []);
const saveConnections = (uid, list) => write(slot(uid, "connections"), list);
const vaultId = (uid, id) => `${uid || "guest"}:${id}`;
const originFor = (c) => new URL(buildRequest({ provider: c.provider, base: c.base, model: c.model || "x", messages: [], key: null }).url).origin;

export async function addConnection(uid, { provider, model, label, base, key }) {
    const p = providerById(provider);
    if (!p) throw new Error("Pick a provider.");
    const cleanModel = String(model || "").trim();
    if (!cleanModel) throw new Error("Enter the model id.");
    let cleanBase;
    if (p.custom) {
        try {
            const u = new URL(String(base || "").trim());
            if (u.protocol !== "https:" && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) throw new Error();
            cleanBase = u.href.replace(/\/+$/, "");
        } catch { throw new Error("Enter the server's https address, e.g. https://llm.example.com/v1"); }
    }
    const id = `${p.id}-${Date.now().toString(36)}`;
    const c = { id, provider: p.id, model: cleanModel, label: String(label || "").trim() || `${p.name} · ${cleanModel}`, ...(cleanBase ? { base: cleanBase } : {}) };
    const meta = await vault.saveKey(vaultId(uid, id), key, originFor(c));
    saveConnections(uid, [...listConnections(uid), { ...c, last4: meta.last4 }]);
    return c;
}

export async function removeConnection(uid, id) {
    await vault.removeKey(vaultId(uid, id)).catch(() => { });
    saveConnections(uid, listConnections(uid).filter((c) => c.id !== id));
    if (getDefault(uid) === `own:${id}`) setDefault(uid, "auto");
}

// --- Default model ------------------------------------------------------------------------------
// "auto" (desktop: local model first, then the server's default), "platform:<id>", "own:<id>".
export const getDefault = (uid) => read(slot(uid, "default"), "auto");
export const setDefault = (uid, value) => write(slot(uid, "default"), value);

// --- Platform models (provided by this site) -----------------------------------------------------
export async function listPlatformModels() {
    const res = await fetch(`${getBackendUrl()}/api/ai/models`, { headers: await authHeader() });
    if (!res.ok) throw new Error("Couldn't load the available models.");
    return res.json(); // { admin, models: [...] }
}
export async function requestModelAccess(id, note = "") {
    const res = await fetch(`${getBackendUrl()}/api/ai/models/${encodeURIComponent(id)}/request`, {
        method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ note }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Couldn't send the request.");
    return data.status;
}
export async function listAccessRequests(status = "pending") {
    const res = await fetch(`${getBackendUrl()}/api/ai/access-requests?status=${status}`, { headers: await authHeader() });
    const data = await res.json().catch(() => ([]));
    if (!res.ok) throw new Error(data.error || "Couldn't load requests.");
    return data;
}
export async function decideAccessRequest(id, decision) {
    const res = await fetch(`${getBackendUrl()}/api/ai/access-requests/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ decision }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Couldn't save the decision.");
    return data;
}

// --- Talking to your own model -------------------------------------------------------------------
// Desktop app: its main process adds the key and sends the request. Browser: straight to the
// provider when it allows it; otherwise (or if the browser blocks the call) through our relay,
// which forwards that one request and keeps nothing.
export async function chatOwn(uid, connection, messages) {
    const c = connection;
    const p = providerById(c.provider);
    if (!p) throw new Error("This model's provider isn't supported any more.");
    const id = vaultId(uid, c.id);
    const build = (key) => buildRequest({ provider: p, base: c.base, model: c.model, messages, key });
    const finish = (status, text) => {
        if (status < 200 || status >= 300) throw new Error(errorFor(p, status, text));
        const out = parseResponse(p, JSON.parse(text || "{}"));
        if (!out.text) throw new Error(`${p.name} sent an empty reply.`);
        return { text: out.text, model: out.model || c.model, where: vault.vaultKind() === "desktop" ? "your key · this device" : "your key" };
    };

    if (vault.vaultKind() === "desktop") {
        const res = await vault.fetchWithKey(id, build);
        return finish(res.status, res.text);
    }
    if (p.direct || p.custom) {
        try {
            const res = await vault.fetchWithKey(id, build);
            return finish(res.status, res.text);
        } catch (err) {
            // A browser block (CORS) shows up as a network TypeError: use the relay instead.
            if (!(err instanceof TypeError) || p.custom) throw err;
        }
    }
    const url = build("x").url;
    const key = await vault.revealForRelay(id, url);
    const res = await fetch(`${getBackendUrl()}/api/ai/relay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Provider-Key": key, ...(await authHeader()) },
        body: JSON.stringify({ provider: p.id, model: c.model, messages }),
        credentials: "omit",
        referrerPolicy: "no-referrer",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `The relay responded ${res.status}`);
    return { text: data.text, model: data.model || c.model, where: "your key · via relay" };
}

// A tiny request to check a key and model before relying on them.
export async function testConnection(uid, connection) {
    const t0 = performance.now();
    const out = await chatOwn(uid, connection, [{ role: "user", content: "Reply with the single word: ok" }]);
    return { ...out, ms: Math.round(performance.now() - t0) };
}

export const vaultInfo = {
    kind: vault.vaultKind,
    hasPassphrase: vault.hasPassphrase,
    isLocked: vault.isLocked,
    unlock: vault.unlock,
    lock: vault.lock,
    setPassphrase: vault.setPassphrase,
};
