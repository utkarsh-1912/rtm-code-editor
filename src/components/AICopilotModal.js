import React, { useState } from 'react';
import { Bot, Sparkles, Code2, ShieldAlert, CheckCircle, X, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBackendUrl } from '../utils/api';

function AICopilotModal({ isOpen, onClose, code = "", language = "javascript", onApplyCode, roomId = null, projectId = null, userId = null }) {
    const [action, setAction] = useState("explain");
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);

    if (!isOpen) return null;

    const handleRunAI = async (selectedAction = action) => {
        setLoading(true);
        setAction(selectedAction);
        try {
            const res = await fetch(`${getBackendUrl()}/api/copilot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: selectedAction,
                    code,
                    language,
                    prompt,
                    roomId,
                    projectId,
                    userId
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Server error ${res.status}`);
            }
            const data = await res.json();
            if (data.success) {
                setResponse(data.result);
                toast.success("AI Copilot analysis ready!");
            } else {
                toast.error(data.error || "AI service error");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to connect to AI Copilot");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999
        }}>
            <div style={{
                backgroundColor: 'var(--bg-floating)',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--border-color)',
                width: '640px',
                maxWidth: '92vw',
                maxHeight: '85vh',
                boxShadow: 'var(--glass-shadow)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'var(--bg-card)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: 'var(--radius-btn)',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Bot size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', fontFamily: "'Outfit', sans-serif" }}>AI Copilot Intelligence</h3>
                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Automated analysis, code generation & security audit</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Quick Action Selector Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {[
                            { id: 'explain', label: 'Explain Code', icon: <Code2 size={14} /> },
                            { id: 'refactor', label: 'Refactor', icon: <Sparkles size={14} /> },
                            { id: 'fix', label: 'Audit & Fix', icon: <ShieldAlert size={14} /> },
                            { id: 'test', label: 'Unit Tests', icon: <CheckCircle size={14} /> }
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleRunAI(item.id)}
                                style={{
                                    padding: '10px',
                                    borderRadius: 'var(--radius-card)',
                                    border: action === item.id ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                                    backgroundColor: action === item.id ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-dark)',
                                    color: action === item.id ? 'var(--primary)' : 'var(--text-main)',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Custom Prompt Box */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ask AI Copilot to write or transform code..."
                            style={{
                                flex: 1,
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-btn)',
                                backgroundColor: 'var(--bg-dark)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                                fontSize: '13px',
                                outline: 'none'
                            }}
                        />
                        <button
                            onClick={() => handleRunAI("prompt")}
                            disabled={loading}
                            className="primary-action-btn"
                            style={{ padding: '10px 18px', fontSize: '13px', borderRadius: 'var(--radius-btn)' }}
                        >
                            {loading ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
                        </button>
                    </div>

                    {/* Results Container */}
                    {loading && (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block', color: 'var(--primary)' }} />
                            <span>AI Copilot is processing selection...</span>
                        </div>
                    )}

                    {response && !loading && (
                        <div style={{
                            backgroundColor: 'var(--bg-dark)',
                            borderRadius: 'var(--radius-card)',
                            border: '1px solid var(--border-color)',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>{response.title}</h4>
                                {(response.refactoredCode || response.fixedCode || response.generatedCode) && onApplyCode && (
                                    <button
                                        onClick={() => {
                                            const codeToApply = response.refactoredCode || response.fixedCode || response.generatedCode;
                                            onApplyCode(codeToApply);
                                            toast.success("Applied AI code to workspace!");
                                            onClose();
                                        }}
                                        className="primary-action-btn"
                                        style={{ padding: '4px 12px', fontSize: '11px', borderRadius: 'var(--radius-badge)' }}
                                    >
                                        Apply to Workspace
                                    </button>
                                )}
                            </div>

                            {response.explanation && (
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>{response.explanation}</p>
                            )}

                            {(response.refactoredCode || response.fixedCode || response.testCode || response.generatedCode) && (
                                <pre style={{
                                    backgroundColor: 'var(--bg-card)',
                                    padding: '12px',
                                    borderRadius: 'var(--radius-btn)',
                                    fontSize: '12px',
                                    color: 'var(--text-main)',
                                    overflowX: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    margin: 0,
                                    border: '1px solid var(--border-color)'
                                }}>
                                    {response.refactoredCode || response.fixedCode || response.testCode || response.generatedCode}
                                </pre>
                            )}

                            {response.summary && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{response.summary}</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AICopilotModal;
