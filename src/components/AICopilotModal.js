import React, { useState } from 'react';
import { Sparkles, Code2, ShieldAlert, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { Modal } from './ux/primitives';
import toast from 'react-hot-toast';
import { askCopilot } from '../utils/copilot';

function AICopilotModal({ isOpen, onClose, code = "", language = "javascript", onApplyCode, roomId = null, projectId = null, userId = null }) {
    const [action, setAction] = useState("explain");
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleRunAI = async (selectedAction = action) => {
        setLoading(true);
        setAction(selectedAction);
        setError(null);
        try {
            setResponse(await askCopilot({ action: selectedAction, code, language, prompt, roomId, projectId, userId }));
        } catch (err) {
            setResponse(null);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const resultCode = response && (response.refactoredCode || response.fixedCode || response.testCode || response.generatedCode);
    const applyCode = response && (response.refactoredCode || response.fixedCode || response.generatedCode);

    return (
        <Modal open onClose={onClose} wide label={`AI copilot · ${language}`} title="Ask about this code" description="Pick a task or describe what you want. Results can be applied straight to the editor.">
            <div className="u-steps" style={{ '--n': 4 }}>
                {[
                    { id: 'explain', label: 'Explain', icon: <Code2 size={15} /> },
                    { id: 'refactor', label: 'Refactor', icon: <Sparkles size={15} /> },
                    { id: 'fix', label: 'Audit & fix', icon: <ShieldAlert size={15} /> },
                    { id: 'test', label: 'Write tests', icon: <CheckCircle size={15} /> },
                ].map((item) => (
                    <button key={item.id} type="button" className={`u-step${action === item.id ? ' on' : ''}`} onClick={() => handleRunAI(item.id)} disabled={loading}>
                        <span className="u-label" style={{ color: 'inherit' }}>{item.icon}</span>
                        <b>{item.label}</b>
                    </button>
                ))}
            </div>

            <form className="h-join" onSubmit={(e) => { e.preventDefault(); if (prompt.trim()) handleRunAI('prompt'); }}>
                <input className="u-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Or ask for something specific…" aria-label="Prompt" />
                <button type="submit" className="u-btn u-btn--solid u-btn--lg" disabled={loading || !prompt.trim()} aria-label="Send prompt">
                    {loading && action === 'prompt' ? <Loader2 size={16} className="u-spin" /> : <ArrowRight size={16} />}
                </button>
            </form>

            {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span className="u-label"><Loader2 size={12} className="u-spin" /> Thinking…</span>
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

            {response && !loading && (
                <div className="u-pane u-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div className="s-view-head" style={{ padding: '18px 20px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: 20 }}>{response.title}</h3>
                            {applyCode && onApplyCode && (
                                <button type="button" className="u-btn u-btn--solid u-btn--sm" onClick={() => { onApplyCode(applyCode); toast.success('Applied to the editor'); onClose(); }}>
                                    Apply to editor
                                </button>
                            )}
                        </div>
                        {response.explanation && <p className="u-muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{response.explanation}</p>}
                    </div>
                    {resultCode && (
                        <pre className="u-code" style={{ maxHeight: 320 }}>
                            {resultCode.split('\n').map((l, i) => <span key={i}>{l || ' '}</span>)}
                        </pre>
                    )}
                    {response.summary && <div className="s-view-foot"><span>{response.summary}</span></div>}
                </div>
            )}
        </Modal>
    );
}

export default AICopilotModal;
