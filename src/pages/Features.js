import React, { useState } from "react";
import { Code2, Video, PenTool, Terminal, MessageSquare, Sparkles, FolderTree, GitCompare, Users, Zap, Search, Command, Database, MonitorDown, BellRing, Share2 } from "lucide-react";
import SiteLayout, { PageHead } from "../components/Site/SiteLayout";
import CtaBand from "../components/Site/CtaBand";
import { pad2 } from "../components/ux/primitives";

const FEATURES = [
    { group: "Collaborate", icon: Code2, title: "Multiplayer editing", text: "Everyone types in the same file with live cursors and conflict-free sync. Vim and Emacs keybindings included." },
    { group: "Collaborate", icon: Video, title: "Voice, video & screen", text: "Calls in every room and project. Share your screen, then draw and point on it together." },
    { group: "Collaborate", icon: PenTool, title: "Whiteboard", text: "Doodle together in real time. Sketch an architecture or circle a bug, from a laptop or a phone." },
    { group: "Collaborate", icon: MessageSquare, title: "Room chat", text: "Chat with emoji right beside the code you are discussing." },
    { group: "Build", icon: Terminal, title: "Run 17 languages", text: "JavaScript, Python, Java, C++, Go, Rust, SQL and more. Run together and share the output with the whole room." },
    { group: "Build", icon: Database, title: "SQL with your own data", text: "Import CSV, TSV or JSON files as tables, then query them by name with SQLite. No database to set up." },
    { group: "Build", icon: FolderTree, title: "Project workspaces", text: "Persistent multi-file projects with a file tree, live preview and team access. Ten on Free, unlimited on Team." },
    { group: "Build", icon: GitCompare, title: "Snapshots & diffs", text: "Save the state of a session and compare versions side by side. Unlimited on Team." },
    { group: "Build", icon: Sparkles, title: "AI copilot", text: "Explanations, refactors and fixes inside the session. Ten prompts a day on Free, unlimited on Team, and uncapped when you use a model on your own machine in the desktop app." },
    { group: "Desktop", icon: MonitorDown, title: "Desktop apps", text: "Installers for Windows, macOS and Linux. Code runs on your local Judge0 first, with the server as a fallback." },
    { group: "Organise", icon: Zap, title: "Instant rooms", text: "Link-shared rooms for pairing and interviews. Guests join without an account." },
    { group: "Organise", icon: Share2, title: "Editor & spectator links", text: "Share a room as an editor or as a read-only spectator, from one invite dialog." },
    { group: "Organise", icon: BellRing, title: "Push & email alerts", text: "Invites reach you as push notifications and email, with an in-app inbox as the record." },
    { group: "Organise", icon: Search, title: "Snippet library", text: "Save reusable snippets and export them to GitHub gists." },
    { group: "Organise", icon: Users, title: "Teams", text: "Invite teammates, manage members and keep shared work together." },
    { group: "Organise", icon: Command, title: "Command palette", text: "Ctrl+K for every action, Alt+F for distraction-free focus mode." },
];

const GROUPS = ["All", "Collaborate", "Build", "Desktop", "Organise"];

export default function Features() {
    const [group, setGroup] = useState("All");
    const list = FEATURES.filter((f) => group === "All" || f.group === group);
    return (
        <SiteLayout>
            <PageHead
                label="Features"
                title={["Everything", "to pair."]}
                lede={<><b>Remote collaboration built for code.</b> Edit, talk, draw, query and run together, in the browser or on your desktop.</>}
            />

            <div className="u-seg" role="tablist" aria-label="Filter features" data-rise style={{ marginBottom: 20 }}>
                {GROUPS.map((g) => (
                    <button key={g} role="tab" aria-selected={group === g} className={group === g ? "on" : ""} onClick={() => setGroup(g)}>
                        {g} <em>{g === "All" ? FEATURES.length : FEATURES.filter((f) => f.group === g).length}</em>
                    </button>
                ))}
            </div>

            <div className="f-grid" key={group}>
                {list.map(({ icon: Icon, title, text, group: g }, i) => (
                    <article className="f-cell u-enter" key={title} style={{ "--d": `${i * 40}ms` }}>
                        <div className="f-cell-top">
                            <span className="u-label">{pad2(FEATURES.findIndex((f) => f.title === title) + 1)} · {g}</span>
                            <Icon size={18} />
                        </div>
                        <h3>{title}</h3>
                        <p>{text}</p>
                    </article>
                ))}
            </div>

            <CtaBand />
        </SiteLayout>
    );
}
