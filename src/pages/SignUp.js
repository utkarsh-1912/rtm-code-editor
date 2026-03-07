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

const SignUp = () => {
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
            toast.success("Welcome to the community!");
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

            {/* LEFT PANEL: BRAND & GRADIENT (Hidden on mobile) */}
            <div className="login-left-panel" style={{
                flex: 1,
                background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "80px",
                overflow: "hidden"
            }}>
                <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "60%", height: "60%", background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", filter: "blur(100px)" }}></div>
                <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "60%", height: "60%", background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", filter: "blur(100px)" }}></div>

                <div style={{ position: "relative", zIndex: 2, maxWidth: "500px" }}>
                    <h1 style={{ fontSize: "48px", fontWeight: "900", lineHeight: 1.1, marginBottom: "24px", letterSpacing: "-0.04em" }}>
                        Join the <br />
                        <span style={{ background: "linear-gradient(to right, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>innovation hub.</span>
                    </h1>
                    <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: "48px" }}>
                        Experience the most powerful collaborative coding platform. Build together, scale faster, and connect with global developers.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ background: "rgba(255,255,255,0.05)", padding: "12px", borderRadius: "12px", color: "#60a5fa" }}><Zap size={20} /></div>
                            <span style={{ fontSize: "16px", fontWeight: "600", color: "#ffffffff" }}>Limitless real-time sync</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ background: "rgba(255,255,255,0.05)", padding: "12px", borderRadius: "12px", color: "#4ade80" }}><Globe size={20} /></div>
                            <span style={{ fontSize: "16px", fontWeight: "600", color: "#ffffffff" }}>Global infrastructure access</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ background: "rgba(255,255,255,0.05)", padding: "12px", borderRadius: "12px", color: "#f87171" }}><Lock size={20} /></div>
                            <span style={{ fontSize: "16px", fontWeight: "600", color: "#ffffffff" }}>Secure, team-based workspaces</span>
                        </div>
                    </div>
                </div>

                <div style={{ position: "absolute", bottom: "40px", left: "80px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
                    &copy; 2026 Utkristi Colabs. Empowering builders everywhere.
                </div>
            </div>

            {/* RIGHT PANEL: AUTH FORM */}
            <div className="login-right-panel" style={{
                width: "600px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "60px",
                position: "relative"
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
                        fontSize: "14px",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontWeight: "600",
                        transition: "all 0.2s"
                    }}
                    onMouseOver={(e) => e.target.style.color = "var(--primary)"}
                    onMouseOut={(e) => e.target.style.color = "var(--text-muted)"}
                >
                    <ArrowLeft size={16} /> Back to Home
                </div>

                <div style={{ maxWidth: "400px", width: "100%", margin: "0 auto" }}>
                    <div style={{ marginBottom: "40px" }}>
                        <h2 style={{ fontSize: "32px", fontWeight: "800", marginBottom: "8px", letterSpacing: "-0.02em" }}>Sign In</h2>
                        <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>Join Utkristi Colabs to sync your work across devices.</p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <button
                            onClick={() => handleLogin("google")}
                            onMouseEnter={() => setIsHovered('google')}
                            onMouseLeave={() => setIsHovered(null)}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                                width: "100%", padding: "16px", borderRadius: "14px", border: "1px solid var(--border-color)",
                                backgroundColor: isHovered === 'google' ? "rgba(255,255,255,0.05)" : "var(--bg-card)",
                                color: "var(--text-main)", fontSize: "16px", fontWeight: "700",
                                cursor: "pointer", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                            }}
                        >
                            <Mail size={20} color="#ea4335" /> Continue with Google
                        </button>

                        <button
                            onClick={() => handleLogin("github")}
                            onMouseEnter={() => setIsHovered('github')}
                            onMouseLeave={() => setIsHovered(null)}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                                width: "100%", padding: "16px", borderRadius: "14px", border: "1px solid var(--border-color)",
                                backgroundColor: isHovered === 'github' ? "rgba(255,255,255,0.05)" : "var(--bg-card)",
                                color: "var(--text-main)", fontSize: "16px", fontWeight: "700",
                                cursor: "pointer", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                            }}
                        >
                            <Github size={20} /> Continue with GitHub
                        </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "32px 0", color: "var(--border-color)" }}>
                        <div style={{ flex: 1, height: "1px", backgroundColor: "currentcolor" }}></div>
                        <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>or access as guest</span>
                        <div style={{ flex: 1, height: "1px", backgroundColor: "currentcolor" }}></div>
                    </div>

                    <div style={{
                        backgroundColor: "rgba(59, 130, 246, 0.03)",
                        border: "1px dashed var(--primary)",
                        padding: "24px",
                        borderRadius: "20px",
                        textAlign: "center"
                    }}>
                        <ShieldCheck size={24} style={{ color: "var(--primary)", marginBottom: "12px" }} />
                        <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>Continue as Guest</h4>
                        <button
                            onClick={() => navigate("/")}
                            style={{
                                width: "100%", padding: "12px", borderRadius: "12px", border: "none",
                                backgroundColor: "var(--primary)", color: "white", fontSize: "14px", fontWeight: "800",
                                cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                            }}
                        >
                            Launch Editor <ChevronRight size={16} />
                        </button>
                    </div>

                    <p style={{ textAlign: "center", marginTop: "40px", fontSize: "14px", color: "var(--text-muted)" }}>
                        Already have an account? <span onClick={() => navigate("/login")} style={{ color: "var(--primary)", fontWeight: "700", cursor: "pointer" }}>Login</span>
                    </p>
                </div>
            </div>

            <style>{`
        @media (max-width: 1024px) {
          .login-left-panel { display: none !important; }
          .login-right-panel { 
            width: 100% !important; 
            padding: 40px 20px !important; 
            justify-content: center !important;
            align-items: center !important;
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

export default SignUp;
