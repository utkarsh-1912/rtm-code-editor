import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
    browserLocalPersistence,
    indexedDBLocalPersistence,
    setPersistence,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { auth, googleProvider, githubProvider } from '../firebase';
import { pushLogin, pushLogout } from '../utils/push';

const AuthContext = createContext();

// Last known identity, so the name/avatar render at once (desktop app, sleeping backend, offline).
const CACHE_KEY = 'rtm_user_cache';
const readCache = (uid) => {
    try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        return c && c.uid === uid ? c : null;
    } catch { return null; }
};
const writeCache = (u) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(u)); } catch { /* storage blocked */ } };

// The hosted backend can be cold; retry quietly instead of giving up after one failure.
const withRetry = async (fn, tries = 6) => {
    let delay = 1500;
    for (let i = 0; i < tries; i++) {
        try { return await fn(); } catch (e) {
            if (i === tries - 1) throw e;
            await new Promise((r) => setTimeout(r, delay));
            delay = Math.min(delay * 1.6, 10000);
        }
    }
    return null;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Stable identity so effects that depend on it do not loop.
    const refreshProfile = useCallback(async (uid) => {
        if (!uid) return;
        try {
            const { getBackendUrl } = await import('../utils/api');
            const profileRes = await fetch(`${getBackendUrl()}/api/user/profile?userId=${uid}`);
            if (!profileRes.ok) return;
            const profileData = await profileRes.json();

            if (profileData) {
                const data = Array.isArray(profileData) ? profileData[0] : profileData;
                if (data && data.last_room_id) {
                    setUser(prev => {
                        if (!prev) return prev; // Guard: don't update if user is null
                        return { ...prev, last_room_id: data.last_room_id };
                    });
                }
            }
        } catch (e) {
            console.error("AuthContext: Profile refresh failed", e);
        }
    }, []);


    // Profile + session bookkeeping; never blocks the UI.
    const syncWithBackend = async (identity) => {
        const uid = identity.uid;
        try {
            const { getBackendUrl } = await import('../utils/api');
            await withRetry(async () => {
                const r = await fetch(`${getBackendUrl()}/api/user/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid, email: identity.email, name: identity.name, photoURL: identity.photoURL }),
                });
                if (!r.ok) throw new Error(`sync ${r.status}`);
            });
            const profileRes = await withRetry(async () => {
                const r = await fetch(`${getBackendUrl()}/api/user/profile?userId=${uid}`);
                if (!r.ok) throw new Error(`profile ${r.status}`);
                return r;
            });
            if (profileRes.ok) {
                const profileData = await profileRes.json();
                const data = Array.isArray(profileData) ? profileData[0] : profileData;
                if (data) {
                    setUser((prev) => {
                        if (!prev || prev.uid !== uid) return prev;
                        const next = {
                            ...prev,
                            ...(data.last_room_id ? { last_room_id: data.last_room_id } : {}),
                            ...(data.name ? { name: data.name } : {}),
                            ...(data.photo_url && !prev.photoURL ? { photoURL: data.photo_url } : {}),
                        };
                        writeCache(next);
                        return next;
                    });
                }
            }

            const response = await fetch(`${getBackendUrl()}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: uid,
                    device: navigator.platform,
                    ip: 'Auto',
                    userAgent: navigator.userAgent,
                    sessionId: localStorage.getItem('rtm_db_session_id')
                })
            });
            if (response.ok) {
                const sessionData = await response.json();
                const id = sessionData?.[0]?.id ?? sessionData?.id;
                if (id) localStorage.setItem('rtm_db_session_id', id);
            }
        } catch (e) {
            console.warn("Backend sync deferred:", e.message);
        }
    };

    useEffect(() => {
        // Keep the session across restarts (matters inside the desktop shell).
        setPersistence(auth, indexedDBLocalPersistence).catch(() => setPersistence(auth, browserLocalPersistence)).catch(() => { });
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (!firebaseUser) {
                setUser(null);
                setLoading(false);
                return;
            }

            // Show the signed-in person straight away; the backend may still be waking up.
            const provider = firebaseUser.providerData?.[0] || {};
            const cached = readCache(firebaseUser.uid) || {};
            const userData = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || provider.displayName || cached.name || (firebaseUser.email || provider.email || "").split("@")[0] || "You",
                email: firebaseUser.email || provider.email || cached.email || "",
                photoURL: firebaseUser.photoURL || provider.photoURL || cached.photoURL || null,
                ...(cached.last_room_id ? { last_room_id: cached.last_room_id } : {}),
            };
            writeCache(userData);
            setUser(userData);
            pushLogin(userData.uid, userData.email);
            setLoading(false);
            syncWithBackend(userData);
        });

        return () => unsubscribe();
    }, []);

    const loginWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Google Auth Error:", error);
            throw error;
        }
    };

    const loginWithGitHub = async () => {
        try {
            await signInWithPopup(auth, githubProvider);
        } catch (error) {
            console.error("GitHub Auth Error:", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            localStorage.removeItem(CACHE_KEY);
            pushLogout();
            await signOut(auth);
        } catch (error) {
            console.error("Sign Out Error:", error);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loginWithGoogle,
            loginWithGitHub,
            logout,
            refreshProfile,
            loading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
