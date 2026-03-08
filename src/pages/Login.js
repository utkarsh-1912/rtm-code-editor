import React, { useState, useEffect } from "react";
import {
    Github,
    Mail,
    ArrowLeft,
    ShieldCheck,
    Zap,
    Globe,
    Lock,
    ChevronRight
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const Login = () => {
    const { loginWithGoogle, loginWithGitHub, user, loading } = useAuth();
    const navigate = useNavigate();
    const [isHovered, setIsHovered] = useState(null);

    useEffect(() => {
        if (user) {
            navigate("/dashboard");
        }
    }, [user, navigate]);

    const handleLogin = async (provider) => {
        try {
            if (provider === "google") await loginWithGoogle();
            if (provider === "github") await loginWithGitHub();
            toast.success("Welcome back!");
        } catch (error) {
            toast.error(`Authentication failed: ${error.message}`);
        }
    };

    if (loading) {
        return (
            <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-dark)" }}>
                <div style={{ color: "var(--primary)", fontSize: "1.2rem", fontWeight: "bold" }}>Authenticating...</div>
            </div>
        );
    }

    return (
        <div style={{ height: "100vh", width: "100vw", display: "flex", backgroundColor: "var(--bg-dark)", color: "var(--text-main)", overflowX: "hidden" }}>

            {/* LEFT PANEL: BRAND & INFO (Hidden on mobile) */}
            <div className="login-left-panel" style={{
                flex: 1,
                backgroundColor: '#0f172a',
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "80px",
                borderRight: "1px solid var(--border-color)"
            }}>
                <div style={{ position: "relative", zIndex: 2, maxWidth: "480px" }}>
                    <h1 style={{ fontSize: "40px", fontWeight: "700", lineHeight: 1.2, marginBottom: "24px", color: 'white' }}>
                        The professional workspace for engineers.
                    </h1>
                    <p style={{ fontSize: "16px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "48px" }}>
                        Experience a high-performance collaborative environment with real-time synchronization and cloud execution.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ color: "var(--primary)" }}><Zap size={18} /></div>
                            <span style={{ fontSize: "14px", fontWeight: "500", color: 'rgba(255,255,255,0.8)' }}>Real-time state synchronization</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ color: "#4ade80" }}><Globe size={18} /></div>
                            <span style={{ fontSize: "14px", fontWeight: "500", color: 'rgba(255,255,255,0.8)' }}>Instant multi-language execution</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ color: "#f87171" }}><Lock size={18} /></div>
                            <span style={{ fontSize: "14px", fontWeight: "500", color: 'rgba(255,255,255,0.8)' }}>Secure encrypted sessions</span>
                        </div>
                    </div>
                </div>

                <div style={{ position: "absolute", bottom: "40px", left: "80px", color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>
                    &copy; 2026 Utkristi Colabs. Industrial grade collaboration.
                </div>
            </div>

            {/* RIGHT PANEL: AUTH FORM */}
            <div className="login-right-panel" style={{
                width: "540px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "60px",
                position: "relative",
                backgroundColor: 'var(--bg-dark)'
            }}>
                <div
                    onClick={() => navigate("/")}
                    style={{
                        position: "absolute",
                        top: "40px",
                        left: "60px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "13px",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontWeight: "600"
                    }}
                >
                    <ArrowLeft size={14} /> Back
                </div>

                <div style={{ maxWidth: "360px", width: "100%", margin: "0 auto" }}>
                    <div style={{ marginBottom: "32px" }}>
                        <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>Sign In</h2>
                        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Access your workspace to continue building.</p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <button
                            onClick={() => handleLogin("google")}
                            onMouseEnter={() => setIsHovered('google')}
                            onMouseLeave={() => setIsHovered(null)}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                                width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)",
                                backgroundColor: isHovered === 'google' ? "var(--bg-card)" : "transparent",
                                color: "var(--text-main)", fontSize: "14px", fontWeight: "600",
                                cursor: "pointer", transition: "all 0.2s"
                            }}
                        >
                            <Mail size={18} color="var(--primary)" /> Continue with Google
                        </button>

                        <button
                            onClick={() => handleLogin("github")}
                            onMouseEnter={() => setIsHovered('github')}
                            onMouseLeave={() => setIsHovered(null)}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                                width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)",
                                backgroundColor: isHovered === 'github' ? "var(--bg-card)" : "transparent",
                                color: "var(--text-main)", fontSize: "14px", fontWeight: "600",
                                cursor: "pointer", transition: "all 0.2s"
                            }}
                        >
                            <Github size={18} /> Continue with GitHub
                        </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "24px 0" }}>
                        <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border-color)" }}></div>
                        <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: "var(--text-muted)" }}>or guest</span>
                        <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border-color)" }}></div>
                    </div>

                    <div style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        padding: "24px",
                        borderRadius: "12px",
                        textAlign: "center"
                    }}>
                        <ShieldCheck size={20} style={{ color: "var(--primary)", marginBottom: "8px" }} />
                        <h4 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>Quick Access</h4>
                        <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "16px" }}>Join as a guest to use the core editor.</p>
                        <button
                            onClick={() => navigate("/")}
                            style={{
                                width: "100%", padding: "10px", borderRadius: "6px", border: "none",
                                backgroundColor: "var(--primary)", color: "white", fontSize: "13px", fontWeight: "600",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                            }}
                        >
                            Launch Editor <ChevronRight size={14} />
                        </button>
                    </div>

                    <p style={{ textAlign: "center", marginTop: "32px", fontSize: "13px", color: "var(--text-muted)" }}>
                        Don't have an account? <span onClick={() => navigate("/signup")} style={{ color: "var(--primary)", fontWeight: "600", cursor: "pointer" }}>Join Now</span>
                    </p>
                </div>
            </div>

            <style>{`
        @media (max-width: 900px) {
          .login-left-panel { display: none !important; }
          .login-right-panel { 
            width: 100% !important; 
            padding: 32px 20px !important; 
          }
          .login-right-panel > div:first-of-type {
            left: 20px !important;
            top: 24px !important;
          }
        }
      `}</style>
        </div>
    );
};

export default Login;
