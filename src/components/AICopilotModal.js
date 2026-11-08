import React, { useEffect, useState } from 'react';
import Icon from "./icons/Icon";
import { Modal } from './ux/primitives';
import toast from 'react-hot-toast';
import { askCopilot } from '../utils/copilot';
import RichText from './RichText';

const TASKS = [
    { id: 'explain', label: 'Explain', icon: 'explain' },
    { id: 'refactor', label: 'Refactor', icon: 'refactor' },
    { id: 'fix', label: 'Audit & fix', icon: 'bug' },
    { id: 'test', label: 'Write tests', icon: 'tests' },
];
const KEEP = 20;

// Same task + same code (+ same question) = same request; a short hash is enough to spot it.
function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}
const ago = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

// Answers are kept per room or project in this browser, so you can look back without asking again.
function useHistory(scope) {
    const key = `ai-history-${scope}`;
    const read = () => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
    const [list, setList] = useState(read);
    useEffect(() => { setList(read()); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
    const add = (entry) => setList((prev) => {
        const next = [entry, ...prev.filter((e) => e.sig !== entry.sig)].slice(0, KEEP);
        try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage full or blocked */ }
        return next;
    });
    const clear = () => { setList([]); try { localStorage.removeItem(key); } catch { /* ignore */ } };
    return { list, add, clear };
}

function AICopilotModal({ isOpen, onClose, code = "", language = "javascript", onApplyCode, onInsertCode, roomId = null, projectId = null, userId = null }) {
    const [action, setAction] = useState("explain");
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [shownFrom, setShownFrom] = useState(null); // history entry being shown
    const [error, setError] = useState(null);
    const [repeat, setRepeat] = useState(null); // { entry, action } waiting for "show saved" or "run again"
    const history = useHistory(roomId || projectId || 'scratch');

    if (!isOpen) return null;

    const sigFor = (a) => hash(`${a}|${language}|${a === 'prompt' ? prompt.trim() : ''}|${code}`);

    const run = async (selectedAction) => {
        setRepeat(null);
        setLoading(true);
        setAction(selectedAction);
        setError(null);
        setShownFrom(null);
        try {
            const res = await askCopilot({ action: selectedAction, code, language, prompt, roomId, projectId, userId });
            setResponse(res);
            history.add({ sig: sigFor(selectedAction), action: selectedAction, prompt: selectedAction === 'prompt' ? prompt.trim() : '', language, at: Date.now(), response: res });
        } catch (err) {
            setResponse(null);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Asked the same thing about the same code before? Offer that answer first (it costs nothing).
    const handleRunAI = (selectedAction = action) => {
        const prior = history.list.find((e) => e.sig === sigFor(selectedAction));
        if (prior) { setAction(selectedAction); setRepeat({ entry: prior, action: selectedAction }); return; }
        run(selectedAction);
    };
    const showEntry = (entry) => { setRepeat(null); setError(null); setAction(entry.action); setResponse(entry.response); setShownFrom(entry); };

    // Code from an answer: replace the editor's code, or add it at the end.
    const insert = (snippet) => {
        if (onInsertCode) onInsertCode(snippet);
        else if (onApplyCode) onApplyCode(code.trim() ? `${code.replace(/\s+$/, '')}\n\n${snippet}` : snippet);
        toast.success('Added to the end of the editor');
    };
    const canInsert = !!(onInsertCode || onApplyCode);

    const resultCode = response && (response.refactoredCode || response.fixedCode || response.testCode || response.generatedCode);
    const applyCode = response && (response.refactoredCode || response.fixedCode || response.generatedCode);
    const taskLabel = (id) => TASKS.find((t) => t.id === id)?.label || 'Question';

    return (
        <Modal open onClose={onClose} wide label={`AI copilot · ${language}`} title="Ask about this code" description="Pick a task or describe what you want. Results can be added to the editor, and earlier answers are kept below.">
            <div className="u-steps" style={{ '--n': 4 }}>
                {TASKS.map((item) => (
                    <button key={item.id} type="button" className={`u-step${action === item.id ? ' on' : ''}`} onClick={() => handleRunAI(item.id)} disabled={loading}>
                        <span className="u-label" style={{ color: 'inherit' }}><Icon name={item.icon} size={16} /></span>
                        <b>{item.label}</b>
                    </button>
                ))}
            </div>

            <form className="h-join" onSubmit={(e) => { e.preventDefault(); if (prompt.trim()) handleRunAI('prompt'); }}>
                <input className="u-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Or ask for something specific…" aria-label="Prompt" />
                <button type="submit" className="u-btn u-btn--solid u-btn--lg" disabled={loading || !prompt.trim()} aria-label="Send prompt">
                    {loading && action === 'prompt' ? <Icon name="reload" size={16} className="u-spin" /> : <Icon name="send" size={16} />}
                </button>
            </form>

            {repeat && !loading && (
                <div className="ai-repeat" role="alertdialog" aria-label="Already answered">
                    <p><b>You already asked this</b> about the same code ({ago(repeat.entry.at)}). Show that answer, or ask the model again? Asking again uses tokens.</p>
                    <span>
                        <button type="button" className="u-btn u-btn--solid u-btn--sm" onClick={() => showEntry(repeat.entry)} autoFocus>Show saved answer</button>
                        <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => run(repeat.action)}>Ask again</button>
                    </span>
                </div>
            )}

            {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span className="u-label"><Icon name="reload" size={12} className="u-spin" /> Thinking…</span>
                    <div className="u-skel" style={{ height: 14, width: '80%' }} />
                    <div className="u-skel" style={{ height: 14, width: '64%' }} />
                    <div className="u-skel" style={{ height: 90 }} />
                </div>
            )}

            {error && !loading && (
                <div className="u-card g-danger" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="u-label" style={{ color: 'var(--u-bad)' }}>Model unavailable</span>
                    <p className="u-small u-muted" style={{ margin: 0 }}>{error}</p>
                </div>
            )}

            {response && !loading && !repeat && (
                <div className="u-pane u-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div className="s-view-head" style={{ padding: '18px 20px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: 20 }}>{response.title}{shownFrom && <span className="ai-saved"> · saved {ago(shownFrom.at)}</span>}</h3>
                            <span className="ai-actions">
                                {resultCode && canInsert && (
                                    <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => insert(resultCode)}>Insert into editor</button>
                                )}
                                {applyCode && onApplyCode && (
                                    <button type="button" className="u-btn u-btn--solid u-btn--sm" onClick={() => { onApplyCode(applyCode); toast.success('Replaced the editor code'); onClose(); }}>
                                        Replace editor code
                                    </button>
                                )}
                            </span>
                        </div>
                    </div>
                    {response.explanation && <RichText className="ai-rt" text={response.explanation} onCode={canInsert ? insert : undefined} />}
                    {resultCode && (
                        <pre className="u-code" style={{ maxHeight: 320 }}>
                            {resultCode.split('\n').map((l, i) => <span key={i}>{l || ' '}</span>)}
                        </pre>
                    )}
                    {response.summary && <div className="s-view-foot"><span>{response.summary}</span></div>}
                </div>
            )}

            {history.list.length > 0 && (
                <details className="ai-history">
                    <summary>Earlier answers here · {history.list.length}</summary>
                    <ul>
                        {history.list.map((e) => (
                            <li key={e.sig + e.at}>
                                <button type="button" onClick={() => showEntry(e)} className={shownFrom?.sig === e.sig ? 'on' : ''}>
                                    <b>{taskLabel(e.action)}</b>
                                    <span className="u-ellipsis">{e.prompt || e.response?.explanation?.slice(0, 90) || ''}</span>
                                    <em>{ago(e.at)}</em>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <button type="button" className="u-btn u-btn--quiet u-btn--sm" onClick={() => { if (window.confirm('Forget the earlier answers for this room?')) history.clear(); }}>Clear history</button>
                </details>
            )}
        </Modal>
    );
}

export default AICopilotModal;
