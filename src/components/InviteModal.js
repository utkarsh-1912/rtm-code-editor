import React, { useState } from "react";
import { UserPlus, Shield, User, Send, CheckCircle, Loader2 } from "lucide-react";
import { Modal } from "./ux/primitives";
import toast from "react-hot-toast";
import { getBackendUrl } from "../utils/api";

const ROLES = [
    { id: "member", label: "Member", desc: "view and edit" },
    { id: "guest", label: "Guest", desc: "view only" },
];

export default function InviteModal({ isOpen, onClose, projectId, projectName, inviterName }) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("member");
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    if (!isOpen) return null;

    const handleSend = async () => {
        if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
            toast.error("Please enter a valid email address");
            return;
        }
        setSending(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/projects/${projectId}/invite`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), role, inviterName, projectName })
            });
            const data = await res.json();
            if (data.success) {
                setSent(true);
                toast.success("Invitation sent!");
            } else {
                toast.error(data.error || "Failed to send invite");
            }
        } catch (e) {
            toast.error("Network error — invite not sent");
        } finally {
            setSending(false);
        }
    };

    const handleNewInvite = () => { setEmail(""); setSent(false); };

    return (
        <Modal
            open
            onClose={onClose}
            label={`project/${projectName}`}
            title={sent ? "Invite sent." : "Invite to the project"}
            description={sent ? `${email} will get an email with a join link and join as ${role} once they accept.` : "They'll get an email with a link. No account yet? They'll sign up first."}
            onSubmit={sent ? handleNewInvite : handleSend}
            footer={sent ? <>
                <button type="button" className="u-btn u-btn--ghost" onClick={onClose}>Done</button>
                <button type="submit" className="u-btn u-btn--solid"><UserPlus size={15} /> Invite another</button>
            </> : <>
                <button type="button" className="u-btn u-btn--ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="u-btn u-btn--solid" disabled={sending || !email.trim()}>
                    {sending ? <><Loader2 size={15} className="u-spin" /> Sending…</> : <><Send size={15} /> Send invite</>}
                </button>
            </>}
        >
            {sent ? (
                <div className="u-chip u-chip--mono" style={{ alignSelf: "flex-start" }}><CheckCircle size={13} style={{ color: "var(--u-ok)" }} /> {email}</div>
            ) : (
                <>
                    <div className="u-field">
                        <label htmlFor="invite-email">Email</label>
                        <input id="invite-email" className="u-input" type="email" placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
                    </div>
                    <div className="u-field">
                        <span className="u-field-label">Role</span>
                        <div className="u-tiles">
                            {ROLES.map((r) => (
                                <button type="button" key={r.id} className={`u-tile${role === r.id ? " on" : ""}`} onClick={() => setRole(r.id)} aria-pressed={role === r.id}>
                                    <span className="u-tile-ico">{r.id === "member" ? <User size={16} /> : <Shield size={16} />}</span>
                                    <span><b>{r.label}</b><span>{r.desc}</span></span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </Modal>
    );
}
