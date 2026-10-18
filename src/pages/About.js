import React from "react";
import { Link } from "react-router-dom";
import { Video, Layers, Cpu, Folder, ArrowUpRight } from "lucide-react";
import SiteLayout, { PageHead } from "../components/Site/SiteLayout";
import CtaBand from "../components/Site/CtaBand";
import { pad2 } from "../components/ux/primitives";

const PILLARS = [
    { icon: Video, title: "Talk while you code", text: "Voice, video and screen sharing live inside the editor, so pairing never means switching tabs." },
    { icon: Layers, title: "Focus by design", text: "A command palette (Ctrl+K) and focus mode (Alt+F) keep every action one keystroke away and everything else out of sight." },
    { icon: Folder, title: "Rooms and projects", text: "Spin up a throwaway room in seconds, or keep a persistent multi-file project for your team." },
    { icon: Cpu, title: "Runs where you are", text: "Seventeen languages, SQL over your own CSV files, and desktop apps that use your machine's runner and local AI before the server." },
];

const PRINCIPLES = [
    ["Fast to start", "A link is all it takes. Guests join without an account."],
    ["Calm to use", "A quiet interface with one accent, and nothing fighting for attention."],
    ["Yours to keep", "Projects, snippets and history persist across devices."],
    ["Close to you", "The desktop app runs code and AI locally when it can, and only falls back to the server when it can't."],
];

export default function About() {
    return (
        <SiteLayout>
            <PageHead
                label="About"
                title={["Pairing,", "without the", "distance."]}
                lede={<><b>Utkristi CoLabs is a collaborative IDE for teams that work remotely.</b> Live code editing, voice, video, drawing, chat and code execution in 17 languages, on the web and on Windows, macOS and Linux, so remote pairing feels like sitting side by side.</>}
            />

            <div className="a-bento">
                {PILLARS.map(({ icon: Icon, title, text }, i) => (
                    <article key={title} className={`${i === 0 ? "u-pane" : "u-card"} a-pillar`} data-rise style={{ "--d": `${i * 70}ms` }}>
                        <div className="f-cell-top">
                            <span className="u-label">{pad2(i + 1)}</span>
                            <Icon size={20} />
                        </div>
                        <h3>{title}</h3>
                        <p className={i === 0 ? "u-muted" : ""}>{text}</p>
                    </article>
                ))}
            </div>

            <section className="u-section u-head">
                <span className="u-label" data-rise>What we care about</span>
                <ol className="a-principles">
                    {PRINCIPLES.map(([t, d], i) => (
                        <li key={t} data-rise style={{ "--d": `${i * 80}ms` }}>
                            <span className="u-display u-lg u-faint">{pad2(i + 1)}</span>
                            <div>
                                <h3>{t}</h3>
                                <p className="u-muted">{d}</p>
                            </div>
                        </li>
                    ))}
                </ol>
                <span />
                <Link to="/features" className="u-btn u-btn--ghost" style={{ justifySelf: "start" }}>Explore features <ArrowUpRight size={15} /></Link>
            </section>

            <CtaBand />
        </SiteLayout>
    );
}
