// Your own AI provider keys in the desktop app. Encrypted by the operating system (safeStorage:
// DPAPI on Windows, Keychain on macOS, the secret service on Linux) and stored in the app's data
// folder. The page never gets a key back: it hands over a request with a placeholder, and this
// process adds the key and sends it, only to the address the key was saved for.
const fs = require("fs");
const path = require("path");
const { app, safeStorage } = require("electron");

const PLACEHOLDER = "__COLABS_VAULT_KEY__";
const file = () => path.join(app.getPath("userData"), "ai-keys.json");

function readAll() {
    try { return JSON.parse(fs.readFileSync(file(), "utf8")) || {}; } catch { return {}; }
}
function writeAll(all) {
    const tmp = `${file()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(all), { mode: 0o600 });
    fs.renameSync(tmp, file());
}
const cleanId = (id) => String(id || "").replace(/[^\w:.-]/g, "").slice(0, 120);
const originOf = (url) => { try { return new URL(url).origin; } catch { return null; } };
const allowedOrigin = (origin) => !!origin && (origin.startsWith("https://") || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

async function vaultSet({ id, secret, origin }) {
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: "This computer can't encrypt keys for the app (no system keychain). The key was not saved." };
    const key = cleanId(id);
    const value = String(secret || "").trim();
    const to = originOf(origin);
    if (!key || !value || !allowedOrigin(to)) return { ok: false, error: "Missing key or address." };
    const all = readAll();
    all[key] = { box: safeStorage.encryptString(value).toString("base64"), last4: value.slice(-4), origin: to, savedAt: Date.now() };
    writeAll(all);
    return { ok: true };
}

async function vaultDelete({ id }) {
    const all = readAll();
    delete all[cleanId(id)];
    writeAll(all);
    return { ok: true };
}

async function vaultList() {
    return Object.entries(readAll()).map(([id, e]) => ({ id, last4: e.last4, origin: e.origin, savedAt: e.savedAt }));
}

// Sends one JSON POST with the key put in place of the placeholder. Returns { status, text }.
async function vaultFetch({ id, url, headers, body }) {
    const entry = readAll()[cleanId(id)];
    if (!entry) return { error: "That API key isn't saved on this computer any more." };
    if (originOf(url) !== entry.origin) return { error: "Blocked: this key can only be sent to the address it was saved for." };
    let secret;
    try { secret = safeStorage.decryptString(Buffer.from(entry.box, "base64")); } catch { return { error: "Couldn't decrypt the key on this computer. Save it again." }; }
    const out = {};
    for (const [k, v] of Object.entries(headers || {})) out[String(k)] = String(v).split(PLACEHOLDER).join(secret);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120000);
    try {
        const res = await fetch(url, { method: "POST", headers: out, body: JSON.stringify(body || {}), signal: ctrl.signal });
        return { status: res.status, text: (await res.text()).slice(0, 2000000) };
    } catch (err) {
        return { error: err.name === "AbortError" ? "The model took too long to answer." : `Couldn't reach ${entry.origin}.` };
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { vaultSet, vaultDelete, vaultList, vaultFetch };
