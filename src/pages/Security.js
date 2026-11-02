import React from "react";
import { Link } from "react-router-dom";
import { Lock, Radio, UserCheck, EyeOff, Cpu, Monitor, CreditCard, ArrowUpRight, KeyRound, ShieldCheck, Gauge } from "lucide-react";
import SiteLayout, { PageHead } from "../components/Site/SiteLayout";
import { pad2 } from "../components/ux/primitives";

const ITEMS = [
    { icon: Radio, title: "Peer-to-peer media", text: "Voice and video travel directly between participants where possible, encrypted in transit.", cap: "peer-to-peer · encrypted" },
    { icon: Lock, title: "Encrypted connections", text: "Traffic between your browser and our servers uses HTTPS and secure real-time connections.", cap: "https · wss" },
    { icon: UserCheck, title: "Managed authentication", text: "Sign in with Google, GitHub or email through a managed identity service. We never see your Google or GitHub password.", cap: "managed sign-in" },
    { icon: EyeOff, title: "Private by link", text: "Rooms are identified by random IDs. Spectator links are read-only, so you can share a room without handing over the keyboard.", cap: "random ids · viewer role" },
    { icon: Lock, title: "Invite-only and private rooms", text: "Owners can make a room ask-to-join or invited-accounts-only. The server checks who you are before you get in, and connections outside a room can't send anything into it.", cap: "verified sign-in · owner approval" },
    { icon: ShieldCheck, title: "Checked on every request", text: "The server verifies your sign-in on every request and only acts on your own account, projects, snippets and teams. Projects open only to their owner, invitees and holders of a private link, never by guessing a number.", cap: "verified sign-in · per-resource access" },
    { icon: KeyRound, title: "Your AI keys stay yours", text: "API keys you add for your own models are encrypted on your device (AES-256 with a key the browser can't export, or your system keychain in the desktop app), can be locked with a passphrase, and are only ever sent to their own provider. We never store them.", cap: "aes-256 · os keychain · origin-bound" },
    { icon: Gauge, title: "Abuse protection", text: "Rate limits on the API, contact form and invitations, a daily cap on meeting emails, and strict security headers on every page.", cap: "rate limits · security headers" },
    { icon: CreditCard, title: "Secure payments", text: "Card details go straight to a certified payment processor's hosted checkout. We never see or store them, and billing requests are verified against your sign-in.", cap: "hosted checkout · verified sign-in" },
    { icon: Cpu, title: "Isolated code execution", text: "Code you run on our servers runs in isolated sandboxes with time and output limits. In the desktop app, code runs on your own machine and never reaches our server.", cap: "sandboxed · local first" },
    { icon: Monitor, title: "A narrow desktop bridge", text: "The desktop app exposes only calls to local services to the page, with context isolation and the Chromium sandbox on, and opens outside links in your browser.", cap: "context isolation · sandbox" },
];

export default function Security() {
    return (
        <SiteLayout>
            <PageHead
                label="Security"
                title={["Built to be", "trusted."]}
                lede={<><b>How we protect your sessions, code and conversations.</b> Written down so you can hold us to it.</>}
            />

            <div className="u-head">
                <span className="u-label" data-rise>The rules</span>
                <div className="u-card" data-rise>
                    <div className="g-panel-head"><strong>Every room runs on these</strong><span className="u-label">{ITEMS.length} rules</span></div>
                    <ul className="g-rules">
                        {ITEMS.map(({ icon: Icon, title, text, cap }, i) => (
                            <li key={title}>
                                <span>{pad2(i + 1)}</span>
                                <div>
                                    <h5>{title}</h5>
                                    <p>{text}</p>
                                    <div className="g-cap">{cap}</div>
                                </div>
                                <span className="d-ico"><Icon size={17} /></span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <section className="u-section u-head">
                <span className="u-label" data-rise>Disclosure</span>
                <div className="u-pane s-report" data-rise>
                    <h3>Found a vulnerability?</h3>
                    <p className="u-muted">Tell us through the support page with steps to reproduce. We read every report and reply by email.</p>
                    <Link to="/support" className="u-btn u-btn--solid" style={{ alignSelf: "flex-start" }}>Report an issue <ArrowUpRight size={15} /></Link>
                </div>
            </section>
        </SiteLayout>
    );
}
