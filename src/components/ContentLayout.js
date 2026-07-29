import React, { useState } from "react";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ContentLayout({ title, children }) {
    const navigate = useNavigate();
    const [isLightMode, setIsLightMode] = useState(() => {
        return localStorage.getItem("app-theme") === "light";
    });

    const toggleTheme = () => {
        const newMode = !isLightMode;
        setIsLightMode(newMode);
        if (newMode) {
            document.documentElement.classList.add("light-theme");
            localStorage.setItem("app-theme", "light");
        } else {
            document.documentElement.classList.remove("light-theme");
            localStorage.setItem("app-theme", "dark");
        }
    };

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
            {/* HEADER */}
            <header style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 8%",
                position: "sticky",
                top: 0,
                backgroundColor: "var(--bg-dark)",
                zIndex: 100,
                borderBottom: "1px solid var(--border-color)"
            }}>
                <button
                    onClick={() => navigate("/")}
                    className="secondary-action-btn hover-bounce"
                    style={{
                        padding: "8px 16px",
                        fontSize: "13px",
                        fontWeight: "700"
                    }}
                >
                    <ArrowLeft size={16} /> Back
                </button>

                <button
                    onClick={toggleTheme}
                    className="secondary-action-btn hover-bounce"
                    style={{
                        width: "36px",
                        height: "36px",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isLightMode ? "#fbbf24" : "var(--text-muted)",
                        borderRadius: "8px"
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
                margin: "40px auto 80px",
                padding: "0 24px",
                position: "relative",
                zIndex: 1
            }}>
                <div className="glassmorphic-card" style={{ padding: "40px", border: "1px solid var(--border-color)" }}>
                    <h1 style={{ fontSize: "2.2rem", fontWeight: "800", marginBottom: "32px", color: "var(--text-main)", fontFamily: "'Outfit', sans-serif" }}>{title}</h1>
                    <div style={{ fontSize: "15px", lineHeight: "1.7", color: "var(--text-muted)" }}>
                        {children}
                    </div>
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
                © {new Date().getFullYear()} Utkristi Colabs. All rights reserved.
            </footer>
        </div>
    );
}
