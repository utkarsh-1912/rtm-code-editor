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
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        backgroundColor: "transparent",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "600"
                    }}
                >
                    <ArrowLeft size={16} /> Back
                </button>

                <button
                    onClick={toggleTheme}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: isLightMode ? "#fbbf24" : "var(--text-muted)",
                        transition: "all 0.2s"
                    }}
                >
                    {isLightMode ? <Sun size={14} /> : <Moon size={14} />}
                </button>
            </header>

            {/* CONTENT */}
            <main style={{
                flex: 1,
                width: "100%",
                maxWidth: "760px",
                margin: "0 auto",
                padding: "48px 24px",
                position: "relative",
                zIndex: 1
            }}>
                <h1 style={{ fontSize: "2.5rem", fontWeight: "700", marginBottom: "32px" }}>{title}</h1>
                <div style={{ fontSize: "15px", lineHeight: "1.6", color: "var(--text-muted)" }}>
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
                © {new Date().getFullYear()} Utkristi Colabs. All rights reserved.
            </footer>
        </div>
    );
}
