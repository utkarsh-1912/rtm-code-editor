import React, { useState } from "react";
import { Check, Copy, Share2, Pencil, Eye } from "lucide-react";
import toast from "react-hot-toast";
import { Modal } from "./ux/primitives";

function LinkRow({ icon: Icon, title, note, value }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            toast.error("Couldn't copy. Select the link and copy it manually.");
        }
    };
    return (
        <div className="sh-row">
            <span className="d-ico"><Icon size={16} /></span>
            <div className="sh-body">
                <b>{title}</b>
                <span className="u-small u-muted">{note}</span>
                <div className="dl-cmd">
                    <code title={value}>{value}</code>
                    <button type="button" className={`u-btn u-btn--sm ${copied ? "u-btn--quiet" : "u-btn--solid"}`} onClick={copy} aria-label={`Copy ${title.toLowerCase()}`}>
                        {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Share a room: editor and spectator links, room ID, and the OS share sheet when available.
export default function ShareModal({ open, onClose, roomId, peopleOnline = 0 }) {
    const base = `${window.location.origin}/editor/${encodeURIComponent(roomId)}`;
    const editorLink = base;
    const viewerLink = `${base}?role=viewer`;
    const canShare = typeof navigator !== "undefined" && !!navigator.share;

    const nativeShare = async () => {
        try {
            await navigator.share({ title: "Join my Utkristi CoLabs room", text: "Pair with me in this room:", url: editorLink });
        } catch {
            /* dismissed */
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            label={`room/${roomId} · ${peopleOnline} online`}
            title="Invite people"
            description="Rooms are private. Only people with a link can join, and guests just pick a name."
            footer={<>
                {canShare && <button type="button" className="u-btn u-btn--ghost" onClick={nativeShare}><Share2 size={15} /> Share…</button>}
                <button type="button" className="u-btn u-btn--solid" onClick={onClose}>Done</button>
            </>}
        >
            <LinkRow icon={Pencil} title="Editor link" note="Can type, run code, chat and join the call." value={editorLink} />
            <LinkRow icon={Eye} title="Spectator link" note="Read-only. Good for interviews and demos." value={viewerLink} />
            <LinkRow icon={Copy} title="Room ID" note="Paste it into “Join a room” on the home page." value={roomId} />
        </Modal>
    );
}
