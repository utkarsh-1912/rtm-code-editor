import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Check, Minus as Dash, Plus, Minus, ArrowUpRight } from "lucide-react";
import SiteLayout, { PageHead } from "../components/Site/SiteLayout";
import { useAuth } from "../context/AuthContext";
import { catalogue, yearlyPrice, usePlan, startCheckout, openPortal } from "../utils/billing";
import { track } from "../utils/track";

const { plans, trialDays, yearlyDiscount } = catalogue;

// Rows of the comparison table: [label, free, team, enterprise]
const COMPARE = [
    ["Rooms and guests", "Unlimited", "Unlimited", "Unlimited"],
    ["Live sync, chat, voice, video, whiteboard", true, true, true],
    ["17 languages and SQL with CSV import", true, true, true],
    ["Desktop apps (Windows, macOS, Linux)", true, true, true],
    ["Projects", "3", "Unlimited", "Unlimited"],
    ["Snapshots and version diffs", "Rooms only", true, true],
    ["AI copilot", `${plans.free.limits.aiPerDay} a day`, "Unlimited", "Unlimited"],
    ["Organizations and email invites", false, true, true],
    ["Push and email notifications", false, true, true],
    ["Self-hosted runner and Judge0", false, false, true],
    ["SSO and advanced access", false, false, true],
    ["Support", "Community", "Priority", "Dedicated + SLA"],
];

const FAQ = [
    ["Is there a free plan?", "Yes, and it is not a trial. Free covers real-time rooms, voice, video, the whiteboard, 17 languages, three projects and a daily allowance of AI prompts."],
    ["How does the Team trial work?", `You get ${trialDays} days of Team to try everything. We ask for a card up front through Stripe, remind you before it ends, and you can cancel any time before then without being charged.`],
    ["Do guests need an account or a plan?", "No. Anyone with a room link can join with just a display name, whatever plan the host is on."],
    ["Is the desktop app free?", "Yes. It is the same app on Windows, macOS and Linux, and it runs code on your own Judge0 and AI on a local model when they are available. Local AI is not counted against any limit."],
    ["Can I use my own data in SQL?", "Yes. Import CSV, TSV or JSON files in a SQL room and query them by table name."],
    ["How do I cancel or change plan?", "From Settings, Plan & billing, open Manage billing. You keep Team until the end of the period you paid for, then move to Free. Your projects stay; you just cannot create new ones above the Free limit."],
    ["What about taxes and invoices?", "Prices exclude any local taxes, which Stripe adds at checkout where required. Every payment gets an emailed invoice, and past invoices live in the billing portal."],
    ["Do you offer refunds?", "If something went wrong, write to support within 14 days of a charge and we will make it right."],
];

const price = (plan, yearly) => {
    const monthly = plans[plan].monthly;
    if (monthly == null) return { amount: "Custom" };
    if (monthly === 0) return { amount: "0", sub: "free forever" };
    return yearly
        ? { amount: String(Math.round(yearlyPrice(monthly) / 12)), per: "/mo", sub: `$${yearlyPrice(monthly)} billed yearly` }
        : { amount: String(monthly), per: "/mo", sub: "billed monthly per member" };
};

const Cell = ({ v }) => (v === true ? <Check size={16} aria-label="Included" /> : v === false ? <Dash size={16} className="pc-no" aria-label="Not included" /> : v);

