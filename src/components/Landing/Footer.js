import React from "react";

const Footer = ({ isLightMode }) => {
    return (
        <footer style={{
            padding: "40px 5%", borderTop: "1px solid var(--border-color-soft)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: "13px", color: "var(--text-muted)", position: "relative", zIndex: 10,
            backgroundColor: "var(--bg-footer)", backdropFilter: "blur(10px)"
        }} className="landing-footer">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }} className="footer-left">
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#4ade80", boxShadow: "0 0 10px #4ade80" }}></div>
                <span>System Online &bull; &copy; 2026 Utkristi Colabs</span>
            </div>
            <div style={{ display: "flex", gap: "40px", fontWeight: "600" }} className="footer-right">
                <a href="/about" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="footer-link">About</a>
                <a href="/privacy" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="footer-link">Privacy</a>
                <a href="/terms" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="footer-link">Terms</a>
            </div>
        </footer>
    );
};

export default Footer;
