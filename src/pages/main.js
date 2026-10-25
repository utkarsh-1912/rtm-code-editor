import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ArrowUpRight, Globe, Smartphone, Monitor, Mic, Video, PenTool, Play } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import SiteLayout from "../components/Site/SiteLayout";
import CtaBand from "../components/Site/CtaBand";
import JoinForm from "../components/Landing/JoinForm";
import { extractRoomId, newRoomId, pad2 } from "../components/ux/primitives";
import { catalogue, yearlyPrice } from "../utils/billing";

const CODE = [
    ["c", "# pairing on the cart total"],
    ["k", "def ", "f", "cart_total", "", "(items):"],
    ["", "    ", "k", "return ", "f", "sum", "", "(i.price * i.qty ", "k", "for ", "", "i ", "k", "in ", "", "items)"],
    ["", ""],
    ["f", "print", "", "(", "s", "\"Total:\"", "", ", ", "f", "cart_total", "", "(cart))"],
];
const plain = (row) => row.filter((_, i) => i % 2 === 1).join("");
const TOTAL = CODE.reduce((n, r) => n + plain(r).length + 1, 0);

const STEPS = [
    { title: "Create a room", copy: "One click makes a room with its own link. No setup, no install. Keep it open, ask-to-join or invite-only.", kicker: "room/k3f9a2x1" },
    { title: "Send the link", copy: "Teammates join with just a display name, or schedule the call and everyone gets a calendar invite.", kicker: "3 people joined" },
    { title: "Build together", copy: "Edit, talk, draw, query and run code in the same space. Everyone sees the same output.", kicker: "Total: 42.50" },
];

const FEATURES = [
    ["Multiplayer editing", "Everyone types in the same file with live cursors and conflict-free sync."],
    ["Voice & video", "Calls live inside the room, with screen sharing and annotations."],
    ["Whiteboard & diagrams", "Sketch, or build flowcharts and system designs with real blocks and arrows."],
    ["Run 17 languages", "Execute code together and share the output instantly, from Python to Rust."],
    ["SQL with your data", "Import a CSV, TSV or JSON file and query it right in the room."],
    ["Desktop apps", "Windows, macOS and Linux. Runs code and AI on your own machine when it can."],
    ["Room chat", "Talk beside the code you are discussing, with emoji and edits."],
    ["Projects & snippets", "Keep multi-file work, history and reusable code between sessions."],
    ["Scheduled calls", "Plan interviews and pairing sessions with invites, calendar links and reminders."],
];

const CAPABILITIES = ["Live cursors", "Voice & video", "Whiteboard", "System design", "17 languages", "SQL + CSV", "Desktop app", "Local AI", "Scheduled calls", "Private rooms", "Push alerts", "Room chat", "Snapshots", "AI copilot"];

