import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Icon from "./icons/Icon";
import { editorLanguage, languageForFile } from '../utils/languages';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { colabsDark, colabsLight, editorChrome } from '../utils/editorTheme';
import { Formatted } from './ProblemPane';
import toast from 'react-hot-toast';

const PRESETS = [25, 50, 90];
const SOUNDS = [
    { id: 'off', label: 'Off' },
    { id: 'rain', label: 'Rain' },
    { id: 'binaural', label: 'Alpha focus (10 Hz)' },
    { id: 'synth', label: 'Deep space drone' },
];
const read = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// Focus mode: the code full screen in the app's own theme, with what you need beside it — the
// problem, a task list, Run with input and output — plus a pomodoro timer and a soundscape.
// Panels open and close from the top bar; on phones they slide over the editor.
export default function FocusModeModal({
    isOpen,
    onClose,
    code = "",
    onCodeChange,
    language = "javascript",
    fileName = "main.js",
    files = [],
    activeFile = null,
    onFileSelect,
    isLightMode = false,
    problem = "",
    onRun,
    isExecuting = false,
    output = "",
    isError = false,
    stdin = "",
    setStdin,
}) {
    // Panels: which are open (remembered).
    const [panels, setPanels] = useState(() => read('focus-panels', { side: true, out: !!onRun }));
    const [sideTab, setSideTab] = useState(() => (problem ? 'problem' : 'tasks'));
    const togglePanel = (p) => setPanels((v) => { const next = { ...v, [p]: !v[p] }; write('focus-panels', next); return next; });
    useEffect(() => { if (isOpen && problem) setSideTab('problem'); }, [isOpen, problem]);

    // Goal and tasks.
    const [goal, setGoal] = useState(() => read('focus-goal', ''));
    const [tasks, setTasks] = useState(() => read('focus-tasks', []));
    const [newTask, setNewTask] = useState('');
    const saveTasks = (list) => { setTasks(list); write('focus-tasks', list); };
    const done = tasks.filter((t) => t.done).length;

    // Pomodoro timer.
    const [minutes, setMinutes] = useState(() => read('focus-minutes', 25));
    const [left, setLeft] = useState(minutes * 60);
    const [running, setRunning] = useState(false);
    const [focused, setFocused] = useState(() => read(`focus-today-${new Date().toDateString()}`, 0)); // seconds today
    useEffect(() => {
        if (!running) return undefined;
        const t = setInterval(() => {
            setLeft((s) => s - 1);
            setFocused((f) => { const n = f + 1; if (n % 15 === 0) write(`focus-today-${new Date().toDateString()}`, n); return n; });
        }, 1000);
        return () => clearInterval(t);
    }, [running]);
    useEffect(() => {
        if (running && left <= 0) {
            setRunning(false);
            setLeft(0);
            chime();
            toast.success('Focus block done. Take a short break.', { duration: 6000 });
        }
    }, [left, running]);
    const pickMinutes = (m) => { setMinutes(m); write('focus-minutes', m); setLeft(m * 60); setRunning(false); };

    // Soundscape (synthesised with Web Audio; nothing is downloaded).
    const [sound, setSound] = useState('off');
    const [volume, setVolume] = useState(0.35);
    const [soundOpen, setSoundOpen] = useState(false);
    const audioRef = useRef(null);
    const nodesRef = useRef([]);
    const stopSound = useCallback(() => {
        nodesRef.current.forEach((n) => { try { n.stop?.(); n.disconnect?.(); } catch { /* already stopped */ } });
        nodesRef.current = [];
    }, []);
    useEffect(() => {
        stopSound();
        if (sound === 'off' || !isOpen) return undefined;
        try {
            if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = audioRef.current;
            if (ctx.state === 'suspended') ctx.resume();
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(volume, ctx.currentTime);
            gain.connect(ctx.destination);
            if (sound === 'rain') {
                const size = 2 * ctx.sampleRate;
                const buf = ctx.createBuffer(1, size, ctx.sampleRate);
                const out = buf.getChannelData(0);
                let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
                for (let i = 0; i < size; i++) {
                    const w = Math.random() * 2 - 1;
                    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
                    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
                    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
                }
                const src = ctx.createBufferSource();
                src.buffer = buf; src.loop = true; src.connect(gain); src.start();
                nodesRef.current = [src, gain];
            } else if (sound === 'binaural') {
                const l = ctx.createOscillator(); const r = ctx.createOscillator(); const merge = ctx.createChannelMerger(2);
                l.frequency.setValueAtTime(200, ctx.currentTime); r.frequency.setValueAtTime(210, ctx.currentTime);
                l.connect(merge, 0, 0); r.connect(merge, 0, 1); merge.connect(gain); l.start(); r.start();
                nodesRef.current = [l, r, merge, gain];
            } else if (sound === 'synth') {
                const a = ctx.createOscillator(); const b = ctx.createOscillator(); const f = ctx.createBiquadFilter();
                a.type = 'sawtooth'; a.frequency.setValueAtTime(55, ctx.currentTime); b.frequency.setValueAtTime(110, ctx.currentTime);
                f.type = 'lowpass'; f.frequency.setValueAtTime(300, ctx.currentTime);
                a.connect(f); b.connect(f); f.connect(gain); a.start(); b.start();
                nodesRef.current = [a, b, f, gain];
            }
        } catch { /* audio not available */ }
        return stopSound;
    }, [sound, volume, isOpen, stopSound]);

    // Code.
    const [text, setText] = useState(code);
    useEffect(() => { setText(code); }, [code]);
    const change = (v) => { setText(v); onCodeChange?.(v); };
    const currentName = activeFile?.name || fileName;
    const lang = activeFile ? (languageForFile(activeFile.name) || language) : language;
    const extensions = useMemo(() => [editorLanguage(String(lang || '').toLowerCase()), editorChrome, EditorView.lineWrapping], [lang]);
    const stats = useMemo(() => ({ lines: text.split('\n').length, words: text.trim() ? text.trim().split(/\s+/).length : 0, chars: text.length }), [text]);
    const [fileOpen, setFileOpen] = useState(false);

    // Keys: Esc leaves (or closes a menu first), Ctrl/Cmd+Enter runs.
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') { if (soundOpen || fileOpen) { setSoundOpen(false); setFileOpen(false); } else onClose(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onRun && !isExecuting) { e.preventDefault(); onRun(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose, onRun, isExecuting, soundOpen, fileOpen]);
    useEffect(() => () => stopSound(), [stopSound]);

    if (!isOpen) return null;
    const pct = minutes ? Math.max(0, Math.min(1, 1 - left / (minutes * 60))) : 0;

    return (
        <div className="fz" role="dialog" aria-modal="true" aria-label="Focus mode">
            <header className="fz-top">
                <div className="fz-left">
                    <span className="fz-brand">Focus</span>
                    <span className="fz-file-wrap">
                        <button type="button" className="fz-file" onClick={() => files.length > 1 && setFileOpen((v) => !v)} aria-haspopup={files.length > 1 ? 'menu' : undefined} aria-expanded={fileOpen} disabled={files.length <= 1}>
                            <Icon name="file" size={14} /> <span className="u-ellipsis">{currentName}</span>{files.length > 1 && <Icon name="dropdown" size={12} />}
                        </button>
                        {fileOpen && (
                            <div className="u-pop fz-menu" role="menu">
                                {files.map((f) => (
                                    <button key={f.id || f.name} role="menuitem" className={f.name === currentName ? 'on' : ''} onClick={() => { setFileOpen(false); onFileSelect?.(f); }}>
                                        <Icon name="file" size={14} /> <span className="u-ellipsis">{f.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </span>
                    <input className="fz-goal" value={goal} onChange={(e) => { setGoal(e.target.value); write('focus-goal', e.target.value); }} placeholder="What are you working on?" maxLength={120} aria-label="Session goal" />
                </div>

                <div className="fz-right">
                    <div className={`fz-timer${running ? ' is-on' : ''}`} style={{ '--p': pct }}>
                        <span className="u-seg fz-presets" role="radiogroup" aria-label="Timer length">
                            {PRESETS.map((m) => <button key={m} type="button" role="radio" aria-checked={minutes === m} className={minutes === m ? 'on' : ''} onClick={() => pickMinutes(m)}>{m}</button>)}
                        </span>
                        <b aria-live="off">{clock(Math.max(0, left))}</b>
                        <button type="button" className="u-icon" onClick={() => { if (left <= 0) setLeft(minutes * 60); setRunning((v) => !v); }} aria-label={running ? 'Pause timer' : 'Start timer'} title={running ? 'Pause' : 'Start'}>
                            <Icon name={running ? 'pause' : 'run'} size={15} />
                        </button>
                        <button type="button" className="u-icon" onClick={() => { setRunning(false); setLeft(minutes * 60); }} aria-label="Reset timer" title="Reset"><Icon name="reset" size={15} /></button>
                    </div>

                    <span className="fz-pop-wrap">
                        <button type="button" className={`u-icon${sound !== 'off' ? ' on' : ''}`} onClick={() => setSoundOpen((v) => !v)} aria-label="Soundscape" aria-haspopup="menu" aria-expanded={soundOpen} title="Soundscape"><Icon name="music" size={17} /></button>
                        {soundOpen && (
                            <div className="u-pop fz-menu fz-sound" role="menu">
                                {SOUNDS.map((s) => (
                                    <button key={s.id} role="menuitemradio" aria-checked={sound === s.id} className={sound === s.id ? 'on' : ''} onClick={() => setSound(s.id)}>
                                        <span className={`fz-radio${sound === s.id ? ' on' : ''}`} /> {s.label}
                                    </button>
                                ))}
                                <label className="fz-volume">Volume
                                    <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
                                </label>
                            </div>
                        )}
                    </span>

                    <span className="fz-toggles">
                        <button type="button" className={`u-icon${panels.side ? ' on' : ''}`} onClick={() => togglePanel('side')} aria-pressed={!!panels.side} aria-label="Problem and tasks" title="Problem and tasks"><Icon name="problem" size={17} /></button>
                        {onRun && <button type="button" className={`u-icon${panels.out ? ' on' : ''}`} onClick={() => togglePanel('out')} aria-pressed={!!panels.out} aria-label="Input and output" title="Input and output"><Icon name="terminal" size={17} /></button>}
                    </span>
                    {onRun && (
                        <button type="button" className="u-btn u-btn--solid u-btn--sm fz-run" onClick={() => onRun()} disabled={isExecuting} title="Run (Ctrl Enter)">
                            <Icon name="run" size={14} /> {isExecuting ? 'Running…' : 'Run'}
                        </button>
                    )}
                    <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={onClose} title="Leave focus mode (Esc)"><Icon name="exit-full-screen" size={14} /> Exit</button>
                </div>
            </header>

            <div className={`fz-body${panels.side ? ' has-side' : ''}${panels.out && onRun ? ' has-out' : ''}`}>
                {panels.side && (
                    <aside className="fz-side" aria-label="Problem and tasks">
                        <div className="u-seg fz-tabs" role="tablist">
                            <button role="tab" aria-selected={sideTab === 'problem'} className={sideTab === 'problem' ? 'on' : ''} onClick={() => setSideTab('problem')}>Problem</button>
                            <button role="tab" aria-selected={sideTab === 'tasks'} className={sideTab === 'tasks' ? 'on' : ''} onClick={() => setSideTab('tasks')}>Tasks {tasks.length > 0 && <em>{done}/{tasks.length}</em>}</button>
                            <button type="button" className="fz-close" onClick={() => togglePanel('side')} aria-label="Close panel"><Icon name="close" size={13} /></button>
                        </div>
                        {sideTab === 'problem' ? (
                            <div className="fz-scroll pb-view">
                                {problem.trim() ? <Formatted text={problem} /> : <p className="fz-empty">No problem in this room yet. Add one in the Problem card, then come back.</p>}
                            </div>
                        ) : (
                            <div className="fz-scroll fz-tasks">
                                <span className="fz-progress" style={{ '--p': tasks.length ? done / tasks.length : 0 }} aria-hidden="true"><i /></span>
                                <form onSubmit={(e) => { e.preventDefault(); if (!newTask.trim()) return; saveTasks([...tasks, { id: Date.now(), text: newTask.trim(), done: false }]); setNewTask(''); }}>
                                    <input className="u-input" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a task and press Enter" maxLength={160} aria-label="New task" />
                                </form>
                                <ul>
                                    {tasks.map((t) => (
                                        <li key={t.id} className={t.done ? 'is-done' : ''}>
                                            <label><input type="checkbox" checked={t.done} onChange={() => saveTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} /> <span>{t.text}</span></label>
                                            <button type="button" className="ec-icon" onClick={() => saveTasks(tasks.filter((x) => x.id !== t.id))} aria-label={`Remove ${t.text}`}><Icon name="close" size={12} /></button>
                                        </li>
                                    ))}
                                    {!tasks.length && <li className="fz-empty">Break the session into small steps.</li>}
                                </ul>
                                {done > 0 && <button type="button" className="u-btn u-btn--quiet u-btn--sm" onClick={() => saveTasks(tasks.filter((t) => !t.done))}>Clear done</button>}
                            </div>
                        )}
                    </aside>
                )}

                <main className="fz-editor">
                    <CodeMirror
                        value={text}
                        height="100%"
                        theme={isLightMode ? colabsLight : colabsDark}
                        extensions={extensions}
                        onChange={change}
                        basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: false }}
                        style={{ height: '100%' }}
                        autoFocus
                    />
                </main>

                {panels.out && onRun && (
                    <aside className="fz-out" aria-label="Input and output">
                        <div className="fz-out-head"><span>Input</span><button type="button" className="fz-close" onClick={() => togglePanel('out')} aria-label="Close panel"><Icon name="close" size={13} /></button></div>
                        <textarea className="fz-stdin" value={stdin} onChange={(e) => setStdin?.(e.target.value)} placeholder="What your program reads from input" spellCheck={false} aria-label="Program input" />
                        <div className="fz-out-head"><span>Output</span>{output && <b className={isError ? 'io-bad' : 'io-ok'}>{isError ? 'error' : 'ok'}</b>}</div>
                        <pre className={`fz-console${isError ? ' is-error' : ''}`} aria-live="polite">{isExecuting ? 'Running…' : output || 'Press Run (Ctrl Enter).'}</pre>
                    </aside>
                )}
            </div>

            <footer className="fz-foot">
                <span>{stats.lines} lines · {stats.words} words · {stats.chars} chars</span>
                <span>Focused today: <b>{Math.floor(focused / 60)} min</b></span>
                <span className="fz-hint">Esc to leave{onRun ? ' · Ctrl Enter to run' : ''}</span>
            </footer>
        </div>
    );
}

function chime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 1.2);
    } catch { /* audio not available */ }
}
