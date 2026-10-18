import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus, Minus, ArrowUpRight } from "lucide-react";
import SiteLayout, { PageHead } from "../components/Site/SiteLayout";

const PLANS = [
    { name: "Free", price: "0", note: "For solo devs and trying things out", cta: "Start free", to: "/signup", features: ["Unlimited public rooms", "Live code sync & chat", "Voice, video & whiteboard", "Snippets library"] },
    { name: "Team", price: "12", per: true, note: "per member / month", cta: "Start Team trial", to: "/signup", featured: true, features: ["Everything in Free", "Persistent projects & snapshots", "AI copilot", "Organizations & invites", "Priority support"] },
    { name: "Enterprise", price: "Custom", note: "For larger organizations", cta: "Contact us", to: "/support", features: ["Everything in Team", "SSO & advanced access", "Dedicated support", "Custom agreements"] },
];

const FAQ = [
    ["Is there a free plan?", "Yes. Free covers real-time rooms with chat, voice, video and the whiteboard."],
    ["Do guests need an account?", "No. Anyone with a room link can join with just a display name."],
    ["Can I change plans later?", "Anytime. Upgrades apply immediately."],
];

export default function Pricing() {
    const [open, setOpen] = useState(0);
    return (
        <SiteLayout>
            <PageHead
                label="Pricing"
                title={["Simple", "pricing."]}
                lede={<><b>Start free.</b> Upgrade when your team needs persistence, AI and admin controls.</>}
            />

            <div className="u-sheetbox" data-rise>
                <div className="p-plans">
                    {PLANS.map((p) => (
                        <article key={p.name} className={`p-plan ${p.featured ? "u-pane" : "u-card"}`}>
                            <div className="p-plan-top">
                                <span className="u-label">{p.name}</span>
                                {p.featured && <span className="u-chip u-chip--mono" style={{ borderColor: "var(--u-pane-line)", color: "inherit" }}>Popular</span>}
                            </div>
                            <div className="p-price">
                                {p.price !== "Custom" && <small>$</small>}
                                <span className="u-display">{p.price}</span>
                                {p.per && <small>/mo</small>}
                            </div>
                            <p className="u-muted" style={{ margin: 0, fontSize: 14 }}>{p.note}</p>
                            <ul className="p-feats">
                                {p.features.map((f) => <li key={f}><Check size={15} />{f}</li>)}
                            </ul>
                            <Link to={p.to} className={`u-btn ${p.featured ? "u-btn--solid" : "u-btn--ghost"}`} style={{ marginTop: "auto" }}>
                                {p.cta} <ArrowUpRight size={15} />
                            </Link>
                        </article>
                    ))}
                </div>
            </div>

            <section className="u-section u-head">
                <span className="u-label" data-rise>Questions</span>
                <div className="u-faq" data-rise>
                    {FAQ.map(([q, a], i) => (
                        <div key={q} className={`u-faq-item${open === i ? " open" : ""}`}>
                            <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                                <span><i>{String(i + 1).padStart(2, "0")}</i>{q}</span>
                                {open === i ? <Minus size={18} /> : <Plus size={18} />}
                            </button>
                            <div className="u-faq-a"><p>{a}</p></div>
                        </div>
                    ))}
                </div>
            </section>
        </SiteLayout>
    );
}
