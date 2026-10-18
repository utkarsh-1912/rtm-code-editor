import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, Sun, Moon } from "lucide-react";
import Logo from "../Logo";
import { useReveal, useClock, localCity } from "./primitives";
import { getThemePref, resolveTheme, setThemePref } from "../../utils/theme";
import "../../styles/site.css";
import "../../styles/app.css";

// Hide the header while scrolling down, bring it back on any scroll up.
function useHideOnScroll() {
    const [away, setAway] = useState(false);
    useEffect(() => {
        let last = window.scrollY;
        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const y = window.scrollY;
                if (Math.abs(y - last) > 6) setAway(y > last && y > 160);
                last = y;
                ticking = false;
            });
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    return away;
}

export function useOnline() {
    const [online, setOnline] = useState(() => navigator.onLine);
    useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener("online", on);
        window.addEventListener("offline", off);
        return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
    }, []);
    return online;
}

// Current light/dark state plus a toggle that keeps every listener in sync.
export function useThemeToggle() {
    const [isLight, setIsLight] = useState(() => resolveTheme() === "light");
    useEffect(() => {
        const sync = (e) => setIsLight(!!e.detail?.isLight);
        window.addEventListener("app-theme-change", sync);
        return () => window.removeEventListener("app-theme-change", sync);
    }, []);
    const toggle = () => {
        const pref = getThemePref();
        const light = pref === "system" ? resolveTheme("system") === "light" : pref === "light";
        setIsLight(setThemePref(light ? "dark" : "light"));
    };
    return [isLight, toggle];
}

export function ThemeButton({ className = "u-icon" }) {
    const [isLight, toggle] = useThemeToggle();
    return (
        <button className={className} onClick={toggle} aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}>
            {isLight ? <Moon size={18} /> : <Sun size={18} />}
        </button>
    );
}

/**
 * Page chrome shared by the public site and the signed-in app:
 * mono status strip, hide-on-scroll nav, full-screen mobile menu, giant-link footer.
 */
export default function Shell({
    homeTo = "/", links = [], stripLeft, stripRight, right, holdHeader = false,
    sheetFoot, footerLinks = links, footerExtra, footerNote, legal = [], children, after, mainClass = "u-main",
}) {
    const location = useLocation();
    const rootRef = useRef(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const away = useHideOnScroll();
    const now = useClock();
    useReveal(rootRef);

    useEffect(() => {
        setSheetOpen(false);
        window.scrollTo(0, 0);
    }, [location.pathname]);

    useEffect(() => {
        document.body.style.overflow = sheetOpen ? "hidden" : "";
        const esc = (e) => e.key === "Escape" && setSheetOpen(false);
        if (sheetOpen) document.addEventListener("keydown", esc);
        return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", esc); };
    }, [sheetOpen]);

    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

    return (
        <div className="ux" ref={rootRef}>
            <div className="u-grain" aria-hidden="true" />

            <header className={`u-header${away && !holdHeader ? " is-away" : ""}`}>
                <div className="u-strip">
                    <div className="u-strip-in">
                        <div>{stripLeft}</div>
                        <div>
                            <span className="u-strip-hide">{localCity()} <span style={{ color: "var(--u-ink)" }}>{time}</span></span>
                            {stripRight}
                        </div>
                    </div>
                </div>

                <div className="u-nav">
                    <div className="u-nav-in">
                        <div className="u-nav-left">
                            <Link to={homeTo} aria-label="Home"><Logo size={28} /></Link>
                            <nav className="u-links" aria-label="Primary">
                                {links.map(({ to, label, end }) => (
                                    <NavLink key={to} to={to} end={end} className={({ isActive }) => `u-ul${isActive ? " active" : ""}`}>{label}</NavLink>
                                ))}
                            </nav>
                        </div>
                        <div className="u-nav-right">
                            {right}
                            <button className="u-icon u-burger" onClick={() => setSheetOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
                        </div>
                    </div>
                </div>
            </header>

            {sheetOpen && (
                <div className="u-sheet" role="dialog" aria-modal="true" aria-label="Menu">
                    <div className="u-sheet-top">
                        <Logo size={26} />
                        <button className="u-icon" onClick={() => setSheetOpen(false)} aria-label="Close menu"><X size={22} /></button>
                    </div>
                    <nav className="u-lines is-in">
                        {links.map(({ to, label, end }, i) => (
                            <NavLink key={to} to={to} end={end} className={({ isActive }) => `u-display${isActive ? " active" : ""}`}>
                                <span style={{ "--d": `${80 + i * 70}ms` }}>{label}</span>
                            </NavLink>
                        ))}
                    </nav>
                    <div className="u-sheet-foot">{sheetFoot}</div>
                </div>
            )}

            <main className={mainClass}>{children}</main>

            <footer className="u-foot">
                <div className="u-foot-in">
                    {footerNote}
                    <nav className="u-foot-links" aria-label="Footer">
                        {footerLinks.map(({ to, label, end }) => (
                            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>{label}</NavLink>
                        ))}
                        {footerExtra}
                    </nav>
                    <div className="u-foot-bottom">
                        <span>&copy; {now.getFullYear()} Utkristi CoLabs · {localCity()} {time}</span>
                        <span style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                            {legal.map(([label, to]) => <Link key={to} to={to}>{label}</Link>)}
                            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Back to top ↑</button>
                        </span>
                    </div>
                </div>
            </footer>

            {after}
        </div>
    );
}
