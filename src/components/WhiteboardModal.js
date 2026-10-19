import React, { useRef, useEffect, useState, useLayoutEffect, useCallback } from "react";
import {
    X, Eraser, Pencil, Trash2, Download, Square, Circle, Minus,
    Hand, Undo2, Redo2, ZoomIn, ZoomOut, Type
} from "lucide-react";
import toast from "react-hot-toast";
import ACTIONS from "../Action";
import { resolveTheme } from "../utils/theme";

const generateId = () => Math.random().toString(36).slice(2, 11);

// Shortcut keys match common whiteboard apps.
const TOOLS = [
    { id: "hand", key: "h", label: "Pan", Icon: Hand },
    { id: "pencil", key: "p", label: "Pen", Icon: Pencil },
    { id: "eraser", key: "e", label: "Eraser", Icon: Eraser },
    { id: "text", key: "t", label: "Text", Icon: Type },
    { id: "square", key: "r", label: "Rectangle", Icon: Square },
    { id: "circle", key: "o", label: "Ellipse", Icon: Circle },
    { id: "line", key: "l", label: "Line", Icon: Minus },
];
// "ink" is drawn in each viewer's own text colour, so it reads on dark and light boards.
const PALETTE = ["ink", "#F05252", "#F5B544", "#4ADE80", "#38BDF8", "#7AA2FF", "#A78BFA", "#F472B6"];
const inkColor = () => (resolveTheme() === "light" ? "#1B1A17" : "#F2F1EC");

