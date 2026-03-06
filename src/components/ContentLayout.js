import React, { useEffect, useState } from "react";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ContentLayout({ title, children }) {
    const navigate = useNavigate();
    const [isLightMode, setIsLightMode] = useState(() => {
        return localStorage.getItem("app-theme") === "light";
    });

    useEffect(() => {
        if (isLightMode) {
            document.documentElement.classList.add("light-theme");
            localStorage.setItem("app-theme", "light");
        } else {
            document.documentElement.classList.remove("light-theme");
            localStorage.setItem("app-theme", "dark");
        }
    }, [isLightMode]);

    return (
        <div style={{
            minHeight: "100vh",
            backgroundColor: "var(--bg-dark)",
            color: "var(--text-main)",
            fontFamily: "'Outfit', sans-serif",
            position: "relative",
            display: "flex",
            flexDirection: "column"
        }}>
            {/* BACKGROUND ELEMENTS */}
            <div style={{ position: "absolute", top: "10%", left: "-5%", width: "40vw", height: "40vw", background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", filter: "blur(60px)", zIndex: 0 }}></div>

            {/* HEADER */}
            <header style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "24px 8%",
                position: "sticky",
                top: 0,
                backgroundColor: "rgba(var(--bg-dark-rgb), 0.8)",
                backdropFilter: "blur(12px)",
                zIndex: 100,
                borderBottom: "1px solid var(--border-color)"
            }}>
                <button
                    onClick={() => navigate("/")}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        backgroundColor: "transparent",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: "15px",
                        fontWeight: "600",
                        transition: "color 0.2s"
                    }}
                    onMouseOver={(e) => e.target.style.color = "var(--primary)"}
                    onMouseOut={(e) => e.target.style.color = "var(--text-muted)"}
                >
                    <ArrowLeft size={18} /> Back to Home
                </button>

                <button
                    onClick={() => setIsLightMode(!isLightMode)}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "38px",
                        height: "38px",
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "10px",
                        cursor: "pointer",
                        color: isLightMode ? "#fbbf24" : "var(--text-muted)",
                        transition: "all 0.2s"
                    }}
                >
                    {isLightMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </header>

            {/* CONTENT */}
            <main style={{
                flex: 1,
                width: "100%",
                maxWidth: "800px",
                margin: "0 auto",
                padding: "60px 24px",
                position: "relative",
                zIndex: 1
            }}>
                <h1 style={{ fontSize: "3rem", fontWeight: "800", marginBottom: "40px", letterSpacing: "-0.02em" }}>{title}</h1>
                <div style={{ fontSize: "17px", lineHeight: "1.8", color: "var(--text-muted)" }}>
                    {children}
                </div>
            </main>

            {/* FOOTER */}
            <footer style={{
                padding: "32px 8%",
                borderTop: "1px solid var(--border-color)",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "14px"
            }}>
                © 2026 Utkristi Colabs. All rights reserved.
            </footer>
        </div>
    );
}
