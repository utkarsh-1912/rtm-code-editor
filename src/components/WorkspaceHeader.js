import React, { useState, useRef, useEffect, useMemo } from "react";
import Logo from "./Logo";
import Icon from "./icons/Icon";
import Client from "./clients";
import "../styles/site.css";
import "../styles/app.css";

// Which group each known action lives in inside the ⋯ menu.
const GROUP_OF = {
    call: "Collaborate", board: "Collaborate", invite: "Collaborate", share: "Collaborate", viewer: "Collaborate", copy: "Collaborate",
    ai: "Tools", history: "Tools", analytics: "Tools", focus: "Tools", search: "Tools", palette: "Tools",
    snippet: "Code", gist: "Code", download: "Code",
    terminal: "Files", "save-disk": "Files", "save-disk-as": "Files", "add-files": "Files", "add-folder": "Files",
    settings: "Workspace", theme: "Workspace", dash: "Workspace", leave: "Workspace",
};
const GROUP_ORDER = ["Collaborate", "Tools", "Code", "Files", "Workspace", "More"];
const SHORTCUT = { palette: "Ctrl K", search: "Ctrl K", focus: "Alt F", terminal: "Ctrl `", "save-disk": "Ctrl S" };
// Shown as icons on large screens (unless an action sets pin explicitly); phones keep everything in ⋯.
const PINNED = new Set(["call", "board", "ai", "share", "invite", "settings"]);

// Shared top bar for the room editor and the project workspace.
// Large screens: view tabs, people, the key tools as icons, Run and a ⋯ menu for the rest.
// Phones: Run and the ⋯ menu only; every tool lives in the menu.
//   tabs     - segmented view switches (e.g. Files / Chat / People)
//   actions  - { id, label, icon, onClick, active, tone, group?, desktopOnly }
export default function WorkspaceHeader({
    isMobile, isLightMode, onLogo, mode, title, subtitle, onTitleClick,
    clients = [], currentUserName, nameOf = (c) => c.userName || c.name,
    tabs = [], actions = [], onRun, isExecuting, onToggleTheme, trailing,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [cursor, setCursor] = useState(0);
    const menuRef = useRef(null);
    const inputRef = useRef(null);

    const items = useMemo(() => {
        const list = actions
            .filter((a) => !(isMobile && a.desktopOnly))
            .filter((a) => isMobile || !(a.pin ?? PINNED.has(a.id)))
            .concat(onToggleTheme ? [{ id: "theme", label: isLightMode ? "Dark theme" : "Light theme", icon: <Icon name={isLightMode ? "theme-dark" : "theme-light"} size={16} />, onClick: onToggleTheme }] : [])
            .map((a) => ({ ...a, group: a.group || GROUP_OF[a.id] || "More" }));
        const q = query.trim().toLowerCase();
        return list
            .filter((a) => !q || a.label.toLowerCase().includes(q))
            .sort((a, b) => (GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)) || ((a.tone === "red") - (b.tone === "red")));
    }, [actions, isMobile, onToggleTheme, isLightMode, query]);

    const call = actions.find((a) => a.id === "call");
    // One avatar per person: signed-in people with several tabs open show once.
    const people = useMemo(() => {
        const seen = new Set();
        return clients.filter((c) => {
            const key = c.uid || c.socketId;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [clients]);
    const isPinned = (a) => (a.pin ?? PINNED.has(a.id));
    const pinned = isMobile ? [] : actions.filter((a) => isPinned(a) && !(call?.active && a.id === "call"));

    useEffect(() => {
        if (!menuOpen) return undefined;
        setCursor(0);
        setTimeout(() => inputRef.current?.focus(), 0);
        const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [menuOpen]);

    useEffect(() => { if (!menuOpen) setQuery(""); }, [menuOpen]);

    const pick = (a) => {
        setMenuOpen(false);
        a?.onClick?.();
    };

    const onMenuKey = (e) => {
        if (e.key === "Escape") { setMenuOpen(false); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
        if (e.key === "Enter") { e.preventDefault(); pick(items[cursor]); }
    };

    let lastGroup = null;

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
                {!isMobile && people.length > 0 && (
                    <div className="wsh-avatars" title={`${people.length} online`}>
                        {people.slice(0, 4).map((c, i) => (
                            <div key={c.socketId || i} style={{ zIndex: 5 - i }}>
                                <Client userName={nameOf(c)} photoURL={c.photoURL} isCompact isCurrentUser={nameOf(c) === currentUserName} />
                            </div>
                        ))}
                        {people.length > 4 && <span className="wsh-more">+{people.length - 4}</span>}
                    </div>
                )}

                {call?.active && (
                    <button className="wsh-live" onClick={call.onClick} title="Leave call">
                        <span className="u-dot" /> {!isMobile && "In call"} <Icon name="call-leave" size={14} />
                    </button>
                )}

                {pinned.length > 0 && (
                    <div className="wsh-tools" role="toolbar" aria-label="Tools">
                        {pinned.map((a) => (
                            <button key={a.id} className={`u-icon${a.active ? " on" : ""}`} onClick={a.onClick} title={a.label} aria-label={a.label} aria-pressed={a.active ? true : undefined}>
                                {a.icon}
                            </button>
                        ))}
                    </div>
                )}

                {onRun && (
                    <button className="u-btn wsh-run" onClick={onRun} disabled={isExecuting} title="Run code (Ctrl Enter)">
                        {isExecuting ? <Icon name="reload" size={14} className="u-spin" /> : <Icon name="run" size={14} filled />}
                        {!isMobile && <span>{isExecuting ? "Running" : "Run"}</span>}
                    </button>
                )}

                <div className="wsh-menu-wrap" ref={menuRef}>
                    <button className={`u-icon wsh-dots${menuOpen ? " on" : ""}`} onClick={() => setMenuOpen((v) => !v)} title="All tools" aria-label="All tools" aria-haspopup="menu" aria-expanded={menuOpen}>
                        <Icon name="more" size={20} />
                    </button>
                    {menuOpen && (
                        <div className="u-pop wsh-menu" role="menu" onKeyDown={onMenuKey}>
                            <label className="wsh-filter">
                                <Icon name="search" size={14} />
                                <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setCursor(0); }} placeholder="Find a tool" aria-label="Find a tool" />
                                <kbd>Esc</kbd>
                            </label>
                            <div className="wsh-menu-list">
                                {items.length === 0 && <p className="wsh-empty">No tool matches “{query}”.</p>}
                                {items.map((a, i) => {
                                    const head = a.group !== lastGroup ? a.group : null;
                                    lastGroup = a.group;
                                    return (
                                        <React.Fragment key={a.id}>
                                            {head && <span className="wsh-group-label">{head}</span>}
                                            <button
                                                role="menuitem"
                                                className={`${a.tone === "red" ? "tone-red" : ""}${i === cursor ? " is-cursor" : ""}`}
                                                onMouseEnter={() => setCursor(i)}
                                                onClick={() => pick(a)}
                                            >
                                                {a.icon}<span>{a.label}</span>
                                                {a.active ? <Icon name="check" size={14} className="wsh-check" /> : SHORTCUT[a.id] ? <kbd>{SHORTCUT[a.id]}</kbd> : null}
                                            </button>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                {trailing}
            </div>
        </header>
    );
}
