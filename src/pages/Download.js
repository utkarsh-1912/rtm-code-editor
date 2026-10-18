import React from "react";
import { Link } from "react-router-dom";
import { Globe, Smartphone, Monitor, Apple, ArrowUpRight } from "lucide-react";
import SiteLayout, { PageHead } from "../components/Site/SiteLayout";
import CtaBand from "../components/Site/CtaBand";
import { pad2 } from "../components/ux/primitives";

const PLATFORMS = [
    { icon: Globe, name: "Web", text: "Chrome, Firefox, Safari and Edge. Nothing to install.", live: true },
    { icon: Smartphone, name: "Mobile browsers", text: "Join rooms, chat and draw from iOS and Android browsers.", live: true },
    { icon: Apple, name: "macOS", text: "Native desktop app with system-level screen sharing." },
    { icon: Monitor, name: "Windows & Linux", text: "Native desktop app for the rest of the team." },
];

export default function Download() {
    return (
        <SiteLayout>
            <PageHead
                label="Download"
                title={["Use it", "anywhere."]}
                lede={<><b>Utkristi CoLabs runs in your browser today.</b> Desktop apps are on the way.</>}
            />

            <ul className="u-rows">
                {PLATFORMS.map(({ icon: Icon, name, text, live }, i) => (
                    <li key={name} className="u-row d-row-plat" data-rise style={{ "--d": `${i * 60}ms`, cursor: "default" }}>
                        <span className="u-row-idx">{pad2(i + 1)}</span>
                        <div className="d-plat">
                            <span className="d-ico"><Icon size={18} /></span>
                            <div className="u-row-main">
                                <span className="u-row-title" style={{ fontSize: 22 }}>{name}</span>
                                <span className="u-muted u-small">{text}</span>
                            </div>
                        </div>
                        <div className="u-row-side">
                            {live
                                ? <Link to="/" className="u-btn u-btn--solid u-btn--sm">Open in browser <ArrowUpRight size={14} /></Link>
                                : <span className="u-chip u-chip--mono"><span className="u-dot u-dot--warn" /> Coming soon</span>}
                        </div>
                    </li>
                ))}
            </ul>

            <CtaBand />
        </SiteLayout>
    );
}
