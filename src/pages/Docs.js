import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Rocket, Terminal, Folder, Video, PenTool, Play, MonitorDown, Bot, Keyboard, Lock, LifeBuoy, Code2, Users } from "lucide-react";
import SiteLayout, { PageHead } from "../components/Site/SiteLayout";

// User documentation (the product guide). Each section: id, title, icon, and blocks of
// { h, p } or { h, list } or { h, keys }.
const SECTIONS = [
    {
        id: "start", title: "Getting started", Icon: Rocket, blocks: [
            { p: "Utkristi CoLabs is a shared coding space: write code together in real time, run it, talk on a call, draw on a whiteboard and keep the work in projects." },
            { h: "Your first room", list: ["Press New room. You get an editor, a runner and a chat at a link of its own.", "Share the link. Guests join with just a display name; no account needed.", "Pick a language from the editor bar and press Run (Ctrl Enter). Everyone sees the same output."] },
            { h: "Accounts", p: "Signing in keeps your rooms, projects, snippets and teams in your workspace and lets you use them on every device. Sign in with Google, GitHub or email." },
        ],
    },
    {
        id: "rooms", title: "Rooms", Icon: Terminal, blocks: [
            { p: "A room is one shared file with chat, a call and a whiteboard. Rooms are quick: no setup, just a link." },
            { h: "Layouts", p: "Arrange the room as cards: problem, code, input/output, chat and the call. Drag a card by its grip, resize with the dividers, or pick a preset from layout in the status bar." },
            { h: "Who can join", list: ["Anyone with the link: guests pick a name and join.", "Ask to join: people knock and the owner lets them in, once or always for their email.", "Invited people only: signed-in accounts on the owner's invite list."], tail: "Set it in Invite people. The first signed-in person in a room is its owner." },
            { h: "Spectators", p: "Share the spectator link for a read-only view, good for interviews and demos." },
            { h: "Problem pane", list: ["Paste the problem you're solving into the Problem card; everyone in the room sees it, and it's kept with the room.", "Import a LeetCode or Codeforces link (the link icon): the statement, starter code for the room's language, and the example tests. Pick an example's number to put its input in the Input box.", "Signed in? The kit icon applies a session kit (problem, starter code, language and timer) or saves the room as a new kit."] },
        ],
    },
    {
        id: "projects", title: "Projects", Icon: Folder, blocks: [
            { p: "Projects keep many files and folders, history and teammates together, and stay in your workspace." },
            { h: "Files", list: ["Create files and folders from the ⋮ menu in the file tree.", "Rename, move or delete from a file's ⋮ menu, or drag files and folders into a folder.", "Web projects show a live preview as you type; other languages get input and output panels."] },
            { h: "Layout", p: "Classic is a sidebar with the editor. Switch to cards from layout in the status bar to arrange files, editor, output, chat, people, the call and (in the desktop app) the terminal." },
            { h: "History", p: "Save snapshots and compare versions side by side from Version history." },
            { h: "Sharing", list: ["Projects are private: only you, people you invite and holders of the project's link can open them.", "Invite people from Invite: they get an email and keep access.", "The link in your address bar includes a private key; send that link to let someone in. They need to be signed in.", "Only the owner can rename, delete or invite."] },
        ],
    },
    {
        id: "calls", title: "Calls and scheduling", Icon: Video, blocks: [
            { h: "Calls", p: "Start a voice and video call in any room or project; everyone in the room gets a Join prompt. Present your screen (your camera stays on beside it), point and draw on it together, pin a person to the stage, and dock the call into your layout or keep it floating." },
            { h: "Scheduled calls", list: ["Schedule from your workspace or inside a room (Schedule a call), in your time zone or anyone else's.", "Invitees get an email with a calendar invite attached (Google, Outlook, Apple) and Yes / Can't make it buttons.", "Everyone gets a reminder 10 minutes before. Join opens 10 minutes before the start, with a camera and mic check first.", "Edit or reschedule any time: people are emailed and their calendars update. Removed people are told.", "Choose who can join: anyone with the link, ask to join, or invitees only."] },
            { h: "New interview", list: ["New › Interview offers three ways: Start now (the meeting opens now and the candidate is emailed a link), Pick a time, or Let them pick (a booking link).", "Booking links (Settings › Booking links) offer free times in the guest's time zone from your weekly hours, minus notice, buffers and your other meetings.", "Connect Google Calendar or Outlook (Settings › Connections), or paste a private iCal address on the link, and busy times are never offered. Meetings you schedule are added to a connected calendar.", "Attach a session kit to a booking link or a call to set up the room's problem and starter code."] },
            { h: "During and after", list: ["The interviewer panel (header, eye icon) is a private chat and notes for organisers only.", "The room shows recording for playback while a meeting is on; organisers can replay the code afterwards, with large pastes marked.", "Organisers can turn the AI copilot off for guests on the meeting page.", "Feedback: rate five skills and recommend. Others' feedback appears after you submit yours. Draft with AI uses your model with the recorded code, the panel chat and your notes. Copy or download the debrief.", "Guests can rate the meeting afterwards; organisers see the answers on the meeting page."] },
            { h: "For organisers", list: ["The meeting page shows the guest list with answers, your private notes, and co-organisers.", "During the call, Snapshot in the room's header saves the code; each snapshot shows its changes since the last one and takes a private comment.", "End meeting saves a final snapshot and sends guests out; only organisers keep access to the room.", "Running over? You're asked to end it 10 minutes after the end time, and it ends by itself an hour later."] },
        ],
    },
    {
        id: "whiteboard", title: "Whiteboard", Icon: PenTool, blocks: [
            { p: "Sketch freely or build diagrams together. Everyone's pointer shows on the board." },
            { h: "Diagrams", list: ["Pick shapes and system-design blocks (service, database, queue, cache…) from the library.", "Connect them with arrows; double-click a shape or a line to edit its text.", "Select something to recolour it, change line style and arrows, duplicate or delete it."] },
        ],
    },
    {
        id: "running", title: "Running code", Icon: Play, blocks: [
            { p: "Run 17 languages: JavaScript, TypeScript, Python, Java, C, C++, C#, Go, Rust, Kotlin, PHP, Ruby, Swift, Bash, Lua, R and SQL." },
            { h: "Input", p: "Type what your program reads from standard input in the Input panel before you press Run." },
            { h: "SQL with your data", p: "In a SQL room, import CSV, TSV or JSON files as tables and query them by name." },
            { h: "Where code runs", p: "On the website, code runs in a sandbox in the cloud. In the desktop app it runs on your own computer first (see Desktop app)." },
        ],
    },
    {
        id: "desktop", title: "Desktop app", Icon: MonitorDown, blocks: [
            { p: "The desktop app for Windows, macOS and Linux opens instantly and works offline." },
            { h: "Built-in runner", list: ["JavaScript, TypeScript, Python, SQL and Lua run with nothing installed.", "Languages you have installed (Java, C/C++, Go, Rust and more) are picked up automatically.", "Missing a language? Settings › Desktop app installs official language packs inside the app with one click, and they work offline afterwards.", "In shared rooms you're asked once before code runs on your computer, because it runs with your permissions."] },
            { h: "Offline", p: "Without internet your workspace and snippets show from the last time you were online, and the offline editor (Go › Offline Editor, Ctrl 4) lets you write, open, save and run code on this computer." },
            { h: "Terminal", p: "Projects have a terminal panel in the desktop app (terminal in the status bar). It runs in the project's folder on your computer; pop it out into its own window any time." },
            { h: "Folders", p: "Open a folder from your computer as a project (Ctrl Shift O), and save a project back to disk (Ctrl S)." },
        ],
    },
    {
        id: "together", title: "Working together", Icon: Users, blocks: [
            { p: "Tools for pairing, teaching and walking through code with other people, in every room." },
            { h: "Follow me", p: "All tools › Follow me makes you the presenter: everyone else's editor scrolls to the lines you're looking at (by line, so different screens and font sizes don't matter). A pill shows who's presenting; anyone can stop following and follow again." },
            { h: "Session timer", p: "All tools › Session timer starts a countdown everyone sees, with an optional label. Click the timer to change or stop it. It survives reloads." },
            { h: "Live captions", p: "During a call, turn on Live captions. You see captions from everyone who has them on, and your own speech is captioned with your browser's speech recognition (which may use your browser maker's speech service). Nobody's speech is captioned unless they turn it on." },
            { h: "Guests", p: "People without an account get a simpler room: the editor, run, chat, call and whiteboard, without the workspace tools." },
        ],
    },
    {
        id: "ai", title: "AI copilot", Icon: Bot, blocks: [
            { p: "Explain, refactor, fix and write tests for the code in front of you, with nothing to set up." },
            { h: "Choose your model", p: "Settings › AI models sets the copilot's default: the site's model, models we provide (some by request), or your own." },
            { h: "Your own API key", list: ["Add a model with your key for Gemini, Claude (Sonnet, Haiku), OpenAI, OpenRouter, Grok, Qwen, Kimi, Sarvam or any OpenAI-compatible server, then Test it.", "Keys are encrypted on your device (AES-256 in the browser, your system keychain in the desktop app) and never stored on our servers.", "Each key is only ever sent to its own provider. Add a passphrase to keep keys locked until you unlock them."] },
            { h: "Limits", p: "Free includes a daily number of prompts; Team is unlimited. Your own key and a model on your own computer (desktop app) have no limit from us." },
        ],
    },
    {
        id: "snippets", title: "Snippets and teams", Icon: Code2, blocks: [
            { p: "Save code you reuse in your vault, filter by language and tag, and copy it into any room." },
            { h: "Teams", p: "Create a team for a shared vault. Owners and admins invite people and choose their role." },
        ],
    },
    {
        id: "keys", title: "Keyboard shortcuts", Icon: Keyboard, blocks: [
            { keys: [["Ctrl K", "Search rooms, projects, files, snippets and actions"], ["?", "Help"], ["Ctrl Enter", "Run"], ["Alt F", "Focus mode"], ["Ctrl S", "Save to disk (desktop app)"], ["Ctrl 4", "Offline editor (desktop app)"], ["Ctrl D", "Duplicate on the whiteboard"], ["Del", "Delete on the whiteboard"]] },
        ],
    },
    {
        id: "security", title: "Privacy and security", Icon: Lock, blocks: [
            { list: ["Every request is checked against your sign-in: nobody can read or change your account, projects, snippets or teams by guessing an id.", "Rooms have random ids; owners can make them ask-to-join or invited-only. Projects are private to you, your invitees and holders of their private link.", "Calls travel directly between participants where possible, encrypted in transit.", "Your AI keys are encrypted on your device and never stored on our servers.", "Code you run in the cloud runs in isolated sandboxes; in the desktop app it can stay on your computer.", "See every signed-in device in Settings and sign any of them out."] },
            { p: <>More on the <Link to="/security" className="u-ul">Security</Link> and <Link to="/privacy" className="u-ul">Privacy</Link> pages.</> },
        ],
    },
    {
        id: "help", title: "Getting help", Icon: LifeBuoy, blocks: [
            { p: <>Check <Link to="/status" className="u-ul">System status</Link> if something isn't working, or write to us from <Link to="/support" className="u-ul">Support</Link>.</> },
        ],
    },
];

const text = (b) => [b.h, typeof b.p === "string" ? b.p : "", ...(b.list || []), b.tail || "", ...(b.keys || []).flat()].join(" ").toLowerCase();

export default function Docs() {
    const [q, setQ] = useState("");
    const [active, setActive] = useState(SECTIONS[0].id);
    const shown = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return SECTIONS;
        return SECTIONS.map((sec) => ({ ...sec, blocks: sec.title.toLowerCase().includes(s) ? sec.blocks : sec.blocks.filter((b) => text(b).includes(s)) })).filter((sec) => sec.blocks.length);
    }, [q]);

    // Highlight the section in view.
    useEffect(() => {
        const io = new IntersectionObserver((entries) => {
            const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
            if (top) setActive(top.target.id.replace(/^doc-/, ""));
        }, { rootMargin: "-20% 0px -70% 0px" });
        document.querySelectorAll(".dc-sec").forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, [shown]);

    return (
        <SiteLayout>
            <PageHead label="Docs" title={["How it", "works."]} lede={<><b>Everything CoLabs can do,</b> and how to use it.</>} />
            <div className="dc">
                <aside className="dc-nav" aria-label="Sections">
                    <label className="u-search dc-search">
                        <Search size={14} />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the docs" aria-label="Search the docs" />
                    </label>
                    <nav>
                        {shown.map((s) => (
                            <a key={s.id} href={`#doc-${s.id}`} className={active === s.id ? "on" : ""}><s.Icon size={14} /> {s.title}</a>
                        ))}
                    </nav>
                </aside>
                <div className="dc-body">
                    {shown.length === 0 && <p className="u-muted">Nothing in the docs matches “{q}”. Try <Link to="/support" className="u-ul">Support</Link>.</p>}
                    {shown.map((s) => (
                        <section key={s.id} id={`doc-${s.id}`} className="dc-sec">
                            <h2><span className="dc-ico"><s.Icon size={16} /></span>{s.title}</h2>
                            {s.blocks.map((b, i) => (
                                <div key={i} className="dc-block">
                                    {b.h && <h3>{b.h}</h3>}
                                    {b.p && <p>{b.p}</p>}
                                    {b.list && <ul>{b.list.map((li) => <li key={li}>{li}</li>)}</ul>}
                                    {b.tail && <p>{b.tail}</p>}
                                    {b.keys && (
                                        <dl className="dc-keys">
                                            {b.keys.map(([k, d]) => <div key={k}><dt>{k.split(" ").map((p) => <kbd key={p}>{p}</kbd>)}</dt><dd>{d}</dd></div>)}
                                        </dl>
                                    )}
                                </div>
                            ))}
                        </section>
                    ))}
                </div>
            </div>
        </SiteLayout>
    );
}
