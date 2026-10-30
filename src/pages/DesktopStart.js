import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Link2, Plus, LogIn, Cpu, Globe, FolderOpen, Clock, X, Copy, Check, RefreshCw, Keyboard, SquareTerminal } from "lucide-react";
import toast from "react-hot-toast";
import Logo from "../components/Logo";
import Icon from "../components/icons/Icon";
import SpaceLoader from "../components/SpaceLoader";
import { ThemeButton } from "../components/ux/Shell";
import { newRoomId, extractRoomId, timeAgo, greeting } from "../components/ux/primitives";
import { useAuth } from "../context/AuthContext";
import { useBackend, backendLabel } from "../context/BackendContext";
import { desktop, openOnWebsite } from "../utils/desktop";
import { recentRooms, forgetRoom } from "../utils/recentRooms";
import { LANG_BY_ID } from "../utils/languages";
import "../styles/app.css";

const SHORTCUTS = [
    ["Ctrl N", "New room"],
    ["Ctrl Shift O", "Open folder"],
    ["Ctrl `", "Terminal"],
    ["Ctrl Enter", "Run code"],
    ["Ctrl K", "Command palette"],
    ["Ctrl 1 / 2 / 3", "Workspace, snippets, settings"],
];

function CopyCmd({ cmd }) {
    const [done, setDone] = useState(false);
    return (
        <button
            className="ds2-cmd"
            onClick={async () => {
                try { await navigator.clipboard.writeText(cmd); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* blocked */ }
            }}
            title="Copy command"
        >
            <code>{cmd}</code>
            {done ? <Check size={13} /> : <Copy size={13} />}
        </button>
    );
}

