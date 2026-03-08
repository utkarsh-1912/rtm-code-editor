import React, { createContext, useContext, useEffect, useState } from 'react';
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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userData = {
                    uid: firebaseUser.uid,
                    name: firebaseUser.displayName,
                    email: firebaseUser.email,
                    photoURL: firebaseUser.photoURL
                };
                setUser(userData);

                // Track session
                let sessionId = localStorage.getItem('rtm_session_id');
                if (!sessionId) {
                    sessionId = Math.random().toString(36).substring(2, 15);
                    localStorage.setItem('rtm_session_id', sessionId);
                }

                try {
                    const { getBackendUrl } = await import('../utils/api');
                    const response = await fetch(`${getBackendUrl()}/api/sessions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: firebaseUser.uid,
                            device: navigator.platform,
                            ip: 'Auto',
                            userAgent: navigator.userAgent
                        })
                    });
                    const sessionData = await response.json();
                    if (sessionData && sessionData[0] && sessionData[0].id) {
                        localStorage.setItem('rtm_db_session_id', sessionData[0].id);
                    }
                } catch (e) {
                    console.error("Session tracking failed", e);
                }

            } else {
                setUser(null);
            }
            setLoading(false);
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
            loading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