const WhiteboardModal = ({ isOpen, onClose, socketRef, roomId }) => {
    const canvasRef = useRef(null);
    const [elements, setElements] = useState([]);
    const [history, setHistory] = useState([[]]); 
    const [historyIndex, setHistoryIndex] = useState(0);
    const historyRef = useRef([[]]); 
    const historyIndexRef = useRef(0);

    const [tool, setTool] = useState("pencil");
    const [color, setColor] = useState("ink");
    const [brushSize, setBrushSize] = useState(4);

    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);

    const [isDrawing, setIsDrawing] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [currentElement, setCurrentElement] = useState(null);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const lastCursorSent = useRef(0);

    const [cursors, setCursors] = useState({});
    const [remoteStreams, setRemoteStreams] = useState({});

    // Text tool state
    const [textInput, setTextInput] = useState({ active: false, x: 0, y: 0, value: "" });
    const textInputRef = useRef(null);

    // "ink" strokes follow the theme, so redraw when it changes.
    const [themeTick, setThemeTick] = useState(0);
    useEffect(() => {
        const bump = () => setThemeTick((t) => t + 1);
        window.addEventListener("app-theme-change", bump);
        return () => window.removeEventListener("app-theme-change", bump);
    }, []);

    const [isMobileUI, setIsMobileUI] = useState(window.innerWidth < 768);
    useEffect(() => {
        const onResize = () => setIsMobileUI(window.innerWidth < 768);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // --- Network Sync ---
    useEffect(() => {
        if (!isOpen || !socketRef.current) return;
        const socket = socketRef.current;

        socket.emit(ACTIONS.WHITEBOARD_SYNC_REQUEST, { roomId });

        const onSync = ({ elements: serverElements }) => {
            if (serverElements && serverElements.length > 0) {
                setElements(serverElements);
                const newHistory = [serverElements];
                setHistory(newHistory);
                setHistoryIndex(0);
                historyRef.current = newHistory;
                historyIndexRef.current = 0;
            }
        };

        const onDraw = ({ action, payload }) => {
            if (action === 'ADD') {
                setElements(prev => {
                    const newElements = [...prev, payload];
                    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
                    newHistory.push(newElements);
                    historyRef.current = newHistory;
                    historyIndexRef.current = newHistory.length - 1;
                    setHistory(newHistory);
                    setHistoryIndex(newHistory.length - 1);
                    return newElements;
                });
            } else if (action === 'CLEAR') {
                setElements([]);
                const reset = [[]];
                setHistory(reset);
                setHistoryIndex(0);
                historyRef.current = reset;
                historyIndexRef.current = 0;
            } else if (action === 'STREAM') {
                setRemoteStreams(prev => ({ ...prev, [payload.socketId]: payload.element }));
            } else if (action === 'STREAM_END') {
                setRemoteStreams(prev => {
                    const next = { ...prev };
                    delete next[payload.socketId];
                    return next;
                });
            } else if (action === 'UNDO' || action === 'REDO') {
                if (payload && payload.elements) {
                    setElements(payload.elements);
                    const newHistory = [payload.elements];
                    setHistory(newHistory);
                    setHistoryIndex(0);
                    historyRef.current = newHistory;
                    historyIndexRef.current = 0;
                }
            }
        };

        const onCursor = ({ x, y, userName, socketId, gone }) => {
            setCursors(prev => {
                const next = { ...prev };
                if (gone) delete next[socketId];
                else next[socketId] = { x, y, userName, ts: Date.now() };
                return next;
            });
        };
        // Drop cursors that stopped moving (closed the board, went idle).
        const prune = setInterval(() => setCursors(prev => {
            const now = Date.now();
            const live = Object.fromEntries(Object.entries(prev).filter(([, c]) => now - c.ts < 15000));
            return Object.keys(live).length === Object.keys(prev).length ? prev : live;
        }), 3000);

        const onDisconnected = ({ socketId }) => {
            setCursors(prev => { const next = { ...prev }; delete next[socketId]; return next; });
            setRemoteStreams(prev => { const next = { ...prev }; delete next[socketId]; return next; });
        };

        socket.on(ACTIONS.WHITEBOARD_SYNC, onSync);
        socket.on(ACTIONS.WHITEBOARD_DRAW, onDraw);
        socket.on(ACTIONS.WHITEBOARD_CURSOR, onCursor);
        socket.on(ACTIONS.DISCONNECTED, onDisconnected);

        return () => {
            clearInterval(prune);
            socket.emit(ACTIONS.WHITEBOARD_CURSOR, { roomId, gone: true });
            socket.off(ACTIONS.WHITEBOARD_SYNC, onSync);
            socket.off(ACTIONS.WHITEBOARD_DRAW, onDraw);
            socket.off(ACTIONS.WHITEBOARD_CURSOR, onCursor);
            socket.off(ACTIONS.DISCONNECTED, onDisconnected);
        };
    }, [isOpen, socketRef, roomId]);

    // --- History ---
    const commitAction = useCallback((newElements) => {
        setElements(newElements);
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push(newElements);
        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, []);

    const handleUndo = () => {
        if (historyIndexRef.current > 0) {
            const idx = historyIndexRef.current - 1;
            historyIndexRef.current = idx;
            setHistoryIndex(idx);
            setElements(historyRef.current[idx]);
            socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action: 'UNDO', payload: { elements: historyRef.current[idx] } });
        }
    };

    const handleRedo = () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            const idx = historyIndexRef.current + 1;
            historyIndexRef.current = idx;
            setHistoryIndex(idx);
            setElements(historyRef.current[idx]);
            socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action: 'REDO', payload: { elements: historyRef.current[idx] } });
        }
    };

    // --- Rendering ---
    const drawElement = (ctx, el) => {
        ctx.globalCompositeOperation = el.type === 'eraser' ? 'destination-out' : 'source-over';
        const paint = el.color === 'ink' ? inkColor() : el.color;
        if (el.type === 'text') {
            ctx.fillStyle = paint;
            ctx.font = `${el.size * 4 + 8}px Inter, sans-serif`;
            ctx.fillText(el.text, el.x1, el.y1);
            return;
        }
        ctx.strokeStyle = el.type === 'eraser' ? '#000' : paint;
        ctx.lineWidth = el.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        if (el.type === 'pencil' || el.type === 'eraser') {
            if (el.points.length > 0) {
                ctx.moveTo(el.points[0].x, el.points[0].y);
                for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
            }
        } else if (el.type === 'line') {
            ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2);
        } else if (el.type === 'square') {
            ctx.rect(el.x1, el.y1, el.x2 - el.x1, el.y2 - el.y1);
        } else if (el.type === 'circle') {
            const radius = Math.sqrt(Math.pow(el.x2 - el.x1, 2) + Math.pow(el.y2 - el.y1, 2));
            ctx.arc(el.x1, el.y1, radius, 0, 2 * Math.PI);
        }
        ctx.stroke();
    };

    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(pan.x * window.devicePixelRatio, pan.y * window.devicePixelRatio);
        ctx.scale(zoom * window.devicePixelRatio, zoom * window.devicePixelRatio);

        elements.forEach(el => drawElement(ctx, el));
        Object.values(remoteStreams).forEach(el => drawElement(ctx, el));
        if (currentElement) drawElement(ctx, currentElement);
        ctx.restore();
    }, [elements, remoteStreams, currentElement, pan, zoom, themeTick]); // eslint-disable-line

    useEffect(() => { renderCanvas(); }, [renderCanvas]);

    useLayoutEffect(() => {
        if (!isOpen) return;
        const canvas = canvasRef.current;
        const parent = canvas.parentElement;
        const resize = () => {
            canvas.width = parent.clientWidth * window.devicePixelRatio;
            canvas.height = parent.clientHeight * window.devicePixelRatio;
            canvas.style.width = `${parent.clientWidth}px`;
            canvas.style.height = `${parent.clientHeight}px`;
            renderCanvas();
        };
        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, [isOpen, renderCanvas]);

    // --- Text tool input focus ---
    useEffect(() => {
        if (textInput.active && textInputRef.current) textInputRef.current.focus();
    }, [textInput.active]);

    // --- Pointer handling ---
    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX : e.clientX;
        const clientY = e.touches ? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY : e.clientY;
        return {
            x: (clientX - rect.left - pan.x) / zoom,
            y: (clientY - rect.top - pan.y) / zoom,
                    };
    };

    const handlePointerDown = (e) => {
        if (textInput.active) {
            commitTextInput();
            return;
        }
        if (tool === 'text') {
            const { x, y } = getPos(e);
            setTextInput({ active: true, x, y, value: "" });
            return;
        }
        if (e.button === 1 || tool === 'hand') {
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX || e.touches?.[0]?.clientX, y: e.clientY || e.touches?.[0]?.clientY };
            return;
        }
        const { x, y } = getPos(e);
        setIsDrawing(true);
        const newElement = {
            id: generateId(), type: tool,
            color: tool === 'eraser' ? '#000' : color,
            size: tool === 'eraser' ? brushSize * 3 : brushSize,
            points: [{ x, y }], x1: x, y1: y, x2: x, y2: y,
            socketId: socketRef.current?.id
        };
        setCurrentElement(newElement);
    };

    const commitTextInput = () => {
        if (!textInput.value.trim()) { setTextInput({ active: false, x: 0, y: 0, value: "" }); return; }
        const el = {
            id: generateId(), type: 'text',
            text: textInput.value, color, size: brushSize,
            x1: textInput.x, y1: textInput.y,
            socketId: socketRef.current?.id
        };
        commitAction([...elements, el]);
        socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action: 'ADD', payload: el });
        setTextInput({ active: false, x: 0, y: 0, value: "" });
    };

    const handlePointerMove = (e) => {
        const { x, y } = getPos(e);
        // Board coordinates, so each viewer places the cursor with their own pan and zoom.
        const now = performance.now();
        if (now - lastCursorSent.current > 40) {
            lastCursorSent.current = now;
            socketRef.current?.emit(ACTIONS.WHITEBOARD_CURSOR, { roomId, x, y, userName: socketRef.current.userName || "Guest", socketId: socketRef.current.id });
        }
        if (isPanning) {
            const cx = e.clientX || e.touches?.[0]?.clientX;
            const cy = e.clientY || e.touches?.[0]?.clientY;
            const dx = cx - lastMousePos.current.x, dy = cy - lastMousePos.current.y;
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastMousePos.current = { x: cx, y: cy };
            return;
        }
        if (!isDrawing || !currentElement) return;
        const updated = { ...currentElement };
        if (tool === 'pencil' || tool === 'eraser') {
            updated.points = [...updated.points, { x, y }];
        } else {
            updated.x2 = x; updated.y2 = y;
        }
        if (e.shiftKey) {
            if (tool === 'square') { const s = Math.max(Math.abs(updated.x2 - updated.x1), Math.abs(updated.y2 - updated.y1)); updated.x2 = updated.x1 + (updated.x2 > updated.x1 ? s : -s); updated.y2 = updated.y1 + (updated.y2 > updated.y1 ? s : -s); }
            else if (tool === 'line') { const dx = Math.abs(updated.x2 - updated.x1), dy = Math.abs(updated.y2 - updated.y1); if (dx > dy) updated.y2 = updated.y1; else updated.x2 = updated.x1; }
        }
        setCurrentElement(updated);
        socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action: 'STREAM', payload: { socketId: socketRef.current.id, element: updated } });
    };

    const handlePointerUp = () => {
        setIsPanning(false);
        if (!isDrawing || !currentElement) return;
        setIsDrawing(false);
        commitAction([...elements, currentElement]);
        socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action: 'ADD', payload: currentElement });
        socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action: 'STREAM_END', payload: { socketId: socketRef.current.id } });
        setCurrentElement(null);
    };

    // Wheel: pan, Ctrl/pinch zooms around the pointer. Native listener so preventDefault works.
    const areaRef = useRef(null);
    useEffect(() => {
        const el = areaRef.current;
        if (!isOpen || !el) return undefined;
        const onWheel = (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const r = el.getBoundingClientRect();
                const px = e.clientX - r.left, py = e.clientY - r.top;
                setZoom((z) => {
                    const next = Math.min(Math.max(0.1, z * (e.deltaY > 0 ? 0.9 : 1.1)), 5);
                    setPan((p) => ({ x: px - ((px - p.x) / z) * next, y: py - ((py - p.y) / z) * next }));
                    return next;
                });
            } else {
                setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [isOpen]);

    const zoomBy = (factor) => {
        const el = areaRef.current;
        const cx = (el?.clientWidth || 0) / 2, cy = (el?.clientHeight || 0) / 2;
        setZoom((z) => {
            const next = Math.min(Math.max(0.1, z * factor), 5);
            setPan((p) => ({ x: cx - ((cx - p.x) / z) * next, y: cy - ((cy - p.y) / z) * next }));
            return next;
        });
    };
    const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    const [confirmClear, setConfirmClear] = useState(false);
    const clearCanvas = () => {
        commitAction([]);
        socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action: 'CLEAR' });
        setConfirmClear(false);
    };

    // Export on the board's own background so the PNG isn't transparent.
    const downloadImage = () => {
        const src = canvasRef.current;
        const out = document.createElement('canvas');
        out.width = src.width; out.height = src.height;
        const ctx = out.getContext('2d');
        ctx.fillStyle = getComputedStyle(areaRef.current).backgroundColor || '#111';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(src, 0, 0);
        const l = document.createElement('a');
        l.download = `whiteboard-${roomId}.png`;
        l.href = out.toDataURL('image/png');
        l.click();
        toast.success('Exported as PNG');
    };

    // Shortcuts (ignored while typing text on the board).
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => {
            if (textInput.active || /input|textarea|select/i.test(e.target.tagName)) return;
            const k = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) handleRedo(); else handleUndo(); return; }
            if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); handleRedo(); return; }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (k === 'escape') { onClose(); return; }
            const t = TOOLS.find((x) => x.key === k);
            if (t) setTool(t.id);
            if (k === '0') resetView();
            if (k === '=' || k === '+') zoomBy(1.2);
            if (k === '-') zoomBy(1 / 1.2);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    if (!isOpen) return null;

    const people = Object.keys(cursors).length + 1;
    const cursorColor = (id) => PALETTE[1 + (Math.abs([...String(id)].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) % (PALETTE.length - 1))];
    const grid = 24 * zoom;

    return (
        <div className="wb" role="dialog" aria-modal="true" aria-label="Whiteboard">
            <header className="wb-top">
                <strong>Whiteboard</strong>
                <span className="wb-meta">{people} {people === 1 ? 'person' : 'people'} · room {roomId}</span>
                <span className="wb-top-actions">
                    <button onClick={handleUndo} disabled={historyIndex === 0} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 size={16} /></button>
                    <button onClick={handleRedo} disabled={historyIndex === history.length - 1} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo2 size={16} /></button>
                    <span className="wb-sep" />
                    {confirmClear ? (
                        <span className="wb-confirm">
                            Clear for everyone?
                            <button className="wb-danger" onClick={clearCanvas}>Clear</button>
                            <button onClick={() => setConfirmClear(false)}>Cancel</button>
                        </span>
                    ) : (
                        <button onClick={() => setConfirmClear(true)} disabled={!elements.length} title="Clear the board" aria-label="Clear the board"><Trash2 size={16} /></button>
                    )}
                    <button onClick={downloadImage} title="Export PNG" aria-label="Export PNG"><Download size={16} /></button>
                    <button className="wb-close" onClick={onClose} title="Close (Esc)" aria-label="Close whiteboard"><X size={18} /></button>
                </span>
            </header>

            <div
                ref={areaRef}
                className={`wb-area wb-tool-${tool}${isPanning ? ' is-panning' : ''}`}
                style={{ backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
            >
                <canvas
                    ref={canvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                />

                {textInput.active && (
                    <input
                        ref={textInputRef}
                        className="wb-text"
                        value={textInput.value}
                        onChange={(e) => setTextInput((prev) => ({ ...prev, value: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitTextInput(); if (e.key === 'Escape') setTextInput({ active: false, x: 0, y: 0, value: '' }); }}
                        style={{ left: textInput.x * zoom + pan.x, top: textInput.y * zoom + pan.y - (brushSize * 4 + 8) * zoom, color, fontSize: (brushSize * 4 + 8) * zoom, borderColor: color }}
                        placeholder="Type, then Enter"
                    />
                )}

                {Object.entries(cursors).map(([id, cur]) => (
                    <div key={id} className="wb-cursor" style={{ left: cur.x * zoom + pan.x, top: cur.y * zoom + pan.y, '--c': cursorColor(id) }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1 1l5.5 13 2-5.5L14 6.5z" fill="var(--c)" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" /></svg>
                        {/* Re-mounted on every move (key), so the fade restarts while they draw. */}
                        <span key={cur.ts} className="wb-cursor-tag">{cur.userName || 'Guest'}</span>
                    </div>
                ))}

                {!elements.length && !currentElement && (
                    <div className="wb-empty">Draw, sketch an idea or circle a bug. Everyone in the room sees it live.</div>
                )}

                {/* Tools */}
                <div className="wb-dock" role="toolbar" aria-label="Tools">
                    {TOOLS.map((t, i) => (
                        <React.Fragment key={t.id}>
                            {(i === 1 || i === 4) && <span className="wb-sep" />}
                            <button
                                className={tool === t.id ? 'on' : ''}
                                onClick={() => { setTool(t.id); if (textInput.active) commitTextInput(); }}
                                title={`${t.label} (${t.key.toUpperCase()})`}
                                aria-label={t.label}
                                aria-pressed={tool === t.id}
                            >
                                <t.Icon size={18} />
                                {!isMobileUI && <kbd>{t.key.toUpperCase()}</kbd>}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* Style */}
                {tool !== 'hand' && (
                    <div className="wb-style" aria-label="Style">
                        <div className="wb-swatches">
                            {PALETTE.map((c, i) => (
                                <button key={c} className={color === c ? 'on' : ''} style={{ '--sw': i === 0 ? 'var(--wb-ink)' : c }} onClick={() => setColor(c)} aria-label={`Colour ${i === 0 ? 'ink' : c}`} disabled={tool === 'eraser'} />
                            ))}
                            <label className="wb-custom" title="Custom colour">
                                <input type="color" value={color.startsWith('#') ? color : '#7AA2FF'} onChange={(e) => setColor(e.target.value)} disabled={tool === 'eraser'} />
                            </label>
                        </div>
                        <div className="wb-size">
                            {[2, 4, 8, 14].map((s) => (
                                <button key={s} className={brushSize === s ? 'on' : ''} onClick={() => setBrushSize(s)} aria-label={`Size ${s}`} title={tool === 'text' ? `Text ${s * 4 + 8}px` : `${s}px`}>
                                    <i style={{ width: Math.min(16, s + 2), height: Math.min(16, s + 2) }} />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Zoom */}
                <div className="wb-zoom">
                    <button onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" title="Zoom out (-)"><ZoomOut size={15} /></button>
                    <button className="wb-pct" onClick={resetView} title="Reset view (0)">{Math.round(zoom * 100)}%</button>
                    <button onClick={() => zoomBy(1.2)} aria-label="Zoom in" title="Zoom in (+)"><ZoomIn size={15} /></button>
                </div>
            </div>
        </div>
    );
};

export default WhiteboardModal;
