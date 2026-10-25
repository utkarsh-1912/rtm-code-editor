import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Rocket, Sparkles, Keyboard, LifeBuoy, Terminal, Share2, Play, Video, PenTool, Folder, CalendarPlus, Lock,
    Activity, ArrowUpRight, Search, LayoutTemplate, FolderInput, Code2, Bot,
} from "lucide-react";
import { Modal } from "./ux/primitives";

const TABS = [
    { id: "start", label: "Get started", Icon: Rocket },
    { id: "new", label: "What's new", Icon: Sparkles },
    { id: "keys", label: "Shortcuts", Icon: Keyboard },
    { id: "contact", label: "Get help", Icon: LifeBuoy },
];

const STEPS = [
    { Icon: Terminal, title: "Start a room", text: "New room gives you an editor, a runner and a chat in one link. No setup." },
    { Icon: Share2, title: "Invite people", text: "Share the link. Choose who can join: anyone with the link, people who ask, or invited people only." },
    { Icon: Play, title: "Run code together", text: "Press Run (Ctrl Enter). Everyone sees the same output, live." },
    { Icon: Video, title: "Talk and present", text: "Start a call, share your screen and point or draw on it. Dock the call into your layout." },
    { Icon: PenTool, title: "Draw it out", text: "The whiteboard does sketches, flowcharts and system-design diagrams, live for everyone." },
    { Icon: Folder, title: "Keep it in a project", text: "Projects hold many files and folders, history and teammates. Open a folder from your computer in the desktop app." },
    { Icon: CalendarPlus, title: "Schedule calls", text: "Plan an interview or a pairing session. Everyone gets a link and a calendar invite." },
];

const NEW = [
    { Icon: CalendarPlus, title: "Scheduled calls", text: "Schedule a call from your workspace or inside a room. Invites by email, Google and Outlook links, a calendar file, and a reminder 10 minutes before." },
    { Icon: Lock, title: "Private and invite-only rooms", text: "Make a room invite-only (people knock, you let them in) or private (invited accounts only). Set it in Invite people." },
    { Icon: LayoutTemplate, title: "Layouts for projects", text: "Projects can use rearrangeable cards like rooms: files, editor, output, chat, people and the call. Classic stays the default." },
    { Icon: FolderInput, title: "Move and rename files", text: "Drag files and folders into folders, or use the ⋮ menu: rename, move to, delete." },
    { Icon: Search, title: "Better search", text: "Ctrl K finds rooms, projects, files inside projects, snippets and meetings, plus pages and actions." },
    { Icon: Code2, title: "Snippets and teams", text: "Filter by language and tags, see code at a glance, and manage teams from the Teams tab." },
    { Icon: Bot, title: "AI copilot on the web", text: "Explain, refactor, fix and write tests with no setup. The desktop app can also use a model on your own computer." },
];

const KEYS = [
    ["Anywhere", [["Ctrl K", "Search and actions"], ["?", "This help"], ["Esc", "Close a dialog"]]],
    ["Rooms and projects", [["Ctrl Enter", "Run"], ["Alt F", "Focus mode"], ["Ctrl S", "Save to disk (desktop app)"], ["Ctrl `", "Terminal (desktop app)"]]],
    ["Whiteboard", [["V", "Select"], ["H", "Pan"], ["S", "Shapes"], ["A", "Connector"], ["P", "Pen"], ["T", "Text"], ["Ctrl D", "Duplicate"], ["Del", "Delete"], ["Enter", "Edit text"]]],
];

export default function HelpModal({ open, onClose }) {
    const navigate = useNavigate();
    const [tab, setTab] = useState("start");
    const [filter, setFilter] = useState("");
    const go = (to) => { onClose(); navigate(to); };

    const keys = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return KEYS;
        return KEYS.map(([g, list]) => [g, list.filter(([k, d]) => `${k} ${d}`.toLowerCase().includes(q))]).filter(([, list]) => list.length);
    }, [filter]);

    return (
        <Modal open={open} onClose={onClose} wide label="Help" title="How can we help?" description="Guides, what's new, shortcuts, and how to reach us.">
            <div className="hp">
                <nav className="hp-tabs" role="tablist" aria-label="Help">
                    {TABS.map((t) => (
                        <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
                            <t.Icon size={15} /> {t.label}
                        </button>
                    ))}
                </nav>
                <div className="hp-body">
                    {tab === "start" && (
                        <ol className="hp-steps">
                            {STEPS.map((s, i) => (
                                <li key={s.title}>
                                    <span className="hp-step-n">{i + 1}</span>
                                    <span className="hp-step-ico"><s.Icon size={16} /></span>
                                    <div><b>{s.title}</b><p>{s.text}</p></div>
                                </li>
                            ))}
                        </ol>
                    )}
                    {tab === "new" && (
                        <ul className="hp-new">
                            {NEW.map((n) => (
                                <li key={n.title}>
                                    <span className="hp-step-ico"><n.Icon size={16} /></span>
                                    <div><b>{n.title}</b><p>{n.text}</p></div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {tab === "keys" && (
                        <div className="hp-keys">
                            <label className="u-search" style={{ maxWidth: "none" }}>
                                <Search size={14} />
                                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a shortcut" aria-label="Find a shortcut" />
                            </label>
                            {keys.map(([group, list]) => (
                                <section key={group}>
                                    <span className="u-label">{group}</span>
                                    <dl>
                                        {list.map(([k, d]) => (
                                            <div key={k + d}><dt>{k.split(" ").map((p) => <kbd key={p}>{p}</kbd>)}</dt><dd>{d}</dd></div>
                                        ))}
                                    </dl>
                                </section>
                            ))}
                            {!keys.length && <p className="u-muted">No shortcut matches “{filter}”.</p>}
                        </div>
                    )}
                    {tab === "contact" && (
                        <div className="hp-contact">
                            <button className="hp-card" onClick={() => go("/support")}>
                                <LifeBuoy size={18} /><div><b>Contact support</b><span>Tell us what went wrong or what you need. We reply by email.</span></div><ArrowUpRight size={15} />
                            </button>
                            <button className="hp-card" onClick={() => go("/status")}>
                                <Activity size={18} /><div><b>System status</b><span>Check whether rooms, code running, AI and email are working right now.</span></div><ArrowUpRight size={15} />
                            </button>
                            <button className="hp-card" onClick={() => go("/docs")}>
                                <Rocket size={18} /><div><b>Documentation</b><span>How every part of CoLabs works, step by step.</span></div><ArrowUpRight size={15} />
                            </button>
                            <button className="hp-card" onClick={() => go("/features")}>
                                <Sparkles size={18} /><div><b>All features</b><span>Everything CoLabs can do, in one page.</span></div><ArrowUpRight size={15} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
