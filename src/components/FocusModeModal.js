import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Focus, 
    Play, 
    Pause, 
    RotateCcw, 
    X, 
    CheckCircle2, 
    Target,
    Clock,
    Zap,
    Music
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { html } from '@codemirror/lang-html';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { EditorView } from '@codemirror/view';
import toast from 'react-hot-toast';

export default function FocusModeModal({
    isOpen,
    onClose,
    code = "",
    onCodeChange,
    language = "javascript",
    fileName = "main.js",
    isLightMode = false
}) {
    // Focus Timer State
    const [timerMode, setTimerMode] = useState(25); // 25, 50, or custom
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    // Goal Tracker State
    const [goal, setGoal] = useState(() => localStorage.getItem('rtm_focus_goal') || 'Deep Work Session: Build core features');
    const [isGoalEditing, setIsGoalEditing] = useState(false);
    const [tasks, setTasks] = useState(() => {
        try {
            const saved = localStorage.getItem('rtm_focus_tasks');
            return saved ? JSON.parse(saved) : [
                { id: 1, text: 'Review implementation requirements', completed: false },
                { id: 2, text: 'Refactor complex logic', completed: false }
            ];
        } catch { return []; }
    });
    const [newTaskText, setNewTaskText] = useState('');

    // Audio Soundscape State (Web Audio API Synthesizer)
    const [soundMode, setSoundMode] = useState('off'); // 'off', 'rain', 'binaural', 'synth'
    const [volume, setVolume] = useState(0.4);
    const audioCtxRef = useRef(null);
    const soundNodesRef = useRef([]);

    // Audio Soundscape State (Web Audio API Synthesizer)

    // Code State
    const [focusCode, setFocusCode] = useState(code);

    useEffect(() => {
        setFocusCode(code);
    }, [code]);

    // Timer Countdown Effect
    useEffect(() => {
        let interval = null;
        if (isTimerRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && isTimerRunning) {
            setIsTimerRunning(false);
            playChimeSound();
            toast.success('🎉 Focus Session Completed! Time for a short break.', { duration: 6000 });
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, timeLeft]);

    // Handle Escape Key to exit Focus Mode
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Web Audio Soundscape Synthesizer
    useEffect(() => {
        if (soundMode === 'off') {
            stopSoundscape();
            return;
        }

        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }

            stopSoundscape();

            const ctx = audioCtxRef.current;
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(volume, ctx.currentTime);
            masterGain.connect(ctx.destination);

            if (soundMode === 'rain') {
                // Pink noise generator for rain sound
                const bufferSize = 2 * ctx.sampleRate;
                const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const output = noiseBuffer.getChannelData(0);
                let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    b0 = 0.99886 * b0 + white * 0.0555179;
                    b1 = 0.99332 * b1 + white * 0.0750759;
                    b2 = 0.96900 * b2 + white * 0.1538520;
                    b3 = 0.86650 * b3 + white * 0.3104856;
                    b4 = 0.55000 * b4 + white * 0.5329522;
                    b5 = -0.7616 * b5 - white * 0.0168980;
                    output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                    output[i] *= 0.11;
                    b6 = white * 0.115926;
                }
                const whiteNoise = ctx.createBufferSource();
                whiteNoise.buffer = noiseBuffer;
                whiteNoise.loop = true;
                whiteNoise.connect(masterGain);
                whiteNoise.start();
                soundNodesRef.current = [whiteNoise, masterGain];

            } else if (soundMode === 'binaural') {
                // 200Hz Left / 210Hz Right binaural beat (10Hz Alpha Focus Frequency)
                const oscLeft = ctx.createOscillator();
                const oscRight = ctx.createOscillator();
                const merger = ctx.createChannelMerger(2);

                oscLeft.type = 'sine';
                oscLeft.frequency.setValueAtTime(200, ctx.currentTime);
                oscLeft.connect(merger, 0, 0);

                oscRight.type = 'sine';
                oscRight.frequency.setValueAtTime(210, ctx.currentTime);
                oscRight.connect(merger, 0, 1);

                merger.connect(masterGain);
                oscLeft.start();
                oscRight.start();
                soundNodesRef.current = [oscLeft, oscRight, masterGain];

            } else if (soundMode === 'synth') {
                // Deep Space Ambient Drone
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                osc1.type = 'sawtooth';
                osc2.type = 'sine';
                osc1.frequency.setValueAtTime(55, ctx.currentTime); // A1
                osc2.frequency.setValueAtTime(110, ctx.currentTime); // A2

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(300, ctx.currentTime);

                osc1.connect(filter);
                osc2.connect(filter);
                filter.connect(masterGain);

                osc1.start();
                osc2.start();
                soundNodesRef.current = [osc1, osc2, filter, masterGain];
            }
        } catch (err) {
            console.error('Audio synthesizer error:', err);
        }

        return () => stopSoundscape();
    }, [soundMode, volume]);

    const stopSoundscape = () => {
        soundNodesRef.current.forEach(node => {
            try {
                if (node.stop) node.stop();
                if (node.disconnect) node.disconnect();
            } catch (e) {}
        });
        soundNodesRef.current = [];
    };

    const playChimeSound = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5); // A5
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 1.2);
        } catch (e) {}
    };

    const handleTimerModeChange = (minutes) => {
        setTimerMode(minutes);
        setTimeLeft(minutes * 60);
        setIsTimerRunning(false);
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleAddTask = (e) => {
        e.preventDefault();
        if (!newTaskText.trim()) return;
        const updated = [...tasks, { id: Date.now(), text: newTaskText.trim(), completed: false }];
        setTasks(updated);
        setNewTaskText('');
        localStorage.setItem('rtm_focus_tasks', JSON.stringify(updated));
    };

    const toggleTask = (id) => {
        const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        setTasks(updated);
        localStorage.setItem('rtm_focus_tasks', JSON.stringify(updated));
    };

    const handleEditorChange = (val) => {
        setFocusCode(val);
        if (onCodeChange) onCodeChange(val);
    };

    const stats = useMemo(() => {
        const text = focusCode || "";
        const lines = text.split('\n').length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        return { lines, words, chars };
    }, [focusCode]);

    const getLanguageExtension = (lang) => {
        switch (lang) {
            case "javascript": return javascript({ jsx: true });
            case "python": return python();
            case "cpp": return cpp();
            case "html": return html();
            default: return javascript();
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 7, 15, 0.95)',
            backdropFilter: 'blur(16px)',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            color: 'var(--text-main)',
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* Focus Top Bar */}
            <div style={{
                height: '56px',
                padding: '0 24px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#3b82f6'
                        }}>
                            <Focus size={18} />
                        </div>
                        <div>
                            <span style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '-0.02em', color: '#ffffff' }}>
                                FOCUS MODE
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                                {fileName}
                            </span>
                        </div>
                    </div>

                    {/* Goal Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <Target size={14} color="#3b82f6" />
                        {isGoalEditing ? (
                            <input
                                autoFocus
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                onBlur={() => {
                                    setIsGoalEditing(false);
                                    localStorage.setItem('rtm_focus_goal', goal);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsGoalEditing(false);
                                        localStorage.setItem('rtm_focus_goal', goal);
                                    }
                                }}
                                style={{
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '12px',
                                    outline: 'none',
                                    width: '280px'
                                }}
                            />
                        ) : (
                            <span 
                                onClick={() => setIsGoalEditing(true)}
                                title="Click to edit focus goal"
                                style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', cursor: 'pointer', fontWeight: '500' }}
                            >
                                {goal}
                            </span>
                        )}
                    </div>
                </div>

                {/* Focus Timer & Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* Timer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <Clock size={15} color={isTimerRunning ? '#10b981' : 'var(--text-muted)'} />
                        <span style={{ fontSize: '16px', fontWeight: '800', fontFamily: 'monospace', color: isTimerRunning ? '#10b981' : '#ffffff' }}>
                            {formatTime(timeLeft)}
                        </span>
                        <button
                            onClick={() => setIsTimerRunning(!isTimerRunning)}
                            style={{
                                backgroundColor: isTimerRunning ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                border: `1px solid ${isTimerRunning ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                                color: isTimerRunning ? '#ef4444' : '#10b981',
                                borderRadius: '50%',
                                width: '26px',
                                height: '26px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            {isTimerRunning ? <Pause size={12} /> : <Play size={12} style={{ marginLeft: '1px' }} />}
                        </button>
                        <button
                            onClick={() => { setTimeLeft(timerMode * 60); setIsTimerRunning(false); }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                        >
                            <RotateCcw size={13} />
                        </button>
                    </div>

                    {/* Timer presets */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {[25, 50].map(mins => (
                            <button
                                key={mins}
                                onClick={() => handleTimerModeChange(mins)}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    backgroundColor: timerMode === mins ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                    color: timerMode === mins ? '#ffffff' : 'var(--text-muted)',
                                    cursor: 'pointer'
                                }}
                            >
                                {mins}m
                            </button>
                        ))}
                    </div>

                    {/* Ambient Sound Generators */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '16px' }}>
                        <Music size={15} color="var(--text-muted)" />
                        <select
                            value={soundMode}
                            onChange={(e) => setSoundMode(e.target.value)}
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white',
                                fontSize: '11px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="off" style={{ background: '#1e293b' }}>Soundscape: Off</option>
                            <option value="rain" style={{ background: '#1e293b' }}>🌧️ Rain Noise</option>
                            <option value="binaural" style={{ background: '#1e293b' }}>🧠 10Hz Alpha Focus</option>
                            <option value="synth" style={{ background: '#1e293b' }}>🚀 Deep Space Synth</option>
                        </select>

                        {soundMode !== 'off' && (
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                style={{ width: '60px', accentColor: '#3b82f6', cursor: 'pointer' }}
                                title="Volume"
                            />
                        )}
                    </div>

                    {/* Exit Focus */}
                    <button
                        onClick={onClose}
                        title="Exit Focus Mode (ESC)"
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: 'white',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <X size={14} /> Exit
                    </button>
                </div>
            </div>

            {/* Main Focus Canvas */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Left Sidebar: Sprint Tasks */}
                <div style={{
                    width: '260px',
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                            Sprint Checklist
                        </span>
                        <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '700' }}>
                            {tasks.filter(t => t.completed).length} / {tasks.length} Done
                        </span>
                    </div>

                    <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '6px' }}>
                        <input
                            placeholder="Add sub-task..."
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            style={{
                                flex: 1,
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                outline: 'none'
                            }}
                        />
                    </form>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tasks.map(t => (
                            <div 
                                key={t.id}
                                onClick={() => toggleTask(t.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    backgroundColor: t.completed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                                    border: `1px solid ${t.completed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)'}`,
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    color: t.completed ? 'rgba(255,255,255,0.5)' : 'white',
                                    textDecoration: t.completed ? 'line-through' : 'none'
                                }}
                            >
                                <CheckCircle2 size={14} color={t.completed ? '#10b981' : 'var(--text-muted)'} />
                                <span style={{ flex: 1 }}>{t.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Central Code Editor */}
                <div style={{ flex: 1, height: '100%', backgroundColor: 'rgba(0,0,0,0.2)', position: 'relative' }}>
                    <CodeMirror
                        value={focusCode}
                        height="100%"
                        theme={isLightMode ? 'light' : dracula}
                        onChange={handleEditorChange}
                        basicSetup={{
                            lineNumbers: true,
                            indentOnInput: true,
                            bracketMatching: true,
                            closeBrackets: true,
                            autocompletion: true,
                            highlightActiveLine: true,
                            tabSize: 4
                        }}
                        style={{ height: '100%', fontSize: '16px' }}
                        extensions={[getLanguageExtension(language), EditorView.lineWrapping]}
                    />
                </div>
            </div>

            {/* Bottom Productivity Bar */}
            <div style={{
                height: '32px',
                padding: '0 24px',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--text-muted)'
            }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <span>Lines: <strong style={{ color: 'white' }}>{stats.lines}</strong></span>
                    <span>Words: <strong style={{ color: 'white' }}>{stats.words}</strong></span>
                    <span>Characters: <strong style={{ color: 'white' }}>{stats.chars}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={12} color="#10b981" />
                    <span>Distraction-Free Environment Active</span>
                </div>
            </div>
        </div>
    );
}
