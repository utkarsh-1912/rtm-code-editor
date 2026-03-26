import React, { useRef, useEffect, useState, useLayoutEffect, useCallback } from "react";
import {
    X, Eraser, Pencil, Trash2, Download, Square, Circle, Minus,
    Hand, Undo2, Redo2, ZoomIn, ZoomOut, Type
} from "lucide-react";
import toast from "react-hot-toast";
import ACTIONS from "../Action";

const generateId = () => Math.random().toString(36).substr(2, 9);

const WhiteboardModal = ({ isOpen, onClose, socketRef, roomId }) => {
    const canvasRef = useRef(null);
    const [elements, setElements] = useState([]);
    const [history, setHistory] = useState([[]]); 
    const [historyIndex, setHistoryIndex] = useState(0);
    const historyRef = useRef([[]]); 
    const historyIndexRef = useRef(0);

    const [tool, setTool] = useState("pencil");
    const [color, setColor] = useState("#3b82f6");
    const [brushSize, setBrushSize] = useState(3);

    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);

    const [isDrawing, setIsDrawing] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [currentElement, setCurrentElement] = useState(null);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const [cursors, setCursors] = useState({});
    const [remoteStreams, setRemoteStreams] = useState({});

    // Text tool state
    const [textInput, setTextInput] = useState({ active: false, x: 0, y: 0, value: "" });
    const textInputRef = useRef(null);

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

        const onCursor = ({ x, y, userName, socketId }) => {
            setCursors(prev => ({ ...prev, [socketId]: { x, y, userName } }));
        };

        const onDisconnected = ({ socketId }) => {
            setCursors(prev => { const next = { ...prev }; delete next[socketId]; return next; });
            setRemoteStreams(prev => { const next = { ...prev }; delete next[socketId]; return next; });
        };

        socket.on(ACTIONS.WHITEBOARD_SYNC, onSync);
        socket.on(ACTIONS.WHITEBOARD_DRAW, onDraw);
        socket.on(ACTIONS.WHITEBOARD_CURSOR, onCursor);
        socket.on(ACTIONS.DISCONNECTED, onDisconnected);

        return () => {
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
        if (el.type === 'text') {
            ctx.fillStyle = el.color;
            ctx.font = `${el.size * 4 + 8}px Inter, sans-serif`;
            ctx.fillText(el.text, el.x1, el.y1);
            return;
        }
        ctx.strokeStyle = el.color;
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

        const gridSize = 40;
        const startX = -pan.x / zoom, startY = -pan.y / zoom;
        const endX = startX + canvas.width / (zoom * window.devicePixelRatio), endY = startY + canvas.height / (zoom * window.devicePixelRatio);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) { ctx.moveTo(x, startY); ctx.lineTo(x, endY); }
        for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) { ctx.moveTo(startX, y); ctx.lineTo(endX, y); }
        ctx.stroke();

        elements.forEach(el => drawElement(ctx, el));
        Object.values(remoteStreams).forEach(el => drawElement(ctx, el));
        if (currentElement) drawElement(ctx, currentElement);
        ctx.restore();
    }, [elements, remoteStreams, currentElement, pan, zoom]); // eslint-disable-line

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
            rawX: clientX, rawY: clientY
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
            color: tool === 'eraser' ? 'rgba(255,255,255,1)' : color,
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
        const { x, y, rawX, rawY } = getPos(e);
        socketRef.current?.emit(ACTIONS.WHITEBOARD_CURSOR, { roomId, x: rawX, y: rawY, userName: socketRef.current.userName || "Guest", socketId: socketRef.current.id });
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

    const handleWheel = (e) => {
        e.preventDefault();
        if (e.ctrlKey) setZoom(prev => Math.min(Math.max(0.1, prev * (e.deltaY > 0 ? 0.9 : 1.1)), 5));
        else setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    };

    const clearCanvas = () => { commitAction([]); socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action: 'CLEAR' }); };
    const downloadImage = () => { const l = document.createElement("a"); l.download = "rtm-whiteboard.png"; l.href = canvasRef.current.toDataURL("image/png"); l.click(); toast.success("Exported!"); };

    if (!isOpen) return null;

    const COLORS = ["#ffffff", "#94a3b8", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

    const ToolBtn = ({ id, icon, label }) => (
        <button
            onClick={() => { setTool(id); if (textInput.active) commitTextInput(); }}
            title={label}
            style={{
                padding: isMobileUI ? "8px" : "10px",
                borderRadius: "10px", border: "none",
                backgroundColor: tool === id ? "rgba(59,130,246,0.25)" : "transparent",
                color: tool === id ? "#3b82f6" : "var(--text-muted)",
                cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0
            }}
        >
            {icon}
        </button>
    );

    const size = isMobileUI ? 18 : 20;

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.88)", zIndex: 2000,
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(12px)"
        }}>
            <div style={{
                width: isMobileUI ? "100vw" : "95vw",
                height: isMobileUI ? "100dvh" : "90vh",
                backgroundColor: "var(--bg-dark)",
                borderRadius: isMobileUI ? 0 : "24px",
                border: isMobileUI ? "none" : "1px solid rgba(255,255,255,0.1)",
                display: "flex", flexDirection: "column", overflow: "hidden",
                boxShadow: "0 35px 60px -15px rgba(0, 0, 0, 0.7)"
            }}>

                {/* ── Header / Toolbar ── */}
                <div style={{
                    backgroundColor: "rgba(255,255,255,0.02)",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    flexShrink: 0
                }}>
                    {/* Row 1: Title + zoom + close */}
                    <div style={{ padding: isMobileUI ? "10px 12px" : "12px 20px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "800", color: "var(--text-main)", letterSpacing: "0.06em", flex: 1 }}>WHITEBOARD</span>
                        <button onClick={handleUndo} disabled={historyIndex === 0} style={{ padding: "6px", borderRadius: "8px", border: "none", background: "rgba(255,255,255,0.05)", color: historyIndex === 0 ? "rgba(255,255,255,0.2)" : "var(--text-main)", cursor: historyIndex === 0 ? "not-allowed" : "pointer", display: "flex" }}>
                            <Undo2 size={16} />
                        </button>
                        <button onClick={handleRedo} disabled={historyIndex === history.length - 1} style={{ padding: "6px", borderRadius: "8px", border: "none", background: "rgba(255,255,255,0.05)", color: historyIndex === history.length - 1 ? "rgba(255,255,255,0.2)" : "var(--text-main)", cursor: historyIndex === history.length - 1 ? "not-allowed" : "pointer", display: "flex" }}>
                            <Redo2 size={16} />
                        </button>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "4px 8px" }}>
                            <ZoomOut size={13} style={{ cursor: "pointer", color: "var(--text-muted)" }} onClick={() => setZoom(z => Math.max(z / 1.2, 0.1))} />
                            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", minWidth: "32px", textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
                            <ZoomIn size={13} style={{ cursor: "pointer", color: "var(--text-muted)" }} onClick={() => setZoom(z => Math.min(z * 1.2, 5))} />
                        </div>
                        <button onClick={clearCanvas} title="Clear" style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444", cursor: "pointer", display: "flex" }}>
                            <Trash2 size={14} />
                        </button>
                        <button onClick={downloadImage} title="Export" style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "var(--text-main)", cursor: "pointer", display: "flex" }}>
                            <Download size={14} />
                        </button>
                        <button onClick={onClose} style={{ padding: "6px", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", marginLeft: "4px" }}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Row 2: Tools + colors + brush size */}
                    <div style={{
                        padding: isMobileUI ? "6px 10px 10px" : "0 20px 12px",
                        display: "flex", alignItems: "center", gap: "6px",
                        overflowX: "auto", flexWrap: "nowrap",
                        scrollbarWidth: "none"
                    }}>
                        {/* Tool group */}
                        <div style={{ display: "flex", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: "12px", padding: "3px", gap: "2px", flexShrink: 0 }}>
                            <ToolBtn id="hand"   icon={<Hand   size={size} />} label="Pan" />
                            <ToolBtn id="pencil" icon={<Pencil size={size} />} label="Pencil" />
                            <ToolBtn id="eraser" icon={<Eraser size={size} />} label="Eraser" />
                            <ToolBtn id="text"   icon={<Type   size={size} />} label="Text" />
                        </div>
                        <div style={{ width: "1px", height: "28px", backgroundColor: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                        <div style={{ display: "flex", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: "12px", padding: "3px", gap: "2px", flexShrink: 0 }}>
                            <ToolBtn id="square" icon={<Square size={size} />} label="Rectangle" />
                            <ToolBtn id="circle" icon={<Circle size={size} />} label="Circle" />
                            <ToolBtn id="line"   icon={<Minus  size={size} />} label="Line" />
                        </div>
                        <div style={{ width: "1px", height: "28px", backgroundColor: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                        {/* Colors */}
                        <div style={{ display: "flex", gap: "5px", alignItems: "center", flexShrink: 0 }}>
                            {COLORS.map(c => (
                                <button key={c} onClick={() => setColor(c)} style={{
                                    width: isMobileUI ? "18px" : "20px", height: isMobileUI ? "18px" : "20px",
                                    borderRadius: "50%", backgroundColor: c, cursor: "pointer",
                                    border: color === c ? "2px solid white" : "2px solid transparent",
                                    transform: color === c ? "scale(1.25)" : "scale(1)", transition: "all 0.15s",
                                    flexShrink: 0
                                }} />
                            ))}
                            {/* Custom color picker */}
                            <input type="color" value={color} onChange={e => setColor(e.target.value)}
                                style={{ width: isMobileUI ? "18px" : "22px", height: isMobileUI ? "18px" : "22px", border: "none", borderRadius: "50%", cursor: "pointer", padding: 0, backgroundColor: "transparent", flexShrink: 0 }}
                                title="Custom color"
                            />
                        </div>
                        <div style={{ width: "1px", height: "28px", backgroundColor: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                        {/* Brush size */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                            <div style={{ width: `${Math.max(4, brushSize * 2)}px`, height: `${Math.max(4, brushSize * 2)}px`, borderRadius: "50%", backgroundColor: color, border: "1px solid rgba(255,255,255,0.2)", transition: "all 0.15s", flexShrink: 0 }} />
                            <input type="range" min="1" max="25" value={brushSize}
                                onChange={e => setBrushSize(parseInt(e.target.value))}
                                style={{ width: isMobileUI ? "60px" : "80px", accentColor: "var(--primary)", cursor: "pointer" }}
                            />
                        </div>
                    </div>
                </div>

                {/* ── Canvas Area ── */}
                <div style={{ flex: 1, position: "relative", cursor: tool === "hand" || isPanning ? "grab" : tool === "text" ? "text" : "crosshair", overflow: "hidden", touchAction: "none" }}>
                    <canvas
                        ref={canvasRef}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onWheel={handleWheel}
                        style={{ position: "absolute", top: 0, left: 0, touchAction: "none" }}
                    />

                    {/* Text input overlay */}
                    {textInput.active && (() => {
                        const rect = canvasRef.current?.getBoundingClientRect();
                        const screenX = rect ? textInput.x * zoom + pan.x + rect.left : textInput.x;
                        const screenY = rect ? textInput.y * zoom + pan.y + rect.top : textInput.y;
                        return (
                            <input
                                ref={textInputRef}
                                value={textInput.value}
                                onChange={e => setTextInput(prev => ({ ...prev, value: e.target.value }))}
                                onKeyDown={e => { if (e.key === "Enter") commitTextInput(); if (e.key === "Escape") setTextInput({ active: false, x: 0, y: 0, value: "" }); }}
                                style={{
                                    position: "fixed",
                                    left: `${screenX}px`, top: `${screenY}px`,
                                    background: "rgba(0,0,0,0.5)",
                                    border: `1px dashed ${color}`,
                                    color: color, outline: "none",
                                    fontSize: `${brushSize * 4 + 8}px`,
                                    fontFamily: "Inter, sans-serif",
                                    padding: "2px 6px", borderRadius: "4px",
                                    minWidth: "80px", zIndex: 20,
                                    pointerEvents: "all"
                                }}
                                placeholder="Type then Enter…"
                            />
                        );
                    })()}

                    {/* Remote Cursors */}
                    {Object.entries(cursors).map(([id, cur]) => (
                        <div key={id} style={{ position: "absolute", left: cur.x, top: cur.y, pointerEvents: "none", zIndex: 10, transition: "top 0.08s, left 0.08s" }}>
                            <div style={{ border: "2px solid white", backgroundColor: "var(--primary)", borderRadius: "50%", width: "10px", height: "10px" }} />
                            <div style={{ backgroundColor: "var(--primary)", color: "white", padding: "2px 6px", borderRadius: "5px", fontSize: "10px", fontWeight: "700", marginTop: "3px", whiteSpace: "nowrap" }}>
                                {cur.userName || "Guest"}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Mobile hint ── */}
                {isMobileUI && (
                    <div style={{ padding: "6px 12px 10px", fontSize: "10px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
                        Pinch to zoom · Two fingers to pan · Press Esc to cancel text
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhiteboardModal;
