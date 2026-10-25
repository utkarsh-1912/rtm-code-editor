import React, { useState } from "react";
import { Lock, DoorOpen, LogIn, Home, Check, X, Globe, Mail } from "lucide-react";

// Shown instead of the room while you wait to be let in, or when you can't join.
export function AccessScreen({ access, signedInAs, onSignIn, onHome }) {
    if (!access || access.status === "in" || access.status === "granted") return null;
    const waiting = access.status === "waiting";
    let title;
    let body;
    if (waiting) {
        title = "Asking to join";
        body = access.ownerHere
            ? "The host has been told you're here. You'll join as soon as they let you in."
            : "The host isn't in the room right now. Keep this page open; you'll join as soon as they let you in.";
    } else if (access.reason === "sign-in") {
        title = "This room is private";
        body = "Only invited people can join. Sign in with the account the host invited.";
    } else if (access.reason === "not-invited") {
        title = "You're not on the invite list";
        body = `${signedInAs ? `You're signed in as ${signedInAs}, which` : "Your account"} isn't invited to this private room. Ask the host to add your email.`;
    } else {
        title = "The host didn't let you in";
        body = "You can ask them for a new invite or try again later.";
    }
    return (
        <div className="ra-screen" role="alert">
            <div className="ra-card">
                <span className={`ra-ico${waiting ? " is-waiting" : ""}`}>{waiting ? <DoorOpen size={22} /> : <Lock size={22} />}</span>
                <h2>{title}</h2>
                <p>{body}</p>
                {waiting && <span className="ra-dots" aria-hidden="true"><i /><i /><i /></span>}
                <div className="ra-actions">
                    {access.reason === "sign-in" && <button className="u-btn u-btn--solid" onClick={onSignIn}><LogIn size={15} /> Sign in</button>}
                    <button className="u-btn u-btn--ghost" onClick={onHome}><Home size={15} /> {waiting ? "Cancel" : "Go home"}</button>
                </div>
            </div>
        </div>
    );
}

// Owner: people asking to join, with Let in / Deny (and "always" for signed-in people).
export function KnockList({ knocks, onAnswer }) {
    const [always, setAlways] = useState({});
    if (!knocks.length) return null;
    return (
        <div className="ra-knocks" aria-live="polite">
            {knocks.map((k) => (
                <div key={k.socketId} className="ra-knock">
                    <span className="ra-knock-av">{String(k.name || "?").slice(0, 2).toUpperCase()}</span>
                    <div className="ra-knock-text">
                        <b className="u-ellipsis">{k.name} wants to join</b>
                        <span className="u-ellipsis">{k.email || "Guest, not signed in"}</span>
                        {k.email && (
                            <label className="ra-always">
                                <input type="checkbox" checked={!!always[k.socketId]} onChange={(e) => setAlways((a) => ({ ...a, [k.socketId]: e.target.checked }))} />
                                Always let this email in
                            </label>
                        )}
                    </div>
                    <div className="ra-knock-actions">
                        <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => onAnswer(k, false)} aria-label={`Deny ${k.name}`}><X size={14} /></button>
                        <button className="u-btn u-btn--solid u-btn--sm" onClick={() => onAnswer(k, true, !!always[k.socketId])}><Check size={14} /> Let in</button>
                    </div>
                </div>
            ))}
        </div>
    );
}

export const VISIBILITY_OPTIONS = [
    { id: "public", Icon: Globe, label: "Anyone with the link", note: "Guests can join with just a name." },
    { id: "invite", Icon: DoorOpen, label: "Ask to join", note: "People knock and you let them in." },
    { id: "private", Icon: Lock, label: "Invited people only", note: "Signed-in accounts on your invite list." },
];

// Owner settings in the share dialog: who can join, and the invite list.
export function AccessSettings({ meta, onSave }) {
    const [email, setEmail] = useState("");
    if (!meta) return null;
    const current = VISIBILITY_OPTIONS.find((o) => o.id === meta.visibility) || VISIBILITY_OPTIONS[0];
    if (!meta.isOwner) {
        return (
            <div className="ra-settings ra-settings--ro">
                <span className="d-ico"><current.Icon size={16} /></span>
                <div>
                    <b>{current.label}</b>
                    <span className="u-small u-muted">{meta.hasOwner ? "Only the room's owner can change who can join." : "The first signed-in person in a room becomes its owner and can make it private."}</span>
                </div>
            </div>
        );
    }
    const allowed = meta.allowed || [];
    const add = (e) => {
        e.preventDefault();
        const v = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || allowed.includes(v)) return;
        onSave(meta.visibility, [...allowed, v]);
        setEmail("");
    };
    return (
        <div className="ra-settings">
            <span className="u-label">Who can join</span>
            <div className="ra-options" role="radiogroup" aria-label="Who can join">
                {VISIBILITY_OPTIONS.map((o) => (
                    <button key={o.id} type="button" role="radio" aria-checked={meta.visibility === o.id} className={meta.visibility === o.id ? "on" : ""} onClick={() => onSave(o.id, allowed)}>
                        <o.Icon size={16} />
                        <b>{o.label}</b>
                        <span>{o.note}</span>
                    </button>
                ))}
            </div>
            {meta.visibility !== "public" && (
                <div className="ra-invites">
                    <span className="u-label">Invite list · {allowed.length}</span>
                    <form className="ra-invite-add" onSubmit={add}>
                        <Mail size={14} />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" aria-label="Email to invite" />
                        <button type="submit" className="u-btn u-btn--solid u-btn--sm" disabled={!email.trim()}>Add</button>
                    </form>
                    {allowed.length > 0 && (
                        <ul>
                            {allowed.map((e) => (
                                <li key={e}><span className="u-mono u-ellipsis">{e}</span><button type="button" className="u-icon" onClick={() => onSave(meta.visibility, allowed.filter((x) => x !== e))} aria-label={`Remove ${e}`}><X size={13} /></button></li>
                            ))}
                        </ul>
                    )}
                    <p className="u-small u-muted">{meta.visibility === "private" ? "They must sign in with this email. People already in the room stay." : "People on this list skip the knock."}</p>
                </div>
            )}
        </div>
    );
}
