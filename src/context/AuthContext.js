import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { auth, googleProvider, githubProvider } from '../firebase';

const AuthContext = createContext();

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
    const syncWithBackend = async (uid) => {
        try {
            const { getBackendUrl } = await import('../utils/api');
            const profileRes = await fetch(`${getBackendUrl()}/api/user/profile?userId=${uid}`);
            if (profileRes.ok) {
                const profileData = await profileRes.json();
                const data = Array.isArray(profileData) ? profileData[0] : profileData;
                if (data) {
                    setUser((prev) => (prev && prev.uid === uid ? {
                        ...prev,
                        ...(data.last_room_id ? { last_room_id: data.last_room_id } : {}),
                        ...(data.name ? { name: data.name } : {}),
                    } : prev));
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
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (!firebaseUser) {
                setUser(null);
                setLoading(false);
                return;
            }

            // Show the signed-in person straight away; the backend may still be waking up.
            const provider = firebaseUser.providerData?.[0] || {};
            const userData = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || provider.displayName || (firebaseUser.email || "").split("@")[0] || "You",
                email: firebaseUser.email || provider.email || "",
                photoURL: firebaseUser.photoURL || provider.photoURL || null,
            };
            setUser(userData);
            setLoading(false);
            syncWithBackend(firebaseUser.uid);
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
