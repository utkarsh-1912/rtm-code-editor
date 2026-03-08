import React, { useState, useEffect } from "react";
import { Sun, Moon, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const Navbar = ({ user, isLightMode, toggleTheme, navigate }) => {
    const { logout } = useAuth();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <header style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "16px 5%" : "24px 5%",
            position: "relative",
            zIndex: 10
        }}>
            <div
                style={{ cursor: "pointer", transition: "transform 0.2s", width: isMobile ? "130px" : "160px" }}
                onClick={() => navigate("/")}
                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
                <img src="/utkristi-colabs.png" alt="Logo" style={{ width: "100%", height: "auto", display: "block" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "8px" : "12px" }}>
                {user ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                            onClick={() => navigate("/dashboard")}
                            title="Dashboard"
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: "10px", padding: isMobile ? "0" : "0 20px",
                                width: isMobile ? "44px" : "auto",
                                height: "44px",
                                background: "linear-gradient(135deg, var(--primary) 0%, #2563eb 100%)",
                                border: "none",
                                borderRadius: "12px", color: "white", fontSize: "14px", fontWeight: "700", cursor: "pointer",
                                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", backdropFilter: "blur(8px)",
                                boxShadow: "0 4px 15px -3px rgba(59, 130, 246, 0.4)"
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.boxShadow = "0 8px 20px -3px rgba(59, 130, 246, 0.5)";
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 4px 15px -3px rgba(59, 130, 246, 0.4)";
                            }}
                        >
                            <LayoutDashboard size={18} />
                            {!isMobile && <span>Dashboard</span>}
                        </button>
                        <button
                            onClick={logout}
                            title="Sign Out"
                            style={{
                                width: "44px", height: "44px",
                                backgroundColor: isLightMode ? "rgba(244, 63, 94, 0.05)" : "rgba(244, 63, 94, 0.08)",
                                border: "1px solid rgba(244, 63, 94, 0.2)",
                                borderRadius: "12px", color: "#f43f5e",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer", transition: "all 0.3s ease"
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = "rgba(244, 63, 94, 0.15)";
                                e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.4)";
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = isLightMode ? "rgba(244, 63, 94, 0.05)" : "rgba(244, 63, 94, 0.08)";
                                e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.2)";
                            }}
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
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
