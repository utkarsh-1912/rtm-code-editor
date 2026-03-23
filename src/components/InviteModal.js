import React, { useState } from "react";
import { X, UserPlus, Mail, Shield, User, Send, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { getBackendUrl } from "../utils/api";

const ROLES = [
    { id: "member", label: "Member", desc: "Can view and edit code", color: "#3b82f6" },
    { id: "guest", label: "Guest", desc: "View-only access", color: "#94a3b8" },
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
        <div style={{
            position: "fixed", inset: 0, zIndex: 3000,
            backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px"
        }} onClick={onClose}>
            <div style={{
                width: "100%", maxWidth: "420px",
                backgroundColor: "var(--bg-card)",
                borderRadius: "20px",
                border: "1px solid var(--border-color)",
                overflow: "hidden",
                boxShadow: "0 25px 60px rgba(0,0,0,0.6)"
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: "24px 24px 0",
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between"
                }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <UserPlus size={18} color="white" />
                            </div>
                            <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)" }}>Invite to Project</h2>
                        </div>
                        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginLeft: "46px", marginTop: "-2px" }}>
                            Invite teammates to <strong style={{ color: "var(--primary)" }}>{projectName}</strong>
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: "24px" }}>
                    {sent ? (
                        <div style={{ textAlign: "center", padding: "24px 0" }}>
                            <div style={{ marginBottom: "16px" }}>
                                <CheckCircle size={52} color="#10b981" style={{ filter: "drop-shadow(0 0 16px rgba(16,185,129,0.4))" }} />
                            </div>
                            <p style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-main)", marginBottom: "8px" }}>Invite Sent!</p>
                            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "24px" }}>
                                {email} will receive an email with a join link. They'll be added as <strong>{role}</strong> once they accept.
                            </p>
                            <button onClick={handleNewInvite} style={{
                                padding: "10px 24px", backgroundColor: "rgba(59,130,246,0.1)", color: "var(--primary)",
                                border: "1px solid rgba(59,130,246,0.3)", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "13px"
                            }}>
                                Invite Another
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Email input */}
                            <label style={{ display: "block", fontSize: "11px", fontWeight: "800", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>
                                Email Address
                            </label>
                            <div style={{ position: "relative", marginBottom: "20px" }}>
                                <Mail size={15} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                                <input
                                    type="email"
                                    placeholder="colleague@company.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleSend()}
                                    autoFocus
                                    style={{
                                        width: "100%", padding: "12px 14px 12px 40px",
                                        backgroundColor: "var(--bg-dark)",
                                        border: "1px solid var(--border-color)",
                                        borderRadius: "10px", color: "var(--text-main)",
                                        fontSize: "14px", outline: "none", transition: "border 0.2s"
                                    }}
                                />
                            </div>

                            {/* Role selection */}
                            <label style={{ display: "block", fontSize: "11px", fontWeight: "800", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
                                Role
                            </label>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
                                {ROLES.map(r => (
                                    <button key={r.id} onClick={() => setRole(r.id)} style={{
                                        display: "flex", alignItems: "center", gap: "12px",
                                        padding: "12px 14px", borderRadius: "10px",
                                        border: role === r.id ? `1px solid ${r.color}40` : "1px solid var(--border-color)",
                                        backgroundColor: role === r.id ? `${r.color}10` : "transparent",
                                        cursor: "pointer", textAlign: "left", transition: "all 0.15s"
                                    }}>
                                        <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: `${r.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {r.id === "member" ? <User size={15} color={r.color} /> : <Shield size={15} color={r.color} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-main)" }}>{r.label}</div>
                                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{r.desc}</div>
                                        </div>
                                        <div style={{
                                            width: "16px", height: "16px", borderRadius: "50%",
                                            border: role === r.id ? `5px solid ${r.color}` : "2px solid var(--border-color)",
                                            transition: "all 0.15s", flexShrink: 0
                                        }} />
                                    </button>
                                ))}
                            </div>

                            {/* Send button */}
                            <button onClick={handleSend} disabled={sending || !email.trim()} style={{
                                width: "100%", padding: "14px",
                                background: sending || !email.trim() ? "rgba(59,130,246,0.3)" : "linear-gradient(135deg,#3b82f6,#2563eb)",
                                color: "white", border: "none", borderRadius: "12px",
                                fontSize: "15px", fontWeight: "700", cursor: sending || !email.trim() ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                transition: "all 0.2s"
                            }}>
                                {sending ? (
                                    <>
                                        <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                                        Sending…
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        Send Invitation
                                    </>
                                )}
                            </button>

                            <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", marginTop: "12px", lineHeight: "1.5" }}>
                                If they don't have an account, they'll be prompted to sign up before joining.
                            </p>
                        </>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
