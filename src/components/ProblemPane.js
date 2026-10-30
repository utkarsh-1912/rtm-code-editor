import React, { useEffect, useRef, useState } from "react";
import Icon from "./icons/Icon";
import ACTIONS from "../Action";

const MAX = 20 * 1024;
const LABEL = /^(example\s*\d*|input|output|explanation|constraints?|note|follow[- ]?up|hint\s*\d*)\b[^:]{0,24}:/i;

// `code` spans inside a line.
function inline(text, keyBase) {
    return text.split(/(`[^`\n]+`)/g).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 2
            ? <code key={`${keyBase}-${i}`}>{part.slice(1, -1)}</code>
            : part
    );
}

// Light formatting for pasted questions (LeetCode style). Plain text in, React nodes out:
// nothing is injected as HTML.
function Formatted({ text }) {
    const blocks = text.split(/```[^\n]*\n?/);
    return blocks.map((block, bi) => {
        if (bi % 2 === 1) return <pre key={bi} className="pb-code">{block.replace(/\n$/, "")}</pre>;
        return block.split("\n").map((line, li) => {
            const key = `${bi}-${li}`;
            if (!line.trim()) return <div key={key} className="pb-gap" />;
            const h = line.match(/^(#{1,3})\s+(.*)$/);
            if (h) return <div key={key} className={`pb-h pb-h${h[1].length}`}>{inline(h[2], key)}</div>;
            const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
            if (bullet) return <div key={key} className="pb-li">{inline(bullet[1], key)}</div>;
            const label = line.match(LABEL);
            if (label) {
                return (
                    <div key={key} className="pb-p">
                        <b className="pb-label">{label[0]}</b>{inline(line.slice(label[0].length), key)}
                    </div>
                );
            }
            return <div key={key} className="pb-p">{inline(line, key)}</div>;
        });
    });
}

// The question the room is solving: anyone can paste or edit it; everyone sees it live.
export default function ProblemPane({ socketRef, roomId, userName, isReadOnly }) {
    const storeKey = `room-problem-${roomId}`;
    const [text, setText] = useState(() => {
        try { return localStorage.getItem(storeKey) || ""; } catch { return ""; }
    });
    const [editing, setEditing] = useState(false);
    const [meta, setMeta] = useState(null); // { by, at }
    const [copied, setCopied] = useState(false);
    const sendTimer = useRef(null);
    const textRef = useRef(text);
    textRef.current = text;

    const save = (value) => { try { localStorage.setItem(storeKey, value); } catch { /* storage blocked */ } };

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return undefined;
        const onChange = ({ text: incoming, by, at }) => {
            setText(incoming || "");
            save(incoming || "");
            setMeta(by ? { by, at } : null);
        };
        const onSync = ({ text: serverText, by, at }) => {
            if (serverText) {
                onChange({ text: serverText, by, at });
            } else if (textRef.current && !isReadOnly) {
                // The server restarted and lost it: restore from this browser.
                socket.emit(ACTIONS.PROBLEM_CHANGE, { roomId, text: textRef.current, by: userName });
            }
        };
        socket.on(ACTIONS.PROBLEM_CHANGE, onChange);
        socket.on(ACTIONS.PROBLEM_SYNC, onSync);
        socket.emit(ACTIONS.PROBLEM_SYNC_REQUEST, { roomId });
        return () => {
            socket.off(ACTIONS.PROBLEM_CHANGE, onChange);
            socket.off(ACTIONS.PROBLEM_SYNC, onSync);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socketRef, roomId]);

    const update = (value) => {
        const v = value.slice(0, MAX);
        setText(v);
        save(v);
        setMeta({ by: userName, at: Date.now() });
        clearTimeout(sendTimer.current);
        sendTimer.current = setTimeout(() => {
            socketRef.current?.emit(ACTIONS.PROBLEM_CHANGE, { roomId, text: v, by: userName });
        }, 250);
    };
    useEffect(() => () => clearTimeout(sendTimer.current), []);

    const pasteFromClipboard = async () => {
        try {
            const clip = await navigator.clipboard.readText();
            if (clip) { update(clip); setEditing(false); }
        } catch {
            setEditing(true);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        } catch { /* clipboard blocked */ }
    };

    const showEditor = !isReadOnly && (editing || !text.trim());

    return (
        <div className="pb">
            <div className="pb-bar">
                {!isReadOnly && text.trim() && (
                    <div className="u-seg pb-seg" role="tablist" aria-label="Problem view">
                        <button className={!editing ? "on" : ""} onClick={() => setEditing(false)}><Icon name="read" size={12} /> Read</button>
                        <button className={editing ? "on" : ""} onClick={() => setEditing(true)}><Icon name="edit" size={12} /> Edit</button>
                    </div>
                )}
                <span className="pb-meta">{meta?.by ? `edited by ${meta.by}` : text.trim() ? `${text.length.toLocaleString()} chars` : "shared with the room"}</span>
                <span className="pb-tools">
                    {text.trim() && <button className="ec-icon" onClick={copy} title="Copy problem" aria-label="Copy problem">{copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}</button>}
                    {!isReadOnly && text.trim() && <button className="ec-icon" onClick={() => { update(""); setEditing(true); }} title="Clear for everyone" aria-label="Clear problem"><Icon name="delete" size={14} /></button>}
                </span>
            </div>

            {showEditor ? (
                <div className="pb-edit">
                    <textarea
                        value={text}
                        onChange={(e) => update(e.target.value)}
                        onBlur={() => text.trim() && setEditing(false)}
                        placeholder={"Paste the question you're solving.\n\nExample:\nTwo Sum\nGiven an array nums and a target, return the indices of the two numbers that add up to target.\n\nExample 1:\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\n\nConstraints:\n- 2 <= nums.length <= 10^4"}
                        spellCheck={false}
                        aria-label="Problem statement"
                        autoFocus={editing}
                    />
                    {!text.trim() && (
                        <button className="pb-paste" onClick={pasteFromClipboard}><Icon name="paste" size={14} /> Paste from clipboard</button>
                    )}
                </div>
            ) : (
                <div className="pb-view" onDoubleClick={() => !isReadOnly && setEditing(true)} title={isReadOnly ? undefined : "Double-click to edit"}>
                    {text.trim() ? <Formatted text={text} /> : <p className="pb-empty">No problem added yet.</p>}
                </div>
            )}
        </div>
    );
}
