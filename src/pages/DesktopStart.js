import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Link2, Plus, LogIn, Cpu, Bot, Globe } from "lucide-react";
import toast from "react-hot-toast";
import Logo from "../components/Logo";
import SpaceLoader from "../components/SpaceLoader";
import { ThemeButton } from "../components/ux/Shell";
import { newRoomId, extractRoomId } from "../components/ux/primitives";
import { useAuth } from "../context/AuthContext";
import { useBackend, backendLabel } from "../context/BackendContext";
import { desktop, openOnWebsite } from "../utils/desktop";
import "../styles/app.css";

// "/" in the desktop app: signed-in users go straight to their workspace; everyone else
// gets a small launcher (sign in, join a room, start one) instead of the marketing site.
export default function DesktopStart() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const backend = useBackend();
    const [room, setRoom] = useState("");
    const [name, setName] = useState(() => {
        try { return localStorage.getItem("guest-name") || ""; } catch { return ""; }
    });
    const [local, setLocal] = useState(null);
    const [version, setVersion] = useState("");

    useEffect(() => {
        desktop()?.localStatus?.().then(setLocal).catch(() => setLocal(null));
        desktop()?.info?.().then((i) => setVersion(i?.version || "")).catch(() => {});
    }, []);

    if (loading) return <SpaceLoader />;
    if (user) return <Navigate to="/dashboard" replace />;

    const enter = (id) => {
        const who = name.trim();
        if (!who) return toast.error("Pick a display name first.");
        try { localStorage.setItem("guest-name", who); } catch { /* storage blocked */ }
        navigate(`/editor/${id}`, { state: { userName: who, role: "editor" } });
    };
    const join = (e) => {
        e.preventDefault();
        const id = extractRoomId(room);
        if (!id) return toast.error("Paste a room link or ID.");
        enter(id);
    };

    return (
        <div className="ux ds">
            <header className="ds-top">
                <Logo size={26} />
                <ThemeButton />
            </header>

            <main className="ds-main">
                <section className="ds-card">
                    <span className="u-label">Desktop {version && `· v${version}`}</span>
                    <h1 className="ds-title">Start coding</h1>
                    <p className="u-muted">Sign in for projects, snippets and folders from this computer. Or jump into a room as a guest.</p>

                    <div className="ds-actions">
                        <Link to="/login" className="u-btn u-btn--solid u-btn--lg"><LogIn size={16} /> Sign in</Link>
                        <Link to="/signup" className="u-btn u-btn--ghost u-btn--lg">Create account</Link>
                    </div>

                    <div className="au-or"><span>or as a guest</span></div>

                    <label className="ds-field">
                        <span className="u-label">Display name</span>
                        <input className="u-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada Lovelace" maxLength={40} />
                    </label>
                    <form className="ds-join" onSubmit={join}>
                        <Link2 size={16} aria-hidden="true" />
                        <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Paste a room link or ID" aria-label="Room link or ID" />
                        <button type="submit" className="u-btn u-btn--sm u-btn--solid" disabled={!room.trim()}>Join <ArrowRight size={14} /></button>
                    </form>
                    <button className="u-btn u-btn--ghost u-btn--block" onClick={() => enter(newRoomId())}><Plus size={16} /> New room</button>
                </section>

                <aside className="ds-status" aria-label="This computer">
                    <span className="u-label">This computer</span>
                    <Row icon={<Globe size={15} />} label="Server" ok={backend.status === "up"} warn={backend.status !== "down"} text={backendLabel(backend)} />
                    <Row icon={<Cpu size={15} />} label="Local Judge0" ok={local?.judge0} warn text={local ? (local.judge0 ? "Running code here" : "Not found, using the server") : "Checking"} />
                    <Row icon={<Bot size={15} />} label="Local AI" ok={local?.llm} warn text={local ? (local.llm ? local.model : "Not found, using the server") : "Checking"} />
                    <button className="u-ul ds-link" onClick={() => openOnWebsite("/support")}>Help and docs ↗</button>
                </aside>
            </main>
        </div>
    );
}

function Row({ icon, label, ok, warn, text }) {
    return (
        <div className="ds-row">
            {icon}
            <span>{label}</span>
            <span className={`u-dot${ok ? "" : warn ? " u-dot--warn" : " u-dot--bad"}`} />
            <span className="u-muted u-small">{text}</span>
        </div>
    );
}
