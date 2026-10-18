import React, { useState, useRef, useEffect } from "react";
import Logo from "./Logo";
import { Play, Loader2, MoreHorizontal, Sun, Moon } from "lucide-react";
import Client from "./clients";
import "../styles/site.css";
import "../styles/app.css";

// Shared top bar for the room editor and the project workspace.
//   tabs     - segmented view switches (e.g. Files / Chat / People)
//   actions  - { id, label, icon, onClick, active, tone, section: "main" | "more", desktopOnly }
export default function WorkspaceHeader({
    isMobile, isLightMode, onLogo, mode, title, subtitle, onTitleClick,
    clients = [], currentUserName, nameOf = (c) => c.userName || c.name,
    tabs = [], actions = [], onRun, isExecuting, onToggleTheme, trailing,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!menuOpen) return undefined;
        const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
        const esc = (e) => e.key === "Escape" && setMenuOpen(false);
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", esc);
        return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
    }, [menuOpen]);

    const visible = actions.filter((a) => !(isMobile && a.desktopOnly));
    // On phones only the first two tools stay in the bar; the rest move into the menu.
    const main = visible.filter((a) => a.section !== "more").slice(0, isMobile ? 2 : undefined);
    const more = [
        ...(isMobile ? visible.filter((a) => a.section !== "more").slice(2) : []),
        ...visible.filter((a) => a.section === "more"),
    ];

    return (
        <header className="wsh">
            <div className="wsh-left">
                <Logo size={isMobile ? 26 : 28} compact className="wsh-logo" onClick={onLogo} />
                <div className="wsh-crumb">
                    <span>{(mode || "").toLowerCase()}</span>
                    {title && <i>/</i>}
                    {title && (
                        <button onClick={onTitleClick} title={onTitleClick ? "Copy" : undefined} disabled={!onTitleClick}>
                            {title}
                        </button>
                    )}
                    {!isMobile && subtitle && <span className="wsh-sub">· {subtitle}</span>}
                </div>
                {!isMobile && tabs.length > 0 && (
                    <div className="u-seg" role="tablist">
                        {tabs.map((t) => (
                            <button key={t.id} role="tab" aria-selected={!!t.active} className={t.active ? "on" : ""} onClick={t.onClick} title={t.label}>
                                {t.icon}<span>{t.label}</span>
                                {t.badge ? <i className="u-badge" /> : null}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="wsh-right">
                {!isMobile && clients.length > 0 && (
                    <div className="wsh-avatars" title={`${clients.length} online`}>
                        {clients.slice(0, 4).map((c, i) => (
                            <div key={c.socketId || i} style={{ zIndex: 5 - i }}>
                                <Client userName={nameOf(c)} photoURL={c.photoURL} isCompact isCurrentUser={nameOf(c) === currentUserName} />
                            </div>
                        ))}
                        {clients.length > 4 && <span className="wsh-more">+{clients.length - 4}</span>}
                    </div>
                )}

                {onRun && (
                    <button className="u-btn wsh-run" onClick={onRun} disabled={isExecuting} title="Run code">
                        {isExecuting ? <Loader2 size={15} className="u-spin" /> : <Play size={13} fill="currentColor" />}
                        {!isMobile && <span>{isExecuting ? "Running" : "Run"}</span>}
                    </button>
                )}

                <div className="wsh-group">
                    {main.map((a) => (
                        <button
                            key={a.id}
                            className={`u-icon${a.active ? " on" : ""}${a.tone ? ` tone-${a.tone}` : ""}`}
                            onClick={a.onClick}
                            title={a.label}
                            aria-label={a.label}
                        >
                            {a.icon}
                        </button>
                    ))}

                    {more.length > 0 && (
                        <div className="wsh-menu-wrap" ref={menuRef}>
                            <button className={`u-icon${menuOpen ? " on" : ""}`} onClick={() => setMenuOpen((v) => !v)} title="More" aria-haspopup="menu" aria-expanded={menuOpen}>
                                <MoreHorizontal size={18} />
                            </button>
                            {menuOpen && (
                                <div className="u-pop" role="menu">
                                    {more.map((a) => (
                                        <button
                                            key={a.id}
                                            role="menuitem"
                                            className={a.tone === "red" ? "tone-red" : ""}
                                            onClick={() => { setMenuOpen(false); a.onClick(); }}
                                        >
                                            {a.icon}<span>{a.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <button className="u-icon" onClick={onToggleTheme} title="Toggle theme" aria-label="Toggle theme">
                        {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    {trailing}
                </div>
            </div>
        </header>
    );
}
