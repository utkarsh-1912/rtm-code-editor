// Every request to our API carries the signed-in person's ID token, so the server checks who is
// asking instead of trusting a user id in the request. Project requests also carry that
// project's share key when the page was opened from a share link (/project/12?k=...).
import { auth } from "../firebase";
import { getBackendUrl } from "./api";

const KEY_PREFIX = "project-key-";
export const rememberProjectKey = (projectId, key) => {
    try { if (key) sessionStorage.setItem(`${KEY_PREFIX}${projectId}`, key); } catch { /* storage blocked */ }
};
export const projectKey = (projectId) => {
    try { return sessionStorage.getItem(`${KEY_PREFIX}${projectId}`) || null; } catch { return null; }
};

export function installAuthFetch() {
    if (typeof window === "undefined" || window.fetch.__colabsAuth) return;
    const original = window.fetch.bind(window);
    const wrapped = async (input, init = {}) => {
        const url = typeof input === "string" ? input : input?.url || "";
        let api = null;
        try { api = new URL(url, window.location.href); } catch { /* not a URL */ }
        const base = (() => { try { return new URL(getBackendUrl(), window.location.href).origin; } catch { return null; } })();
        if (!api || api.origin !== base || !api.pathname.startsWith("/api/")) return original(input, init);

        const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined) || {});
        // First load: wait until the saved sign-in is restored, or the request goes out anonymous.
        if (!headers.has("Authorization")) await auth.authStateReady?.().catch(() => { });
        if (!headers.has("Authorization") && auth.currentUser) {
            const token = await auth.currentUser.getIdToken().catch(() => null);
            if (token) headers.set("Authorization", `Bearer ${token}`);
        }
        const project = /^\/api\/(?:github\/)?projects\/(\d+)/.exec(api.pathname);
        if (project && !headers.has("X-Project-Key")) {
            const key = projectKey(project[1]);
            if (key) headers.set("X-Project-Key", key);
        }
        return original(input, { ...init, headers });
    };
    wrapped.__colabsAuth = true;
    window.fetch = wrapped;
}
