// Your own AI provider keys, kept on this device only (never sent to our servers to store).
//
// Browser: each key is encrypted with AES-256-GCM. The encryption key is a WebCrypto key that is
// created non-extractable and kept in IndexedDB: page scripts can ask it to decrypt, but its
// bytes can never be read out or copied off the device. With a passphrase the encryption key is
// instead derived from it (PBKDF2-SHA-256, 600k rounds) and lives in memory only while unlocked,
// so the stored keys are unreadable until you unlock, even with access to this browser's data.
//
// Desktop app: keys are encrypted by the operating system (Windows DPAPI / macOS Keychain) in
// the app's main process, and never come back to the page: the main process adds the key to
// the request itself.
//
// Each key is tied to the address it was saved for (its provider), and is only ever sent there.

import { desktop } from "./desktop";

const DB = "colabs-vault";
const STORE = "kv";
const PBKDF2_ROUNDS = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const bridge = () => (desktop()?.vaultSet ? desktop() : null);
export const vaultKind = () => (bridge() ? "desktop" : "browser");

function db() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function idb(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const out = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(out?.result);
        tx.onerror = () => reject(tx.error);
    });
}
const get = (k) => idb("readonly", (s) => s.get(k));
const put = (k, v) => idb("readwrite", (s) => s.put(v, k));
const del = (k) => idb("readwrite", (s) => s.delete(k));
const keys = () => idb("readonly", (s) => s.getAllKeys());

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// --- The encryption key --------------------------------------------------------------------------
let unlockedKey = null; // passphrase mode: derived key, this tab only

async function deviceKey() {
    let k = await get("master");
    if (!k) {
        k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
        await put("master", k);
    }
    return k;
}
async function deriveKey(passphrase, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: PBKDF2_ROUNDS, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
const lockInfo = () => get("lock"); // { salt, check } when a passphrase is set

export async function hasPassphrase() {
    if (bridge()) return false;
    return !!(await lockInfo());
}
export async function isLocked() {
    return !bridge() && !!(await lockInfo()) && !unlockedKey;
}
async function activeKey() {
    if (await lockInfo()) {
        if (!unlockedKey) throw Object.assign(new Error("Your saved AI keys are locked. Unlock them in Settings > AI models."), { code: "LOCKED" });
        return unlockedKey;
    }
    return deviceKey();
}

async function seal(key, text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
    return { iv: b64(iv), data: b64(data) };
}
async function open(key, box) {
    const out = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, key, unb64(box.data));
    return dec.decode(out);
}

// Unlock with the passphrase for this tab. Wrong passphrase: false.
export async function unlock(passphrase) {
    const info = await lockInfo();
    if (!info) return true;
    const key = await deriveKey(passphrase, unb64(info.salt));
    try {
        if ((await open(key, info.check)) !== "colabs-vault") return false;
    } catch { return false; }
    unlockedKey = key;
    return true;
}
export const lock = () => { unlockedKey = null; };

// Turn the passphrase on, change it, or (passphrase = null) turn it off. Re-encrypts every key.
export async function setPassphrase(passphrase) {
    const ids = await listIds();
    const plain = {};
    const current = await activeKey();
    for (const id of ids) plain[id] = await open(current, (await get(`secret:${id}`)).box);
    let next;
    if (passphrase) {
        if (passphrase.length < 8) throw new Error("Use at least 8 characters.");
        const salt = crypto.getRandomValues(new Uint8Array(16));
        next = await deriveKey(passphrase, salt);
        await put("lock", { salt: b64(salt), check: await seal(next, "colabs-vault") });
        unlockedKey = next;
    } else {
        await del("lock");
        unlockedKey = null;
        next = await deviceKey();
    }
    for (const id of ids) {
        const entry = await get(`secret:${id}`);
        await put(`secret:${id}`, { ...entry, box: await seal(next, plain[id]) });
    }
}

// --- Keys ----------------------------------------------------------------------------------------
async function listIds() {
    return (await keys()).filter((k) => String(k).startsWith("secret:")).map((k) => String(k).slice(7));
}

/** Save (or replace) a key. `origin` is the only address it will ever be sent to. */
export async function saveKey(id, secret, origin) {
    const value = String(secret || "").trim();
    if (!value) throw new Error("Paste the API key.");
    const meta = { last4: value.slice(-4), origin, savedAt: Date.now() };
    if (bridge()) {
        const res = await bridge().vaultSet({ id, secret: value, origin });
        if (!res?.ok) throw new Error(res?.error || "Couldn't save the key on this device.");
        return meta;
    }
    await put(`secret:${id}`, { box: await seal(await activeKey(), value), ...meta });
    return meta;
}

export async function removeKey(id) {
    if (bridge()) { await bridge().vaultDelete({ id }); return; }
    await del(`secret:${id}`);
}

/** Keys saved on this device: [{ id, last4, origin, savedAt }] (never the key itself). */
export async function listKeys() {
    if (bridge()) return (await bridge().vaultList()) || [];
    const out = [];
    for (const id of await listIds()) {
        const { last4, origin, savedAt } = await get(`secret:${id}`);
        out.push({ id, last4, origin, savedAt });
    }
    return out;
}

/**
 * Send one HTTPS request with a saved key added. `build(key)` returns { url, headers, body };
 * the request only goes out if its address matches the one the key was saved for.
 * Desktop: built with a placeholder; the app's main process adds the real key.
 */
export const KEY_PLACEHOLDER = "__COLABS_VAULT_KEY__";
export async function fetchWithKey(id, build, { signal } = {}) {
    if (bridge()) {
        const req = build(KEY_PLACEHOLDER);
        const res = await bridge().vaultFetch({ id, url: req.url, headers: req.headers, body: req.body });
        if (res?.error) throw new Error(res.error);
        return res; // { status, text }
    }
    const entry = await get(`secret:${id}`);
    if (!entry) throw new Error("That API key isn't saved on this device any more.");
    const secret = await open(await activeKey(), entry.box);
    const req = build(secret);
    if (!sameOrigin(req.url, entry.origin)) throw new Error("Blocked: this key can only be sent to the address it was saved for.");
    const res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal, credentials: "omit", referrerPolicy: "no-referrer" });
    return { status: res.status, text: await res.text() };
}

/** The key itself, only for sending through our relay (which never stores it). Browser only. */
export async function revealForRelay(id, url) {
    if (bridge()) throw new Error("The desktop app sends requests itself.");
    const entry = await get(`secret:${id}`);
    if (!entry) throw new Error("That API key isn't saved on this device any more.");
    if (!sameOrigin(url, entry.origin)) throw new Error("Blocked: this key can only be sent to the address it was saved for.");
    return open(await activeKey(), entry.box);
}

function sameOrigin(url, origin) {
    try { return new URL(url).origin === new URL(origin).origin; } catch { return false; }
}