// "/" in the desktop app: signed-in people go straight to their workspace; everyone else
// gets this launcher instead of the marketing site.
export default function DesktopStart() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const backend = useBackend();
    const [room, setRoom] = useState("");
    const [name, setName] = useState(() => {
        try { return localStorage.getItem("guest-name") || ""; } catch { return ""; }
    });
    const [local, setLocal] = useState(null);
    const [checking, setChecking] = useState(false);
    const [version, setVersion] = useState("");
    const [recent, setRecent] = useState(recentRooms);

    const check = useCallback(async () => {
        setChecking(true);
        try { setLocal(await desktop()?.localStatus?.()); } catch { setLocal(null); } finally { setChecking(false); }
    }, []);
    useEffect(() => {
        check();
        desktop()?.info?.().then((i) => setVersion(i?.version || "")).catch(() => { });
    }, [check]);

    const hello = useMemo(() => greeting(), []);

    if (loading) return <SpaceLoader />;
    if (user) return <Navigate to="/dashboard" replace />;

    const enter = (id) => {
        const who = name.trim();
        if (!who) {
            document.getElementById("ds2-name")?.focus();
            return toast.error("Pick a display name first.");
        }
        try { localStorage.setItem("guest-name", who); } catch { /* storage blocked */ }
        navigate(`/editor/${id}`, { state: { userName: who, role: "editor" } });
    };
    const join = (e) => {
        e.preventDefault();
        const id = extractRoomId(room);
        if (!id) return toast.error("Paste a room link or ID.");
        enter(id);
    };

    const services = [
        {
            id: "server", icon: <Globe size={15} />, label: "Server", ok: backend.status === "up", warn: backend.status !== "down",
            text: backendLabel(backend) + (backend.latency != null ? ` · ${backend.latency} ms` : ""),
        },
        {
            id: "judge0", icon: <Cpu size={15} />, label: "Code runner", ok: local?.judge0, warn: true,
            text: local ? (local.judge0 ? "Judge0 on this computer" : "Using the server") : "Checking",
            fix: local && !local.judge0 ? "docker compose up -d" : null,
            fixNote: "in a Judge0 CE folder",
        },
        {
            id: "llm", icon: <Icon name="ai" size={16} />, label: "AI copilot", ok: local?.llm, warn: true,
            text: local ? (local.llm ? local.model : "Using the server") : "Checking",
            fix: local && !local.llm ? `ollama pull ${local?.model || "qwen2.5-coder:1.5b"}` : null,
        },
    ];

    return (
        <div className="ux ds2">
            <div className="ds2-bg" aria-hidden="true" />
            <header className="ds2-top">
                <Logo size={26} />
                <span className="ds2-ver">{version ? `Desktop v${version}` : "Desktop"}</span>
                <span className="ds2-top-right">
                    <button className="u-ul ds2-link" onClick={() => openOnWebsite("/support")}>Help ↗</button>
                    <ThemeButton />
                </span>
            </header>

            <main className="ds2-main">
                <div className="ds2-col">
                    <section className="ds2-hero">
                        <span className="u-label">{hello}</span>
                        <h1>What are we<br />building today?</h1>
                        <p className="u-muted">Start a room and share the link, or sign in to keep projects, snippets and folders from this computer.</p>
                    </section>

                    <section className="ds2-tiles" aria-label="Start">
                        <button className="ds2-tile ds2-tile--primary" onClick={() => enter(newRoomId())}>
                            <span className="ds2-tile-ico"><Plus size={20} /></span>
                            <b>New room</b>
                            <em>Code, call and draw with anyone.</em>
                            <kbd className="ds2-tile-key">Ctrl N</kbd>
                        </button>

                        <form className="ds2-tile ds2-tile--join" onSubmit={join}>
                            <span className="ds2-tile-ico"><Link2 size={20} /></span>
                            <b>Join a room</b>
                            <div className="ds2-join">
                                <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Paste a link or room ID" aria-label="Room link or ID" />
                                <button type="submit" disabled={!room.trim()} aria-label="Join"><ArrowRight size={15} /></button>
                            </div>
                        </form>

                        <Link to="/login" className="ds2-tile">
                            <span className="ds2-tile-ico"><FolderOpen size={20} /></span>
                            <b>Open a folder</b>
                            <em>Sign in to open local folders as projects.</em>
                            <kbd className="ds2-tile-key">Ctrl Shift O</kbd>
                        </Link>
                    </section>

                    <section className="ds2-guest">
                        <div className="ds2-guest-name">
                            <label htmlFor="ds2-name" className="u-label">Your name in rooms</label>
                            <input id="ds2-name" className="u-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada Lovelace" maxLength={40} />
                        </div>
                        <span className="ds2-or">or</span>
                        <Link to="/login" className="u-btn u-btn--solid"><LogIn size={15} /> Sign in</Link>
                        <Link to="/signup" className="u-btn u-btn--ghost">Create account</Link>
                    </section>

                    {recent.length > 0 && (
                        <section className="ds2-card ds2-recent" aria-label="Recent rooms">
                            <div className="ds2-card-head"><Clock size={14} /> Recent rooms</div>
                            <ul>
                                {recent.map((r) => (
                                    <li key={r.id}>
                                        <button className="ds2-recent-open" onClick={() => enter(r.id)}>
                                            <span className="lp-badge">{LANG_BY_ID[r.language]?.short || "—"}</span>
                                            <span className="u-mono">room/{r.id}</span>
                                            <em>{r.at ? timeAgo(new Date(r.at)) : ""}</em>
                                        </button>
                                        <button className="ds2-x" onClick={() => { forgetRoom(r.id); setRecent(recentRooms()); }} aria-label={`Remove ${r.id} from recent`}><X size={13} /></button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                <aside className="ds2-side">
                    <section className="ds2-card" aria-label="This computer">
                        <div className="ds2-card-head">
                            <SquareTerminal size={14} /> This computer
                            <button className="ds2-refresh" onClick={check} disabled={checking} aria-label="Check again" title="Check again"><RefreshCw size={13} className={checking ? "ds2-spin" : ""} /></button>
                        </div>
                        {services.map((s) => (
                            <div key={s.id} className="ds2-svc">
                                <span className="ds2-svc-ico">{s.icon}</span>
                                <div className="ds2-svc-main">
                                    <b>{s.label}</b>
                                    <span>{s.text}</span>
                                    {s.fix && <CopyCmd cmd={s.fix} />}
                                    {s.fix && s.fixNote && <em>{s.fixNote}</em>}
                                </div>
                                <span className={`u-dot${s.ok ? "" : s.warn ? " u-dot--warn" : " u-dot--bad"}`} title={s.ok ? "Ready" : "Fallback"} />
                            </div>
                        ))}
                        <p className="ds2-note">Local services are optional. Without them the app uses the server.</p>
                    </section>

                    <section className="ds2-card" aria-label="Keyboard shortcuts">
                        <div className="ds2-card-head"><Keyboard size={14} /> Shortcuts</div>
                        <dl className="ds2-keys">
                            {SHORTCUTS.map(([k, v]) => (
                                <React.Fragment key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></React.Fragment>
                            ))}
                        </dl>
                    </section>
                </aside>
            </main>
        </div>
    );
}
