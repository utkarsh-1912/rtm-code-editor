import React from "react";
import { Sun, Moon, LayoutDashboard } from "lucide-react";

const Navbar = ({ user, isLightMode, toggleTheme, navigate }) => {
    return (
        <header style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 5%",
            position: "relative",
            zIndex: 10
        }}>
            <div
                style={{ cursor: "pointer", transition: "transform 0.2s", width: "160px" }}
                onClick={() => navigate("/")}
                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
                <img src="/utkristi-colabs.png" alt="Logo" style={{ width: "100%", height: "auto", display: "block" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {user ? (
                    <button
                        onClick={() => navigate("/dashboard")}
                        style={{
                            display: "flex", alignItems: "center", gap: "10px", padding: "0 12px",
                            height: "44px",
                            backgroundColor: isLightMode ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.12)",
                            border: "1px solid rgba(59, 130, 246, 0.25)",
                            borderRadius: "12px", color: "var(--primary)", fontSize: "14px", fontWeight: "700", cursor: "pointer",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", backdropFilter: "blur(8px)"
                        }}
                    >
                        <LayoutDashboard size={18} /> Dashboard
                    </button>
                ) : (
                    <button
                        onClick={() => navigate("/signup")}
                        style={{
                            padding: "0 16px", height: "44px", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)",
                            borderRadius: "12px", color: "var(--text-main)", fontSize: "14px", fontWeight: "600", cursor: "pointer",
                            transition: "all 0.3s ease"
                        }}
                        onMouseOver={(e) => { e.target.style.borderColor = "var(--primary)"; }}
                        onMouseOut={(e) => { e.target.style.borderColor = "var(--border-color)"; }}
                    >
                        Sign In
                    </button>
                )}
                <button
                    onClick={toggleTheme}
                    style={{
                        width: "44px", height: "44px", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)",
                        borderRadius: "12px", cursor: "pointer", color: isLightMode ? "#fbbf24" : "var(--text-muted)",
                        display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s ease"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--border-color)"}
                >
                    {isLightMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>
        </header>
    );
};

export default Navbar;
