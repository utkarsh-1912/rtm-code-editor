// This browser/app as one entry in Settings > Security > Devices.
// Each device keeps a random key; check-ins refresh its row, and a device removed from
// another one learns it was revoked on its next check-in and signs out.
import { getBackendUrl } from "./api";

const KEY = "colabs-device-key";
const ID = "colabs-device-id";

const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};

function randomKey() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, "");
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function deviceKey() {
    let key = store.get(KEY);
    if (!key || !/^[A-Za-z0-9_-]{16,64}$/.test(key)) {
        key = randomKey();
        store.set(KEY, key);
    }
    return key;
}

export const deviceId = () => store.get(ID);

// Forget this device (after sign-out), so the next sign-in is a fresh entry.
export function forgetDevice() {
    store.del(KEY);
    store.del(ID);
    store.del("rtm_db_session_id"); // old format
}

// "Chrome on Windows", "Desktop app on macOS", "Safari on iPhone".
export function deviceLabel(ua = navigator.userAgent) {
    const os = /iPhone/.test(ua) ? "iPhone"
        : /iPad/.test(ua) ? "iPad"
            : /Android/.test(ua) ? "Android"
                : /CrOS/.test(ua) ? "ChromeOS"
                    : /Windows/.test(ua) ? "Windows"
                        : /Mac OS X|Macintosh/.test(ua) ? "macOS"
                            : /Linux/.test(ua) ? "Linux" : "Unknown OS";
    if (window.colabsDesktop) return `Desktop app on ${os}`;
    const browser = /Edg\//.test(ua) ? "Edge"
        : /OPR\/|Opera/.test(ua) ? "Opera"
            : /Firefox\//.test(ua) ? "Firefox"
                : /Chrome\//.test(ua) ? "Chrome"
                    : /Safari\//.test(ua) ? "Safari" : "Browser";
    return `${browser} on ${os}`;
}

// Returns { id, revoked } or null when the server can't be reached.
export async function checkIn(uid) {
    const res = await fetch(`${getBackendUrl()}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, device: deviceLabel(), userAgent: navigator.userAgent, sessionId: deviceKey() }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.id && !data.revoked) store.set(ID, String(data.id));
    return data;
}

// Sign this device out on the server too (best effort).
export async function revokeThisDevice(uid) {
    const id = deviceId();
    if (!uid || !id) return;
    try {
        await fetch(`${getBackendUrl()}/api/sessions/${id}?userId=${encodeURIComponent(uid)}`, { method: "DELETE" });
    } catch { /* offline: it will just expire */ }
}
