import React, { useState, useEffect } from "react";
import { Zap, Shield, Cpu, Globe } from "lucide-react";

const LoadingScreen = ({ isLightMode }) => {
    const [progress, setProgress] = useState(0);
    const [statusIndex, setStatusIndex] = useState(0);

    const statuses = [
        "Initializing global core...",
        "Establishing secure handshake...",
        "Warming up distributed nodes...",
        "Synchronizing workspace protocols...",
        "Finalizing quantum link..."
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => (prev < 90 ? prev + Math.random() * 5 : prev));
        }, 800);

        const statusInterval = setInterval(() => {
            setStatusIndex((prev) => (prev + 1) % statuses.length);
        }, 2000);

        return () => {
            clearInterval(interval);
            clearInterval(statusInterval);
        };
    }, []);

    return (
        <div style={{
            height: "100vh",
            width: "100vw",
            backgroundColor: "var(--bg-dark)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 9999,
            overflow: "hidden",
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* Animated Background Orbs */}
            <div className="bg-mesh" style={{ opacity: 0.6 }}>
                <div className="mesh-orb orb-1" style={{ background: "radial-gradient(circle, rgba(59, 130, 246, 0.2), transparent)" }}></div>
                <div className="mesh-orb orb-2" style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.15), transparent)" }}></div>
            </div>

            <div style={{ position: "relative", zIndex: 10, textAlign: "center", width: "100%", maxWidth: "400px", padding: "0 20px" }}>
                <div className="loader-icon-container" style={{
                    marginBottom: "40px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "80px",
                    height: "80px",
                    borderRadius: "24px",
                    backgroundColor: "rgba(59, 130, 246, 0.08)",
                    border: "1px solid rgba(59, 130, 246, 0.2)",
                    position: "relative"
                }}>
                    <Cpu size={40} color="var(--primary)" className="pulse-animation" />
                    <div className="loader-ring"></div>
                </div>

                <h2 style={{
                    fontSize: "24px",
                    fontWeight: "800",
                    color: "var(--text-main)",
                    marginBottom: "12px",
                    letterSpacing: "-0.02em"
                }}>
                    Utkristi <span style={{ color: "var(--primary)" }}>Colabs</span>
                </h2>

                <div style={{ height: "24px", marginBottom: "32px" }}>
                    <p className="status-text" style={{
                        fontSize: "14px",
                        color: "var(--text-muted)",
                        fontWeight: "500",
                        animation: "fadeInOut 2s infinite"
                    }}>
                        {statuses[statusIndex]}
                    </p>
                </div>

                {/* Progress Bar Container */}
                <div style={{
                    width: "100%",
                    height: "6px",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    marginBottom: "16px"
                }}>
                    <div style={{
                        width: `${progress}%`,
                        height: "100%",
                        background: "linear-gradient(to right, #60a5fa, #3b82f6)",
                        boxShadow: "0 0 15px rgba(59, 130, 246, 0.5)",
                        transition: "width 0.8s ease-out",
                        borderRadius: "10px"
                    }}></div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "rgba(59, 130, 246, 0.6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Global Reach</span>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)" }}>{Math.round(progress)}%</span>
                </div>
            </div>

            <div style={{
                position: "absolute",
                bottom: "40px",
                display: "flex",
                gap: "32px",
                opacity: 0.4
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><Shield size={14} /> <span style={{ fontSize: "11px", fontWeight: "600" }}>SECURE</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><Zap size={14} /> <span style={{ fontSize: "11px", fontWeight: "600" }}>RT-SYNC</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><Globe size={14} /> <span style={{ fontSize: "11px", fontWeight: "600" }}>GLOBAL</span></div>
            </div>

            <style>{`
                .loader-ring {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 24px;
                    border: 2px solid transparent;
                    border-top-color: var(--primary);
                    animation: spin 1.5s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @keyframes fadeInOut {
                    0%, 100% { opacity: 0.3; transform: translateY(5px); }
                    50% { opacity: 1; transform: translateY(0); }
                }

                .pulse-animation {
                    animation: pulse 2s ease-in-out infinite;
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.1); opacity: 1; }
                }

                .bg-mesh {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 0;
                }

                .mesh-orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(100px);
                    animation: float 20s infinite alternate;
                }

                .orb-1 { width: 400px; height: 400px; top: -100px; left: -100px; }
                .orb-2 { width: 300px; height: 300px; bottom: -50px; right: -50px; }

                @keyframes float {
                    0% { transform: translate(0, 0); }
                    100% { transform: translate(30px, 30px); }
                }
            `}</style>
        </div>
    );
};

export default LoadingScreen;
