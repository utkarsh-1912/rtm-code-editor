import React, { useState } from 'react';
import { Terminal, Play, ChevronUp, ChevronDown, Activity, Clock, Zap } from 'lucide-react';

function TerminalDrawer({
    isOpen = true,
    onToggle,
    output = "",
    isError = false,
    execTime = undefined,
    isExecuting = false,
    stdin = "",
    setStdin,
    onRunCode,
    isMobile = false
}) {
    const [activeTab, setActiveTab] = useState("output"); // "output" | "stdin" | "metrics"

    if (!isOpen) {
        return (
            <div style={{
                height: '32px',
                backgroundColor: 'var(--bg-card)',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                fontSize: '12px',
                color: 'var(--text-muted)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={onToggle}>
                    <Terminal size={14} color="var(--primary)" />
                    <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>Terminal Console</span>
                    {isExecuting && <span style={{ color: 'var(--primary)', fontSize: '11px' }}>Exec Running...</span>}
                </div>
                <button onClick={onToggle} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <ChevronUp size={14} />
                </button>
            </div>
        );
    }

    return (
        <div style={{
            height: isMobile ? '180px' : '220px',
            backgroundColor: 'var(--bg-dark)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Console Drawer Header */}
            <div style={{
                height: '36px',
                backgroundColor: 'var(--bg-card)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                userSelect: 'none'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {[
                        { id: 'output', label: 'Console Output', icon: <Terminal size={13} /> },
                        { id: 'stdin', label: 'Stdin Input', icon: <Zap size={13} /> },
                        { id: 'metrics', label: 'Telemetry & Time', icon: <Activity size={13} /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: 'var(--radius-badge)',
                                border: 'none',
                                backgroundColor: activeTab === tab.id ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                                fontSize: '11px',
                                fontWeight: activeTab === tab.id ? '700' : '500',
                                cursor: 'pointer'
                            }}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {execTime !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <Clock size={12} />
                            <span>{execTime}ms</span>
                        </div>
                    )}
                    {onRunCode && (
                        <button
                            onClick={onRunCode}
                            disabled={isExecuting}
                            className="primary-action-btn"
                            style={{
                                padding: '3px 10px',
                                fontSize: '11px',
                                borderRadius: 'var(--radius-badge)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <Play size={11} /> {isExecuting ? 'Running...' : 'Run Code'}
                        </button>
                    )}
                    <button onClick={onToggle} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <ChevronDown size={14} />
                    </button>
                </div>
            </div>

            {/* Console Drawer Body */}
            <div style={{ flex: 1, padding: '12px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px' }}>
                {activeTab === 'output' && (
                    <pre style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        color: isError ? '#f87171' : 'var(--text-main)'
                    }}>
                        {output || "// Output will appear here after execution..."}
                    </pre>
                )}

                {activeTab === 'stdin' && (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>PROGRAM INPUT (STDIN)</label>
                        <textarea
                            value={stdin || ""}
                            onChange={(e) => setStdin && setStdin(e.target.value)}
                            placeholder="Enter inputs line-by-line for standard input..."
                            style={{
                                flex: 1,
                                width: '100%',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-btn)',
                                color: 'var(--text-main)',
                                padding: '8px',
                                outline: 'none',
                                resize: 'none',
                                fontFamily: 'monospace'
                            }}
                        />
                    </div>
                )}

                {activeTab === 'metrics' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>EXECUTION TIME</div>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)', marginTop: '4px' }}>{execTime !== undefined ? `${execTime} ms` : 'N/A'}</div>
                        </div>
                        <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>RUNTIME STATUS</div>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: isError ? '#f87171' : '#10b981', marginTop: '4px' }}>
                                {isExecuting ? 'Running...' : isError ? 'Error Exit' : 'Success'}
                            </div>
                        </div>
                        <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>OUTPUT SIZE</div>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }}>{output ? `${output.length} bytes` : '0 bytes'}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TerminalDrawer;