export default function Pricing() {
    const [open, setOpen] = useState(0);
    const [yearly, setYearly] = useState(true);
    const [busy, setBusy] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { plan: mine } = usePlan(user);
    const onTeam = mine && mine.plan !== "free";

    useEffect(() => {
        if (params.get("billing") === "cancelled") toast("Checkout cancelled. You have not been charged.");
    }, [params]);

    const upgrade = async () => {
        track("UPGRADE_CLICKED", { userId: user?.uid, source: "pricing", interval: yearly ? "year" : "month" });
        if (!user) return navigate("/signup?next=/pricing");
        setBusy(true);
        try {
            await startCheckout(yearly ? "year" : "month");
        } catch (err) {
            toast.error(err.message);
            setBusy(false);
        }
    };
    const manage = async () => {
        setBusy(true);
        try { await openPortal(); } catch (err) { toast.error(err.message); setBusy(false); }
    };

    const cta = {
        free: user
            ? <Link to="/dashboard" className="u-btn u-btn--ghost" style={{ marginTop: "auto" }}>{mine && !onTeam ? "Your current plan" : "Open workspace"} <ArrowUpRight size={15} /></Link>
            : <Link to="/signup" className="u-btn u-btn--ghost" style={{ marginTop: "auto" }}>Start free <ArrowUpRight size={15} /></Link>,
        team: onTeam
            ? <button className="u-btn u-btn--solid" style={{ marginTop: "auto" }} onClick={manage} disabled={busy}>Manage billing <ArrowUpRight size={15} /></button>
            : <button className="u-btn u-btn--solid" style={{ marginTop: "auto" }} onClick={upgrade} disabled={busy}>Start {trialDays}-day free trial <ArrowUpRight size={15} /></button>,
        enterprise: <Link to="/support" className="u-btn u-btn--ghost" style={{ marginTop: "auto" }}>Talk to us <ArrowUpRight size={15} /></Link>,
    };

    return (
        <SiteLayout>
            <PageHead
                label="Pricing"
                title={["Simple", "pricing."]}
                lede={<><b>Start free, upgrade when you outgrow it.</b> Guests are always free, and so is the desktop app.</>}
            />

            <div className="pr-toggle" data-rise>
                <div className="u-seg" role="tablist" aria-label="Billing period">
                    <button role="tab" aria-selected={!yearly} className={!yearly ? "on" : ""} onClick={() => setYearly(false)}>Monthly</button>
                    <button role="tab" aria-selected={yearly} className={yearly ? "on" : ""} onClick={() => setYearly(true)}>Yearly <em>save {Math.round(yearlyDiscount * 100)}%</em></button>
                </div>
            </div>

            <div className="u-sheetbox" data-rise>
                <div className="p-plans">
                    {["free", "team", "enterprise"].map((id) => {
                        const p = plans[id];
                        const featured = id === "team";
                        const pr = price(id, yearly);
                        const current = mine && ((id === "team" && onTeam) || (id === "free" && !onTeam));
                        return (
                            <article key={id} className={`p-plan ${featured ? "u-pane" : "u-card"}`}>
                                <div className="p-plan-top">
                                    <span className="u-label">{p.name}</span>
                                    {current ? <span className="u-chip u-chip--mono">Current plan</span>
                                        : featured && <span className="u-chip u-chip--mono" style={{ borderColor: "var(--u-pane-line)", color: "inherit" }}>{trialDays}-day trial</span>}
                                </div>
                                <div className="p-price">
                                    {pr.amount !== "Custom" && <small>$</small>}
                                    <span className="u-display">{pr.amount}</span>
                                    {pr.per && <small>{pr.per}</small>}
                                </div>
                                <p className="u-muted" style={{ margin: 0, fontSize: 14 }}>{pr.sub ? `${p.tagline}. ${pr.sub[0].toUpperCase()}${pr.sub.slice(1)}.` : p.tagline}</p>
                                <ul className="p-feats">
                                    {p.features.map((f) => <li key={f}><Check size={15} />{f}</li>)}
                                </ul>
                                {cta[id]}
                            </article>
                        );
                    })}
                </div>
            </div>

            <section className="u-section u-head">
                <span className="u-label" data-rise>Compare plans</span>
                <div className="pc-wrap" data-rise>
                    <table className="pc-table">
                        <thead>
                            <tr><th scope="col">What you get</th><th scope="col">Free</th><th scope="col" className="pc-hot">Team</th><th scope="col">Enterprise</th></tr>
                        </thead>
                        <tbody>
                            {COMPARE.map(([label, ...cells]) => (
                                <tr key={label}>
                                    <th scope="row">{label}</th>
                                    {cells.map((v, i) => <td key={i} className={i === 1 ? "pc-hot" : ""}><Cell v={v} /></td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

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
