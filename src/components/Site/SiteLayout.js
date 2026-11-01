import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Search, LifeBuoy } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Shell, { ThemeButton, useThemeToggle } from "../ux/Shell";
import Announcements from "../ux/Announcements";
import SearchModal from "../SearchModal";
import HelpModal from "../HelpModal";

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
    { title: "Resources", links: [["Status", "/status"], ["Docs", "/docs"]] },
    { title: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"]] },
];

// Chrome for the public site; shares header, menu and footer with the signed-in app.
export default function SiteLayout({ children }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isLight, toggleTheme] = useThemeToggle();
    const [searchOpen, setSearchOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const closeSearch = useCallback(() => setSearchOpen(false), []);

    // Same keys as the app: Ctrl/Cmd K searches, "?" opens help (unless you're typing).
    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); }
            const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "") || e.target?.isContentEditable;
            if (e.key === "?" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setHelpOpen(true); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <Shell
            links={LINKS}
            columns={COLUMNS}
            footerCta={user
                ? <button className="u-btn u-btn--solid u-btn--lg" onClick={() => navigate("/dashboard")}>Open workspace <ArrowUpRight size={15} /></button>
                : <Link to="/signup" className="u-btn u-btn--solid u-btn--lg">Try it free <ArrowUpRight size={15} /></Link>}
            mainClass="u-main u-main--site"
            stripLeft={<Announcements audience="site" />}
            stripRight={<>
                <Link to="/status">Status</Link>
                <button onClick={() => setHelpOpen(true)} title="Help, what's new and shortcuts (?)"><LifeBuoy size={12} style={{ verticalAlign: "-2px" }} /> Help</button>
            </>}
            right={<>
                <button className="u-icon" onClick={() => setSearchOpen(true)} aria-label="Search (Ctrl K)" title="Search (Ctrl K)"><Search size={18} /></button>
                <ThemeButton className="u-icon u-icon--hide" />
                {user ? (
                    <button className="u-btn u-btn--solid u-nav-cta" onClick={() => navigate("/dashboard")} aria-label="Open workspace">
                        <span className="u-hide-sm">Open workspace</span><span className="u-show-sm">Workspace</span>
                        <ArrowUpRight size={15} />
                    </button>
                ) : (
                    <>
                        <Link to="/login" className="u-btn u-hide-sm">Sign in</Link>
                        <Link to="/signup" className="u-btn u-btn--solid u-nav-cta">Try it free</Link>
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
            after={<>
                <SearchModal isOpen={searchOpen} onClose={closeSearch} onOpenHelp={() => setHelpOpen(true)} onToggleTheme={toggleTheme} />
                <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
            </>}
        >
            {children}
        </Shell>
    );
}

// Label, giant condensed title and two-tone lede used at the top of public pages.
export function PageHead({ label, title, lede, children }) {
    const words = Array.isArray(title) ? title : [title];
    useEffect(() => { if (label) document.title = `${label} | Utkristi CoLabs`; }, [label]);
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
