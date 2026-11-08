import React, { useEffect, useRef, useState } from "react";
import Icon from "./icons/Icon";
import ACTIONS from "../Action";
import { getBackendUrl } from "../utils/api";
import KitMenu from "./KitMenu";

// Room language -> LeetCode's starter-code language.
const LEETCODE_LANG = { javascript: "javascript", typescript: "typescript", python: "python3", java: "java", c: "c", cpp: "cpp", csharp: "csharp", go: "golang", rust: "rust", kotlin: "kotlin", php: "php", ruby: "ruby", swift: "swift", sql: "mysql", bash: "bash" };

const MAX = 20 * 1024;
const LABEL = /^(example\s*\d*|input|output|explanation|constraints?|note|follow[- ]?up|hint\s*\d*)\b[^:]{0,24}:/i;

// Pictures from these sites show in the pane; anything else stays a link.
const IMAGE_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(leetcode\.com|leetcode\.cn|codeforces\.com|codeforces\.org)\//i;

// `code` spans, [text](https://…) and bare https:// links inside a line.
function inline(text, keyBase) {
    return text.split(/(`[^`\n]+`|\[[^\]\n]+\]\(https:\/\/[^)\s]+\)|https:\/\/[^\s)]+)/g).map((part, i) => {
        const key = `${keyBase}-${i}`;
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={key}>{part.slice(1, -1)}</code>;
        const md = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/.exec(part);
        if (md) return <a key={key} href={md[2]} target="_blank" rel="noreferrer noopener">{md[1]}</a>;
        if (/^https:\/\//.test(part)) return <a key={key} href={part} target="_blank" rel="noreferrer noopener">{part.replace(/^https:\/\/(www\.)?/, "")}</a>;
        return part;
    });
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
            const img = line.match(/^!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)$/);
            if (img) {
                return IMAGE_HOSTS.test(img[2])
                    ? <img key={key} className="pb-img" src={img[2]} alt={img[1] || "Illustration from the problem"} referrerPolicy="no-referrer" />
                    : <div key={key} className="pb-p"><a href={img[2]} target="_blank" rel="noreferrer noopener">Open image</a></div>;
            }
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
export default function ProblemPane({ socketRef, roomId, userName, isReadOnly, language, onInsertCode, canUseKits, getCode, onApplyKit, onExamples, interviewMode }) {
    const storeKey = `room-problem-${roomId}`;
    const [text, setText] = useState(() => {
        try { return localStorage.getItem(storeKey) || ""; } catch { return ""; }
    });
    const [editing, setEditing] = useState(false);
    const [meta, setMeta] = useState(null); // { by, at }
    const [copied, setCopied] = useState(false);
    const [importing, setImporting] = useState(false); // the link field is open
    const [link, setLink] = useState("");
    const [busy, setBusy] = useState(false);
    const [importError, setImportError] = useState("");
    // Interviews: leave out the title, difficulty, topics and source (they hint at the answer).
    const [hideHints, setHideHints] = useState(!!interviewMode);
    useEffect(() => { setHideHints(!!interviewMode); }, [interviewMode]);
    // The last import's starter code, kept for this tab (the pane is unmounted when you switch
    // tabs on a phone). Example tests go to the whole room with the problem.
    const importKey = `room-import-${roomId}`;
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem(importKey) || "{}"); } catch { return {}; } })();
    const [starters, setStarters] = useState(saved.starters || null); // { langSlug: code }
    useEffect(() => {
        try { sessionStorage.setItem(importKey, JSON.stringify({ starters })); } catch { /* storage blocked */ }
    }, [importKey, starters]);
    // A contest the room is working through, shared with everyone: { title, source, url, index, problems }.
    const [series, setSeries] = useState(null);
    const onExamplesRef = useRef(onExamples);
    onExamplesRef.current = onExamples;
    const sendTimer = useRef(null);
    const textRef = useRef(text);
    textRef.current = text;

    const save = (value) => { try { localStorage.setItem(storeKey, value); } catch { /* storage blocked */ } };

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return undefined;
        const onChange = ({ text: incoming, by, at, tests, series: incomingSeries }) => {
            setText(incoming || "");
            save(incoming || "");
            setMeta(by ? { by, at } : null);
            if (Array.isArray(tests)) onExamplesRef.current?.(tests);
            if (incomingSeries !== undefined) setSeries(incomingSeries || null);
        };
        const onSync = ({ text: serverText, by, at, tests, series: serverSeries }) => {
            if (serverText) {
                onChange({ text: serverText, by, at, tests, series: serverSeries ?? null });
            } else if (textRef.current && !isReadOnly) {
                // The server restarted and lost it: restore from this browser.
                socket.emit(ACTIONS.PROBLEM_CHANGE, { roomId, text: textRef.current, by: userName });
            }
        };
        // Ask now, and again once this socket is in the room (asks from outside it are ignored).
        const onJoined = ({ socketId }) => { if (socketId === socket.id) socket.emit(ACTIONS.PROBLEM_SYNC_REQUEST, { roomId }); };
        socket.on(ACTIONS.PROBLEM_CHANGE, onChange);
        socket.on(ACTIONS.PROBLEM_SYNC, onSync);
        socket.on(ACTIONS.JOINED, onJoined);
        socket.emit(ACTIONS.PROBLEM_SYNC_REQUEST, { roomId });
        return () => {
            socket.off(ACTIONS.JOINED, onJoined);
            socket.off(ACTIONS.PROBLEM_CHANGE, onChange);
            socket.off(ACTIONS.PROBLEM_SYNC, onSync);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socketRef, roomId]);

    // `tests` and `nextSeries` (optional) replace the room's examples and contest; clearing the
    // problem clears both.
    const update = (value, tests, nextSeries) => {
        const v = value.slice(0, MAX);
        setText(v);
        save(v);
        setMeta({ by: userName, at: Date.now() });
        const nextTests = tests !== undefined ? tests : (v.trim() ? undefined : []);
        const seriesOut = nextSeries !== undefined ? nextSeries : (v.trim() ? undefined : null);
        if (nextTests !== undefined) onExamplesRef.current?.(nextTests);
        if (seriesOut !== undefined) setSeries(seriesOut);
        clearTimeout(sendTimer.current);
        sendTimer.current = setTimeout(() => {
            socketRef.current?.emit(ACTIONS.PROBLEM_CHANGE, {
                roomId, text: v, by: userName,
                ...(nextTests !== undefined ? { tests: nextTests } : {}),
                ...(seriesOut !== undefined ? { series: seriesOut } : {}),
            });
        }, 250);
    };
    useEffect(() => () => clearTimeout(sendTimer.current), []);

    const pasteFromClipboard = async () => {
        try {
            const clip = await navigator.clipboard.readText();
            if (clip) { update(clip, [], null); setEditing(false); }
        } catch {
            setEditing(true);
        }
    };

    const fetchImport = async (url) => {
        const res = await fetch(`${getBackendUrl()}/api/problems/import?url=${encodeURIComponent(url)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't import that link.");
        return data;
    };
    // One problem into the pane: title and topics unless hidden, the statement, the source as a
    // link, its examples; and the contest it belongs to, when there is one.
    const showProblem = (data, nextSeries) => {
        const head = hideHints ? "" : [`# ${data.title}`, [data.difficulty, ...(data.tags || []).slice(0, 6)].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
        const body = [head, data.text, hideHints ? "" : `Source: [${data.source}](${data.url})`].filter(Boolean).join("\n\n");
        update(body, Array.isArray(data.tests) ? data.tests : [], nextSeries);
        setStarters(Object.keys(data.starters || {}).length ? data.starters : null);
    };

    // A problem link, or a contest link (its problems become a strip; the first one opens).
    const importLink = async (e) => {
        e?.preventDefault();
        if (!link.trim()) return;
        setBusy(true);
        setImportError("");
        try {
            const data = await fetchImport(link.trim());
            if (data.kind === "contest") {
                const first = await fetchImport(data.problems[0].url);
                showProblem(first, { title: data.title, source: data.source, url: data.url, index: 0, problems: data.problems });
            } else {
                showProblem(data, null);
            }
            setImporting(false);
            setEditing(false);
            setLink("");
        } catch (err) {
            setImportError(err.message);
        } finally { setBusy(false); }
    };

    // Move to another problem of the contest (for everyone in the room).
    const [seriesBusy, setSeriesBusy] = useState(null);
    const openInSeries = async (i) => {
        if (!series || seriesBusy != null || i === series.index) return;
        setSeriesBusy(i);
        try {
            const data = await fetchImport(series.problems[i].url);
            showProblem(data, { ...series, index: i });
            setEditing(false);
        } catch (err) {
            setImportError(err.message);
            setImporting(true);
        } finally { setSeriesBusy(null); }
    };
    const starter = starters && LEETCODE_LANG[language] ? starters[LEETCODE_LANG[language]] : null;

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
                    {canUseKits && !isReadOnly && <KitMenu problem={text} getCode={getCode} language={language} onApply={(kit) => { if (kit.problem) update(kit.problem, [], null); setEditing(false); onApplyKit?.(kit); }} />}
                    {!isReadOnly && <button className={`ec-icon${importing ? " on" : ""}`} onClick={() => { setImporting((v) => !v); setImportError(""); }} title="Import from a LeetCode or Codeforces link" aria-label="Import problem from a link" aria-expanded={importing}><Icon name="open-external" size={14} /></button>}
                    {text.trim() && <button className="ec-icon" onClick={copy} title="Copy problem" aria-label="Copy problem">{copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}</button>}
                    {!isReadOnly && text.trim() && <button className="ec-icon" onClick={() => { update(""); setEditing(true); }} title="Clear for everyone" aria-label="Clear problem"><Icon name="delete" size={14} /></button>}
                </span>
            </div>

            {importing && !isReadOnly && (
                <form className="pb-import" onSubmit={importLink}>
                    <input className="u-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="A LeetCode or Codeforces problem or contest link" aria-label="Problem or contest link" autoFocus />
                    <button type="submit" className="u-btn u-btn--solid u-btn--sm" disabled={busy || !link.trim()}>{busy ? "Importing…" : "Import"}</button>
                    <label className="pb-hide"><input type="checkbox" checked={hideHints} onChange={(e) => setHideHints(e.target.checked)} /> Hide title, difficulty and topics (interviews)</label>
                    {importError && <p className="pb-import-error" role="alert">{importError}</p>}
                </form>
            )}
            {series && (
                <div className="pb-series" role="group" aria-label="Contest problems">
                    <span className="pb-series-name" title={series.title}>{hideHints ? "Contest" : series.title}</span>
                    <span className="pb-series-list">
                        {series.problems.map((p, i) => (
                            <button key={p.url} type="button" className={i === series.index ? "on" : ""} aria-current={i === series.index ? "true" : undefined}
                                disabled={isReadOnly || seriesBusy != null} onClick={() => openInSeries(i)}
                                title={hideHints ? `Problem ${p.label}` : `${p.label}. ${p.title}`}>{seriesBusy === i ? "…" : p.label}</button>
                        ))}
                    </span>
                    {!isReadOnly && (
                        <span className="pb-series-nav">
                            <button type="button" className="ec-icon" onClick={() => openInSeries(series.index - 1)} disabled={series.index === 0 || seriesBusy != null} aria-label="Previous problem" title="Previous problem">‹</button>
                            <button type="button" className="ec-icon" onClick={() => openInSeries(series.index + 1)} disabled={series.index >= series.problems.length - 1 || seriesBusy != null} aria-label="Next problem" title="Next problem">›</button>
                        </span>
                    )}
                </div>
            )}
            {starter && onInsertCode && !isReadOnly && !showEditor && (
                <div className="pb-starter">
                    <span>Starter code for this language is available.</span>
                    <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => { onInsertCode(starter); setStarters(null); }}>Use starter code</button>
                    <button type="button" className="ec-icon" onClick={() => setStarters(null)} aria-label="Dismiss"><Icon name="close" size={12} /></button>
                </div>
            )}
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
                        <span className="pb-corner">
                            <button type="button" className="ec-icon" onMouseDown={(e) => e.preventDefault()} onClick={() => setImporting(true)} title="Import from a LeetCode or Codeforces link" aria-label="Import problem from a link"><Icon name="open-external" size={14} /></button>
                            <button type="button" className="ec-icon" onMouseDown={(e) => e.preventDefault()} onClick={pasteFromClipboard} title="Paste from clipboard" aria-label="Paste problem from clipboard"><Icon name="paste" size={14} /></button>
                        </span>
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
