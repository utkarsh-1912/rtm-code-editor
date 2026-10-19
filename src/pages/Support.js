import React, { useState } from "react";
import toast from "react-hot-toast";
import { Send } from "lucide-react";
import SiteLayout from "../components/Site/SiteLayout";
import { getBackendUrl } from "../utils/api";

const NOTES = [
    ["Your note", "A few lines are plenty. Steps to reproduce help with bugs."],
    ["A first reply", "By email, from a person, not a ticket bot."],
    ["Billing questions", "Plans and invoices live in Settings. For refunds, write within 14 days of a charge."],
    ["Security reports", "Mark them clearly and we will prioritise them."],
];

export default function Support() {
    const [form, setForm] = useState({ name: "", email: "", message: "" });
    const [busy, setBusy] = useState(false);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/support`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not send message");
            toast.success("Message sent. We will reply by email.");
            setForm({ name: "", email: "", message: "" });
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <SiteLayout>
            <div className="sp-grid">
                <div className="sp-intro">
                    <span className="u-label" data-rise>Support</span>
                    <h1 className="u-display u-xl u-lines">
                        <span><span style={{ "--d": "60ms" }}>Tell us</span></span>
                        <span><span style={{ "--d": "150ms" }}>what you</span></span>
                        <span><span style={{ "--d": "240ms" }}>need.</span></span>
                    </h1>
                    <p className="u-lede" data-rise>Questions, bug reports, security disclosures or a demo request. <b>We read everything.</b></p>
                    <ol className="l-list sp-notes" data-rise>
                        {NOTES.map(([t, d], i) => <li key={t}><i>{String(i + 1).padStart(2, "0")}</i><span><b>{t}.</b> {d}</span></li>)}
                    </ol>
                </div>

                <form className="u-sheetbox sp-form" onSubmit={submit} data-rise style={{ "--d": "120ms" }}>
                    <div className="u-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
                        <span className="u-label">Get in touch</span>
                        <div className="u-field">
                            <label htmlFor="s-msg">How can we help?</label>
                            <textarea id="s-msg" className="u-textarea" required minLength={10} value={form.message} onChange={set("message")} placeholder="What happened, what you expected, and anything else that helps" style={{ minHeight: 150 }} />
                        </div>
                        <div className="g-two">
                            <div className="u-field">
                                <label htmlFor="s-name">Your name</label>
                                <input id="s-name" className="u-input" required value={form.name} onChange={set("name")} placeholder="First and last name" />
                            </div>
                            <div className="u-field">
                                <label htmlFor="s-email">Email</label>
                                <input id="s-email" type="email" className="u-input" required value={form.email} onChange={set("email")} placeholder="Where we should write back" />
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                            <button className="u-btn u-btn--solid u-btn--lg" disabled={busy}><Send size={15} /> {busy ? "Sending…" : "Send the note"}</button>
                            <span className="u-label">We reply by email</span>
                        </div>
                    </div>
                </form>
            </div>
        </SiteLayout>
    );
}