// Code that types itself out, then starts over.
function TypingCode() {
    const [n, setN] = useState(0);
    useEffect(() => {
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduce) { setN(TOTAL); return undefined; }
        const id = setInterval(() => setN((v) => (v >= TOTAL + 40 ? 0 : v + 1)), 55);
        return () => clearInterval(id);
    }, []);
    let left = n;
    return (
        <div className="l-code" aria-hidden="true">
            {CODE.map((row, r) => {
                const text = plain(row);
                const show = Math.max(0, Math.min(text.length, left));
                const active = left >= 0 && left <= text.length;
                left -= text.length + 1;
                let used = 0;
                const parts = [];
                for (let i = 0; i < row.length; i += 2) {
                    const piece = row[i + 1];
                    const take = Math.max(0, Math.min(piece.length, show - used));
                    used += piece.length;
                    if (take > 0) parts.push(<span key={i} className={row[i]}>{piece.slice(0, take)}</span>);
                }
                return (
                    <div key={r} className="l-line">
                        <i>{r + 1}</i>
                        <span>
                            {parts}
                            {active && <b className="l-caret" />}
                            {/* Teammates' cursors: caret + name tag floating above it, never over the code. */}
                            {r === 2 && show > 20 && <span className="rc-caret l-rc" style={{ "--rc": "#8B5CF6" }}><span className="rc-tag">Priya</span></span>}
                            {r === 4 && show > 8 && <span className="rc-caret l-rc" style={{ "--rc": "#10B981" }}><span className="rc-tag">Sam</span></span>}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function HomePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [roomId, setRoomId] = useState("");
    const [userName, setUserName] = useState("");
    const [step, setStep] = useState(0);
    const [auto, setAuto] = useState(true);

    useEffect(() => {
        const room = new URLSearchParams(location.search).get("room");
        if (room) setRoomId(room);
    }, [location]);

    useEffect(() => {
        if (!auto) return undefined;
        const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 5000);
        return () => clearTimeout(id);
    }, [step, auto]);

    // Signed-in people have one home: the workspace. Keep invite params (?room=…&role=…).
    if (user) return <Navigate to={`/dashboard${location.search}`} replace />;

    const createNewRoom = (e) => {
        if (e) e.preventDefault();
        setRoomId(newRoomId());
        toast.success("New room created. Add your name and join.");
    };

    const joinRoom = () => {
        const id = extractRoomId(roomId);
        if (!id) return toast.error("Room ID is required.");
        if (!userName.trim()) return toast.error("Add a display name first.");
        const role = new URLSearchParams(location.search).get("role") || "editor";
        navigate(`/editor/${id}`, { state: { userName: userName.trim(), role } });
    };

    const handleEnterKey = (e) => {
        if (e.key === "Enter") joinRoom();
    };

    return (
        <SiteLayout>
            <section className="l-hero">
                <div className="h-top" data-rise>
                    <span className="u-label">Real-time pair programming</span>
                    <span className="u-label l-platforms"><Globe size={12} /> Web <Smartphone size={12} /> Mobile <Monitor size={12} /> Desktop</span>
                </div>
                <h1 className="u-display u-giant u-lines l-title">
                    <span><span style={{ "--d": "40ms" }}>Code together,</span></span>
                    <span><span style={{ "--d": "140ms" }}>remotely<span className="u-faint">.</span></span></span>
                </h1>
                <p className="u-lede" data-rise style={{ "--d": "220ms" }}>
                    <b>Live sync, voice and video, drawing, chat and 17 runnable languages in one room.</b> On the web or as a desktop app, for pairing, interviews and quick debugging.
                </p>

                <div className="l-stage" data-rise style={{ "--d": "260ms" }}>
                    <div className="u-pane l-mock">
                        <div className="l-mock-bar">
                            <span className="u-label"><span className="u-dot" /> room/k3f9a2x1 — main.py</span>
                            <span className="l-mock-tools"><Mic size={14} /><Video size={14} /><PenTool size={14} /><span className="l-run"><Play size={11} fill="currentColor" /> Run</span></span>
                        </div>
                        <div className="l-mock-body">
                            <TypingCode />
                            <div className="l-tiles">
                                <div className="l-tile" style={{ "--c": "#8B5CF6" }}><span>Priya</span><Mic size={12} /></div>
                                <div className="l-tile" style={{ "--c": "#10B981" }}><span>Sam</span><Mic size={12} /></div>
                                <div className="l-tile l-tile--you"><span>You</span></div>
                            </div>
                        </div>
                    </div>
                    <JoinForm
                        roomId={roomId}
                        setRoomId={setRoomId}
                        userName={userName}
                        setUserName={setUserName}
                        handleEnterKey={handleEnterKey}
                        joinRoom={joinRoom}
                        createNewRoom={createNewRoom}
                        user={user}
                    />
                </div>
            </section>

            <section className="u-section" aria-hidden="true">
                <div className="u-marquee">
                    <div className="u-track">
                        {[...CAPABILITIES, ...CAPABILITIES].map((c, i) => <span key={i}>{c}</span>)}
                    </div>
                </div>
            </section>

            <section className="u-section">
                <div className="u-head">
                    <span className="u-label" data-rise>Two ways to work</span>
                    <p className="u-lede" data-rise><b>Jump into a throwaway room, or build something that lasts.</b> Both come with the same live tools.</p>
                </div>
                <div className="l-bento">
                    <article className="u-pane l-bento-card" data-rise>
                        <span className="u-label">Room-based</span>
                        <h3 className="u-display u-xl">Rooms</h3>
                        <p className="u-muted">Spin one up in a click and share the link. Perfect for pairing, interviews and debugging.</p>
                        <ol className="l-list">
                            <li><i>01</i>No account needed to join</li>
                            <li><i>02</i>Code, chat, voice, video and whiteboard</li>
                            <li><i>03</i>Run 17 languages, or query a CSV with SQL</li>
                        </ol>
                        <Link to="/signup" className="u-btn u-btn--solid" style={{ alignSelf: "flex-start" }}>Create a room <ArrowUpRight size={15} /></Link>
                    </article>
                    <article className="l-bento-card l-bento-card--mark" data-rise style={{ "--d": "100ms" }}>
                        <span className="u-label">Project-based</span>
                        <h3 className="u-display u-xl">Projects</h3>
                        <p>A real multi-file workspace that sticks around between sessions.</p>
                        <ol className="l-list">
                            <li><i>01</i>File tree, tabs, live preview and snapshots</li>
                            <li><i>02</i>Ten projects free, unlimited on Team</li>
                            <li><i>03</i>Invite teammates by email, with push alerts</li>
                        </ol>
                        <Link to="/signup" className="u-btn l-btn-on-mark" style={{ alignSelf: "flex-start" }}>Start a project <ArrowUpRight size={15} /></Link>
                    </article>
                </div>
            </section>

            <section className="u-section">
                <div className="u-head">
                    <span className="u-label" data-rise>How it works</span>
                    <p className="u-lede" data-rise><b>Three steps to pairing.</b> From nothing to a shared room in under a minute.</p>
                </div>
                <div className="u-sheetbox" data-rise>
                    <div className="u-steps" style={{ "--n": STEPS.length, "--dur": "5s" }}>
                        {STEPS.map((s, i) => (
                            <button key={s.title} className={`u-step${i === step ? " on" : ""}${auto ? " run" : ""}`} onClick={() => { setStep(i); setAuto(false); }}>
                                <span className="u-label">{pad2(i + 1)}</span>
                                <b>{s.title}</b>
                            </button>
                        ))}
                    </div>
                    <div className="u-card l-step-panel" key={step}>
                        <span className="u-label">{pad2(step + 1)} · {STEPS[step].kicker}</span>
                        <h3 className="u-display u-xl">{STEPS[step].title}</h3>
                        <p className="u-lede" style={{ maxWidth: 560 }}>{STEPS[step].copy}</p>
                    </div>
                </div>
            </section>

            <section className="u-section">
                <div className="u-section-head">
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <span className="u-label" data-rise>Features</span>
                        <p className="u-lede" data-rise><b>Some of the best bits.</b> Everything you need to work on code with other people.</p>
                    </div>
                    <Link to="/features" className="u-btn u-btn--ghost">All features <ArrowUpRight size={15} /></Link>
                </div>
                <ul className="u-rows">
                    {FEATURES.map(([t, d], i) => (
                        <li key={t} className="u-row l-feature" data-rise style={{ "--d": `${i * 50}ms` }} onClick={() => navigate("/features")}>
                            <span className="u-row-idx">{pad2(i + 1)}</span>
                            <div className="l-feature-body">
                                <span className="u-row-title">{t}</span>
                                <span className="u-muted">{d}</span>
                            </div>
                            <span className="u-circ"><ArrowUpRight size={17} /></span>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="u-section">
                <div className="u-section-head">
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <span className="u-label" data-rise>Pricing</span>
                        <p className="u-lede" data-rise><b>Free is real.</b> Guests, rooms, voice, video, 17 languages and {catalogue.plans.free.limits.projects} projects cost nothing. Upgrade when your team needs more.</p>
                    </div>
                    <Link to="/pricing" className="u-btn u-btn--ghost">Compare plans <ArrowUpRight size={15} /></Link>
                </div>
                <div className="l-price">
                    <article className="u-card l-price-card" data-rise>
                        <span className="u-label">Free</span>
                        <div className="l-price-amt"><span className="u-display u-xl">$0</span><small>forever</small></div>
                        <ul className="l-price-list">
                            <li>Unlimited rooms and guests</li>
                            <li>{catalogue.plans.free.limits.projects} projects</li>
                            <li>{catalogue.plans.free.limits.aiPerDay} AI prompts a day</li>
                            <li>Desktop apps for every OS</li>
                        </ul>
                        <Link to="/signup" className="u-btn u-btn--ghost" style={{ marginTop: "auto" }}>Start free <ArrowUpRight size={15} /></Link>
                    </article>
                    <article className="u-pane l-price-card" data-rise style={{ "--d": "80ms" }}>
                        <span className="u-label">Team · {catalogue.trialDays}-day free trial</span>
                        <div className="l-price-amt"><span className="u-display u-xl">${Math.round(yearlyPrice(catalogue.plans.team.monthly) / 12)}</span><small>/mo per member, billed yearly</small></div>
                        <ul className="l-price-list">
                            <li>Unlimited projects, snapshots and AI</li>
                            <li>Organizations and email invites</li>
                            <li>Push and email notifications</li>
                            <li>Priority support</li>
                        </ul>
                        <Link to="/pricing" className="u-btn u-btn--solid" style={{ marginTop: "auto" }}>Try Team free <ArrowUpRight size={15} /></Link>
                    </article>
                </div>
            </section>

            <CtaBand />
        </SiteLayout>
    );
}

export default HomePage;
