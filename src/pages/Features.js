import React, { useState } from "react";
import { Code2, Video, PenTool, Terminal, MessageSquare, Sparkles, FolderTree, GitCompare, Users, Zap, Search, Command } from "lucide-react";
import SiteLayout, { PageHead } from "../components/Site/SiteLayout";
import CtaBand from "../components/Site/CtaBand";
import { pad2 } from "../components/ux/primitives";

const FEATURES = [
    { group: "Collaborate", icon: Code2, title: "Multiplayer editing", text: "Everyone types in the same file with live cursors and conflict-free sync. Vim and Emacs keybindings included." },
    { group: "Collaborate", icon: Video, title: "Voice, video & screen", text: "Calls in every room and project. Share your screen, then draw and point on it together." },
    { group: "Collaborate", icon: PenTool, title: "Whiteboard", text: "Doodle together in real time. Sketch an architecture or circle a bug, from a laptop or a phone." },
    { group: "Collaborate", icon: MessageSquare, title: "Room chat", text: "Chat with emoji right beside the code you are discussing." },
    { group: "Build", icon: Terminal, title: "Run code together", text: "Execute in several languages and share the output with the whole room instantly." },
    { group: "Build", icon: FolderTree, title: "Project workspaces", text: "Persistent multi-file projects with a file tree, live preview and team access." },
    { group: "Build", icon: GitCompare, title: "Snapshots & diffs", text: "Save the state of a session and compare versions side by side." },
    { group: "Build", icon: Sparkles, title: "AI copilot", text: "Ask for explanations, refactors and fixes without leaving the session." },
    { group: "Organise", icon: Zap, title: "Instant rooms", text: "Link-shared rooms for pairing and interviews. Guests join without an account." },
    { group: "Organise", icon: Search, title: "Snippet library", text: "Save reusable snippets and export them to GitHub gists." },
    { group: "Organise", icon: Users, title: "Teams", text: "Invite teammates, manage members and keep shared work together." },
    { group: "Organise", icon: Command, title: "Command palette", text: "Ctrl+K for every action, Alt+F for distraction-free focus mode." },
];

const GROUPS = ["All", "Collaborate", "Build", "Organise"];

export default function Features() {
    const [group, setGroup] = useState("All");
    const list = FEATURES.filter((f) => group === "All" || f.group === group);
    return (
        <SiteLayout>
            <PageHead
                label="Features"
                title={["Everything", "to pair."]}
                lede={<><b>Remote collaboration built for code.</b> Edit, talk, draw and run together in a single room.</>}
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
