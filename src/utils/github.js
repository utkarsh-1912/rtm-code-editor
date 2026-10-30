import { useCallback, useEffect, useState } from "react";
import { auth } from "../firebase";
import { getBackendUrl } from "./api";

// GitHub endpoints identify the caller by Firebase ID token. The GitHub token itself
// stays on the server; the browser only sees results.
export async function githubApi(path, options = {}) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw Object.assign(new Error("Sign in to use GitHub"), { code: "SIGN_IN" });
    const res = await fetch(`${getBackendUrl()}/api/github${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
        body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `GitHub request failed (${res.status})`), { status: res.status, code: data.code, data });
    return data;
}

// Message the Settings page posts to its opener when connecting finished in a popup.
export const CONNECTED_MESSAGE = "colabs-github";

// Send the browser to GitHub to connect. In a popup when possible (keeps the room or
// project open), otherwise in this tab; either way GitHub returns to Settings.
export async function connectGitHub({ popup = true } = {}) {
    const win = popup ? window.open("", "colabs-github", "width=720,height=780") : null;
    try {
        const returnTo = `${window.location.origin}/settings?section=connections`;
        const { url } = await githubApi(`/connect?returnTo=${encodeURIComponent(returnTo)}`);
        if (win && !win.closed) win.location.href = url;
        else window.location.assign(url);
    } catch (err) {
        if (win && !win.closed) win.close();
        throw err;
    }
}

export const disconnectGitHub = () => githubApi("", { method: "DELETE" });

// { configured, connected, login, scopes } for the signed-in person; refreshes when a
// connect popup reports back or the window regains focus.
export function useGitHubStatus(user, enabled = true) {
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);
    const reload = useCallback(async () => {
        if (!user?.uid || !enabled) return;
        try {
            setStatus(await githubApi(""));
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    }, [user?.uid, enabled]);
    useEffect(() => {
        reload();
        if (!enabled) return undefined;
        const onMessage = (e) => e.origin === window.location.origin && e.data?.type === CONNECTED_MESSAGE && reload();
        window.addEventListener("message", onMessage);
        window.addEventListener("focus", reload);
        return () => {
            window.removeEventListener("message", onMessage);
            window.removeEventListener("focus", reload);
        };
    }, [reload, enabled]);
    return { status, error, reload };
}
