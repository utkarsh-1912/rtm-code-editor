import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Shell, { ThemeButton, useThemeToggle } from "../ux/Shell";

const LINKS = [
    { to: "/features", label: "Features" },
    { to: "/pricing", label: "Pricing" },
    { to: "/download", label: "Download" },
    { to: "/about", label: "About" },
    { to: "/support", label: "Support" },
];

const COLUMNS = [
    { title: "Product", links: [["Features", "/features"], ["Pricing", "/pricing"], ["Download", "/download"]] },
    { title: "Company", links: [["About", "/about"], ["Security", "/security"], ["Support", "/support"]] },
    { title: "Resources", links: [["Status", "/status"], ["Source code", "https://github.com/utkarsh-1912/rtm-code-editor"]] },
    { title: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"]] },
];

// Chrome for the public site; shares header, menu and footer with the signed-in app.
export default function SiteLayout({ children }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isLight, toggleTheme] = useThemeToggle();

    return (
        <Shell
            links={LINKS}
            columns={COLUMNS}
            footerCta={user
                ? <button className="u-btn u-btn--solid u-btn--lg" onClick={() => navigate("/dashboard")}>Open workspace <ArrowUpRight size={15} /></button>
                : <Link to="/signup" className="u-btn u-btn--solid u-btn--lg">Try it free <ArrowUpRight size={15} /></Link>}
            mainClass="u-main u-main--site"
            stripLeft={<>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span className="u-dot" /> Rooms are free</span>
                <span className="u-strip-hide">No install · join from any browser</span>
            </>}
            stripRight={<Link to="/status">Status</Link>}
            right={<>
                <ThemeButton className="u-icon u-icon--hide" />
                {user ? (
                    <button className="u-btn u-btn--solid" onClick={() => navigate("/dashboard")}>Open workspace <ArrowUpRight size={15} /></button>
                ) : (
                    <>
                        <Link to="/login" className="u-btn u-hide-sm">Sign in</Link>
                        <Link to="/signup" className="u-btn u-btn--solid">Try it free</Link>
                    </>
                )}
            </>}
            sheetFoot={<>
                {user
                    ? <button className="u-btn u-btn--solid" onClick={() => navigate("/dashboard")}>Open workspace</button>
                    : <Link to="/signup" className="u-btn u-btn--solid">Try it free</Link>}
                <div style={{ display: "flex", gap: 6 }}>
                    <button className="u-btn u-btn--ghost" onClick={toggleTheme}>{isLight ? "Dark" : "Light"} theme</button>
                    {!user && <Link to="/login" className="u-btn u-btn--ghost">Sign in</Link>}
                </div>
            </>}
        >
            {children}
        </Shell>
    );
}

// Label, giant condensed title and two-tone lede used at the top of public pages.
export function PageHead({ label, title, lede, children }) {
    const words = Array.isArray(title) ? title : [title];
    return (
        <header className="p-head">
            <span className="u-label" data-rise>{label}</span>
            <h1 className="u-display u-xl u-lines p-title">
                {words.map((w, i) => <span key={i}><span style={{ "--d": `${60 + i * 90}ms` }}>{w}</span></span>)}
            </h1>
            {lede && <p className="u-lede" data-rise style={{ "--d": "180ms" }}>{lede}</p>}
            {children && <div className="u-head-actions" data-rise style={{ "--d": "240ms" }}>{children}</div>}
        </header>
    );
}
