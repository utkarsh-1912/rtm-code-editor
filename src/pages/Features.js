import React, { useState } from "react";
import { Code2, Video, PenTool, Terminal, MessageSquare, Sparkles, FolderTree, GitCompare, Users, Zap, Search, Command, Database, MonitorDown, BellRing, Share2, CalendarPlus, Lock, LayoutTemplate, Workflow, NotebookPen, KeyRound, SquareTerminal, WifiOff, ShieldCheck, Eye, Timer, Captions, FileInput, ClipboardList, CalendarClock, EyeOff, ClipboardCheck, PlayCircle, Star, Palette } from "lucide-react";
import SiteLayout, { PageHead } from "../components/Site/SiteLayout";
import CtaBand from "../components/Site/CtaBand";
import ModelsBand from "../components/Site/ModelsBand";
import { pad2 } from "../components/ux/primitives";

const FEATURES = [
    { group: "Collaborate", icon: Code2, title: "Multiplayer editing", text: "Everyone types in the same file with live cursors and conflict-free sync. Vim and Emacs keybindings included." },
    { group: "Collaborate", icon: Video, title: "Voice, video & screen", text: "Calls in every room and project. Present your screen with your camera still on, then point and draw on it together. Everyone in the room hears when a call starts, and you check your camera and mic before joining." },
    { group: "Collaborate", icon: PenTool, title: "Whiteboard", text: "Doodle together in real time. Sketch an idea or circle a bug, from a laptop or a phone, with everyone's pointer on the board." },
    { group: "Collaborate", icon: Workflow, title: "Flowcharts & system design", text: "Drag in services, databases, queues and caches, connect them with labelled arrows, and edit together." },
    { group: "Collaborate", icon: Eye, title: "Follow me", text: "One click and everyone's editor scrolls with yours, line for line, whatever their screen size. Anyone can step away and follow again." },
    { group: "Collaborate", icon: Timer, title: "Session timer", text: "A countdown the whole room shares: a pairing block, a break or the parts of an interview. It stays put if someone reloads." },
    { group: "Collaborate", icon: Captions, title: "Live captions", text: "Turn on captions in a call and everyone who has them on reads what's said. Each person chooses whether their own speech is captioned." },
    { group: "Collaborate", icon: MessageSquare, title: "Room chat", text: "Chat with emoji and line breaks right beside the code you are discussing." },
    { group: "Meet", icon: CalendarPlus, title: "Scheduled calls", text: "Plan pairing sessions and interviews in any time zone. Invitees get an email with a calendar invite attached, answer Yes or No in one click, and get a reminder. Reschedule and their calendars update." },
    { group: "Meet", icon: CalendarClock, title: "Booking links", text: "Share your weekly hours; people pick a free time in their own time zone and the meeting, room and invites are made for them. Connect Google Calendar, Outlook or any iCal feed and busy times are never offered." },
    { group: "Meet", icon: EyeOff, title: "Interviewer panel", text: "A private chat and notes inside the room that only organisers see, so the panel can coordinate without the candidate seeing." },
    { group: "Meet", icon: ClipboardCheck, title: "Structured feedback", text: "Rate five skills and recommend. Others' scores unlock after you submit yours. Draft it with your AI model from what was recorded, then copy or download the debrief." },
    { group: "Meet", icon: PlayCircle, title: "Code playback", text: "Replay how the code was written during a meeting at up to 8× speed. Large pastes are marked, and the room tells everyone it's recording." },
    { group: "Meet", icon: NotebookPen, title: "Meeting review", text: "Private notes, code snapshots with line-by-line changes and comments, and co-organisers. Turn the AI copilot off for guests. End the meeting and guests lose access at once." },
    { group: "Meet", icon: Star, title: "Guest feedback", text: "After the meeting, guests rate it and leave a comment in a few seconds. Organisers see every answer on the meeting page." },
    { group: "Meet", icon: Palette, title: "Custom branding", text: "Enterprise teams show their logo and name on meeting pages, booking pages and emails, in the same clean theme." },
    { group: "Build", icon: FileInput, title: "Import a problem", text: "Paste a LeetCode or Codeforces link: the statement, starter code for your language and the example tests arrive in the room, with each example one click from the Input box." },
    { group: "Build", icon: ClipboardList, title: "Session kits", text: "Save a problem, starter code, language and timer as a kit. Apply it in any room, or attach it to a booking link or a call so the room is ready when people arrive." },
    { group: "Build", icon: Terminal, title: "Run 17 languages", text: "JavaScript, Python, Java, C++, Go, Rust, SQL and more. Run together and share the output with the whole room." },
    { group: "Build", icon: Database, title: "SQL with your own data", text: "Import CSV, TSV or JSON files as tables, then query them by name with SQLite. No database to set up." },
    { group: "Build", icon: FolderTree, title: "Project workspaces", text: "Persistent multi-file projects with nested folders, drag-and-drop moves, live preview and team access. Ten on Free, unlimited on Team." },
    { group: "Build", icon: LayoutTemplate, title: "Layouts your way", text: "Arrange rooms and projects as cards: problem, code, output, chat, people and the call. Presets for interviews and pairing." },
    { group: "Build", icon: GitCompare, title: "Snapshots & diffs", text: "Save the state of a session and compare versions side by side. Unlimited on Team." },
    { group: "Build", icon: Sparkles, title: "AI copilot", text: "Explanations, refactors, fixes and tests inside the session, with nothing to set up. Pick the model you like as your default. Ten prompts a day on Free, unlimited on Team." },
    { group: "Build", icon: KeyRound, title: "Bring your own model", text: "Connect Gemini, Claude Sonnet and Haiku, OpenAI, OpenRouter, Grok, Qwen, Kimi, Sarvam or any OpenAI-compatible server with your own API key. Keys stay encrypted on your device and only go to their provider." },
    { group: "Desktop", icon: MonitorDown, title: "Desktop apps", text: "Installers for Windows, macOS and Linux. Open folders from your computer, run code on your own machine first, and fall back to the cloud when you need it." },
    { group: "Desktop", icon: SquareTerminal, title: "Built-in terminal", text: "A terminal docked in your project, running in its folder on your computer. Pop it out into its own window any time." },
    { group: "Desktop", icon: WifiOff, title: "Works offline", text: "All 17 languages run on your computer with one-click language packs. Your workspace shows from the last sync, and the offline editor opens, saves and runs files." },
    { group: "Organise", icon: Zap, title: "Instant rooms", text: "Link-shared rooms for pairing and interviews. Guests join without an account." },
    { group: "Organise", icon: Share2, title: "Editor & spectator links", text: "Share a room as an editor or as a read-only spectator, from one invite dialog." },
    { group: "Organise", icon: Lock, title: "Private & invite-only rooms", text: "Open to anyone with the link, ask-to-join where you let people in, or invited accounts only." },
    { group: "Organise", icon: ShieldCheck, title: "Private projects", text: "Projects open only for you, people you invite, and whoever you give the project's private link. Only the owner can rename, delete or invite." },
    { group: "Organise", icon: BellRing, title: "Push & email alerts", text: "Invites reach you as push notifications and email, with an in-app inbox as the record." },
    { group: "Organise", icon: Code2, title: "Snippet library", text: "Save reusable snippets, filter by language and tag, and export them to GitHub gists." },
    { group: "Organise", icon: Users, title: "Teams", text: "Shared snippet vaults with owner, admin and member roles." },
    { group: "Organise", icon: Search, title: "Search everything", text: "Ctrl+K finds rooms, projects, files inside projects, snippets and meetings, plus every page and action." },
    { group: "Organise", icon: Command, title: "Focus mode & shortcuts", text: "Alt+F for distraction-free focus, and ? for help and every shortcut." },
];

const GROUPS = ["All", "Collaborate", "Meet", "Build", "Desktop", "Organise"];

export default function Features() {
    const [group, setGroup] = useState("All");
    const list = FEATURES.filter((f) => group === "All" || f.group === group);
    return (
        <SiteLayout>
            <PageHead
                label="Features"
                title={["Everything", "to pair."]}
                lede={<><b>Remote collaboration built for code.</b> Edit, talk, draw and run together, follow each other through the code, and take a meeting from booking to debrief, in the browser or on your desktop.</>}
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

            <ModelsBand />

            <CtaBand />
        </SiteLayout>
    );
}
