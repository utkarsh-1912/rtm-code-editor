import React, { useState, useEffect } from "react";
import { getBackendUrl } from "../../utils/api";

const Footer = ({ isLightMode }) => {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch(`${getBackendUrl()}/api/ping`);
                const data = await response.json();
                setIsOnline(data.success);
            } catch (err) {
                setIsOnline(false);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    return (
        <footer style={{
            padding: "40px 5%", borderTop: "1px solid var(--border-color-soft)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: "13px", color: "var(--text-muted)", position: "relative", zIndex: 10,
            backgroundColor: "var(--bg-footer)", backdropFilter: "blur(10px)",
            gap: "20px",
            flexWrap: "wrap"
        }} className="landing-footer">
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                flexWrap: "wrap",
                justifyContent: "center"
            }} className="footer-left">
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    whiteSpace: "nowrap"
                }}>
                    <div style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: isOnline ? "#4ade80" : "#f87171",
                        boxShadow: `0 0 10px ${isOnline ? "#4ade80" : "#f87171"}`
                    }}></div>
                    <span style={{ fontWeight: "600" }}>
                        {isOnline ? "System Online" : "System Offline"}
                    </span>
                </div>
                <span>&copy; 2026 Utkristi Colabs. All rights reserved.</span>
            </div>
            <div style={{ display: "flex", gap: "32px", fontWeight: "600" }} className="footer-right">
                <a href="/about" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="footer-link">About</a>
                <a href="/privacy" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="footer-link">Privacy</a>
                <a href="/terms" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="footer-link">Terms</a>
            </div>
        </footer>
    );
};

export default Footer;
