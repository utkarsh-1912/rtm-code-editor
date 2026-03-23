import React, { useRef, useEffect, useState, useLayoutEffect, useCallback } from "react";
import {
    X, Eraser, Pencil, Trash2, Download, Square, Circle, Minus,
    Hand, Undo2, Redo2, ZoomIn, ZoomOut
} from "lucide-react";
import toast from "react-hot-toast";
import ACTIONS from "../Action";

const generateId = () => Math.random().toString(36).substr(2, 9);

const WhiteboardModal = ({ isOpen, onClose, socketRef, roomId }) => {
    const canvasRef = useRef(null);
    const [elements, setElements] = useState([]);
    const [history, setHistory] = useState([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);

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
    const [remoteStreams, setRemoteStreams] = useState({}); // Ongoing drawings from peers

    // --- Network Sync ---
    useEffect(() => {
        if (!isOpen || !socketRef.current) return;
        const socket = socketRef.current;

        const onDraw = ({ action, payload }) => {
            if (action === 'ADD') {
                setElements(prev => {
                    const newElements = [...prev, payload];
                    const newHistory = history.slice(0, historyIndex + 1);
                    newHistory.push(newElements);
                    setHistory(newHistory);
                    setHistoryIndex(newHistory.length - 1);
                    return newElements;
                });
            } else if (action === 'CLEAR') {
                setElements([]);
                setHistory([[]]);
                setHistoryIndex(0);
            } else if (action === 'STREAM') {
                setRemoteStreams(prev => ({ ...prev, [payload.socketId]: payload.element }));
            } else if (action === 'STREAM_END') {
                setRemoteStreams(prev => {
                    const next = { ...prev };
                    delete next[payload.socketId];
                    return next;
                });
            } else if (action === 'UNDO' || action === 'REDO') {
                // If we want collaborative undo, we must sync the entire elements array or use CRDTs.
                // For now, simpler to just sync ADD and CLEAR, and let Undo/Redo be local or sync full state.
                if (payload && payload.elements) {
                    setElements(payload.elements);
                    // Reset history to avoid complex conflict resolution
                    setHistory([payload.elements]);
                    setHistoryIndex(0);
                }
            }
        };

        const onCursor = ({ x, y, userName, socketId }) => {
            setCursors(prev => ({ ...prev, [socketId]: { x, y, userName } }));
        };

        const onDisconnected = ({ socketId }) => {
            setCursors(prev => {
                const next = { ...prev };
                delete next[socketId];
                return next;
            });
            setRemoteStreams(prev => {
                const next = { ...prev };
                delete next[socketId];
                return next;
            });
        };

        socket.on(ACTIONS.WHITEBOARD_DRAW, onDraw);
        socket.on(ACTIONS.WHITEBOARD_CURSOR, onCursor);
        socket.on(ACTIONS.DISCONNECTED, onDisconnected);

        return () => {
            socket.off(ACTIONS.WHITEBOARD_DRAW, onDraw);
            socket.off(ACTIONS.WHITEBOARD_CURSOR, onCursor);
            socket.off(ACTIONS.DISCONNECTED, onDisconnected);
        };
    }, [isOpen, socketRef, history, historyIndex]);

    // --- History Management ---
    const commitAction = useCallback((newElements) => {
        setElements(newElements);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newElements);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setElements(history[newIndex]);
            socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, {
                roomId, action: 'UNDO', payload: { elements: history[newIndex] }
            });
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setElements(history[newIndex]);
            socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, {
                roomId, action: 'REDO', payload: { elements: history[newIndex] }
            });
        }
    };

    // --- Resize Canvas ---
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
    }, [isOpen]);

    // --- Rendering Engine ---
    const drawElement = (ctx, el) => {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalCompositeOperation = el.type === 'eraser' ? 'destination-out' : 'source-over';

        ctx.beginPath();
        if (el.type === 'pencil' || el.type === 'eraser') {
            if (el.points.length > 0) {
                ctx.moveTo(el.points[0].x, el.points[0].y);
                for (let i = 1; i < el.points.length; i++) {
                    ctx.lineTo(el.points[i].x, el.points[i].y);
                }
            }
        } else if (el.type === 'line') {
            ctx.moveTo(el.x1, el.y1);
            ctx.lineTo(el.x2, el.y2);
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
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);

        // Grid Background for infinite canvas feel
        const gridSize = 40;
        const startX = -pan.x / zoom;
        const startY = -pan.y / zoom;
        const endX = startX + canvas.width / zoom;
        const endY = startY + canvas.height / zoom;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();

        // Draw saved elements
        elements.forEach(el => drawElement(ctx, el));

        // Draw remote streams
        Object.values(remoteStreams).forEach(el => drawElement(ctx, el));

        // Draw current active element
        if (currentElement) drawElement(ctx, currentElement);

        ctx.restore();
    }, [elements, remoteStreams, currentElement, pan, zoom]);

    useEffect(() => {
        renderCanvas();
    }, [renderCanvas]);

    // --- Mouse / Touch Handlers ---
    const getMousePos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left - pan.x) / zoom,
            y: (clientY - rect.top - pan.y) / zoom,
            rawX: clientX,
            rawY: clientY
        };
    };

    const handlePointerDown = (e) => {
        if (e.button === 1 || tool === 'hand') {
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX || e.touches[0].clientX, y: e.clientY || e.touches[0].clientY };
            return;
        }

        const { x, y } = getMousePos(e);
        setIsDrawing(true);

        const newElement = {
            id: generateId(),
            type: tool,
            color: tool === 'eraser' ? 'rgba(255,255,255,1)' : color,
            size: tool === 'eraser' ? brushSize * 3 : brushSize,
            points: [{ x, y }],
            x1: x, y1: y, x2: x, y2: y,
            socketId: socketRef.current?.id
        };
        setCurrentElement(newElement);
    };

    const handlePointerMove = (e) => {
        const { x, y, rawX, rawY } = getMousePos(e);

        // Sync cursor payload
        socketRef.current?.emit(ACTIONS.WHITEBOARD_CURSOR, {
            roomId, x: rawX, y: rawY, userName: socketRef.current.userName || "Guest", socketId: socketRef.current.id
        });

        if (isPanning) {
            const dx = (e.clientX || (e.touches && e.touches[0].clientX)) - lastMousePos.current.x;
            const dy = (e.clientY || (e.touches && e.touches[0].clientY)) - lastMousePos.current.y;
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastMousePos.current = { x: e.clientX || e.touches[0].clientX, y: e.clientY || e.touches[0].clientY };
            return;
        }

        if (!isDrawing || !currentElement) return;

        const updatedElement = { ...currentElement };
        if (tool === 'pencil' || tool === 'eraser') {
            updatedElement.points = [...updatedElement.points, { x, y }];
        } else {
            updatedElement.x2 = x;
            updatedElement.y2 = y;
        }

        // Shift modifier for perfect shapes
        if (e.shiftKey) {
            if (tool === 'square') {
                const size = Math.max(Math.abs(updatedElement.x2 - updatedElement.x1), Math.abs(updatedElement.y2 - updatedElement.y1));
                updatedElement.x2 = updatedElement.x1 + (updatedElement.x2 > updatedElement.x1 ? size : -size);
                updatedElement.y2 = updatedElement.y1 + (updatedElement.y2 > updatedElement.y1 ? size : -size);
            } else if (tool === 'line') {
                const dx = Math.abs(updatedElement.x2 - updatedElement.x1);
                const dy = Math.abs(updatedElement.y2 - updatedElement.y1);
                if (dx > dy) updatedElement.y2 = updatedElement.y1;
                else updatedElement.x2 = updatedElement.x1;
            }
        }

        setCurrentElement(updatedElement);
        socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, {
            roomId, action: 'STREAM', payload: { socketId: socketRef.current.id, element: updatedElement }
        });
    };

    const handlePointerUp = () => {
        setIsPanning(false);
        if (!isDrawing || !currentElement) return;

        setIsDrawing(false);
        commitAction([...elements, currentElement]);

        socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, {
            roomId, action: 'ADD', payload: currentElement
        });
        socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, {
            roomId, action: 'STREAM_END', payload: { socketId: socketRef.current.id }
        });

        setCurrentElement(null);
    };

    const handleWheel = (e) => {
        e.preventDefault();
        if (e.ctrlKey) {
            // Zoom
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(prev => Math.min(Math.max(0.1, prev * zoomDelta), 5));
        } else {
            // Pan
            setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
        }
    };

    const clearCanvas = () => {
        commitAction([]);
        socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action: 'CLEAR' });
    };

    const downloadImage = () => {
        const link = document.createElement("a");
        link.download = "rtm-whiteboard.png";
        link.href = canvasRef.current.toDataURL("image/png");
        link.click();
        toast.success("Design exported!");
    };

    if (!isOpen) return null;

    const ToolButton = ({ id, icon, label }) => (
        <button
            onClick={() => setTool(id)}
            title={label}
            style={{
                padding: "10px", borderRadius: "12px", border: "none",
                backgroundColor: tool === id ? "rgba(59, 130, 246, 0.2)" : "transparent",
                color: tool === id ? "#3b82f6" : "var(--text-muted)",
                cursor: "pointer", transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center"
            }}
            onMouseOver={(e) => { if (tool !== id) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)" }}
            onMouseOut={(e) => { if (tool !== id) e.currentTarget.style.backgroundColor = "transparent" }}
        >
            {icon}
        </button>
    );

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)", zIndex: 2000,
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(12px)"
        }}>
            <div style={{
                width: "95vw", height: "90vh", backgroundColor: "var(--bg-dark)",
                borderRadius: "24px", border: "1px solid rgba(255,255,255,0.1)",
                display: "flex", flexDirection: "column", overflow: "hidden",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.05), border-box, 0 35px 60px -15px rgba(0, 0, 0, 0.6)"
            }}>
                {/* Clean Header */}
                <div style={{
                    padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
                    backgroundColor: "rgba(255,255,255,0.02)", zIndex: 10
                }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={handleUndo} disabled={historyIndex === 0} style={{
                                padding: "8px", borderRadius: "8px", border: "none",
                                background: "rgba(255,255,255,0.05)",
                                color: historyIndex === 0 ? "rgba(255,255,255,0.2)" : "var(--text-main)", cursor: historyIndex === 0 ? "not-allowed" : "pointer"
                            }}>
                                <Undo2 size={16} />
                            </button>
                            <button onClick={handleRedo} disabled={historyIndex === history.length - 1} style={{
                                padding: "8px", borderRadius: "8px", border: "none",
                                background: "rgba(255,255,255,0.05)",
                                color: historyIndex === history.length - 1 ? "rgba(255,255,255,0.2)" : "var(--text-main)", cursor: historyIndex === history.length - 1 ? "not-allowed" : "pointer"
                            }}>
                                <Redo2 size={16} />
                            </button>
                        </div>
                        <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-main)", display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ZoomIn size={14} style={{ cursor: 'pointer' }} onClick={() => setZoom(z => Math.min(z * 1.2, 5))} />
                            {Math.round(zoom * 100)}%
                            <ZoomOut size={14} style={{ cursor: 'pointer' }} onClick={() => setZoom(z => Math.max(z / 1.2, 0.1))} />
                        </span>
                    </div>

                    {/* Apple Pad Style Floating Dock */}
                    <div style={{
                        display: "flex", gap: "4px", backgroundColor: "rgba(0,0,0,0.4)",
                        padding: "6px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)",
                        backdropFilter: "blur(20px)"
                    }}>
                        <ToolButton id="hand" icon={<Hand size={20} />} label="Pan Tool (Hold Space)" />
                        <div style={{ width: "1px", height: "30px", backgroundColor: "rgba(255,255,255,0.1)", margin: "auto 4px" }} />
                        <ToolButton id="pencil" icon={<Pencil size={20} />} label="Pencil" />
                        <ToolButton id="eraser" icon={<Eraser size={20} />} label="Eraser" />
                        <div style={{ width: "1px", height: "30px", backgroundColor: "rgba(255,255,255,0.1)", margin: "auto 4px" }} />
                        <ToolButton id="square" icon={<Square size={20} />} label="Rectangle (Hold Shift for Square)" />
                        <ToolButton id="circle" icon={<Circle size={20} />} label="Circle" />
                        <ToolButton id="line" icon={<Minus size={20} />} label="Straight Line (Hold Shift for rigid axis)" />
                    </div>

                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: "6px", padding: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                            {["#ffffff", "#94a3b8", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"].map((c) => (
                                <button
                                    key={c} onClick={() => setColor(c)}
                                    style={{
                                        width: "20px", height: "20px", borderRadius: "50%",
                                        backgroundColor: c, border: color === c ? "2px solid white" : "2px solid transparent",
                                        cursor: "pointer", transition: 'all 0.2s',
                                        transform: color === c ? 'scale(1.2)' : 'scale(1)'
                                    }}
                                />
                            ))}
                        </div>
                        <input
                            type="range" min="1" max="25" value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            style={{ width: "70px", accentColor: 'var(--primary)', cursor: "pointer" }}
                        />
                        <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />
                        <button onClick={clearCanvas} title="Clear Board" style={{
                            padding: "8px", borderRadius: "10px", border: "1px solid rgba(239, 68, 68, 0.2)",
                            backgroundColor: "rgba(239, 68, 68, 0.05)", color: "#ef4444", cursor: "pointer"
                        }}>
                            <Trash2 size={16} />
                        </button>
                        <button onClick={downloadImage} title="Export Image" style={{
                            padding: "8px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)",
                            backgroundColor: "rgba(255,255,255,0.05)", color: "var(--text-main)", cursor: "pointer"
                        }}>
                            <Download size={16} />
                        </button>
                        <button onClick={onClose} style={{ marginLeft: '12px', background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Canvas Area */}
                <div style={{
                    flex: 1, position: "relative", cursor: tool === "hand" || isPanning ? "grab" : "crosshair", overflow: "hidden"
                }}>
                    <canvas
                        ref={canvasRef}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onWheel={handleWheel}
                        style={{ position: "absolute", top: 0, left: 0, touchAction: "none" }}
                    />

                    {/* Remote Cursors tracking absolute position */}
                    {Object.entries(cursors).map(([id, cur]) => {
                        return (
                            <div key={id} style={{
                                position: "absolute", left: cur.x, top: cur.y,
                                pointerEvents: "none", zIndex: 10, transition: "top 0.1s, left 0.1s"
                            }}>
                                <div style={{ border: "2px solid white", backgroundColor: "var(--primary)", borderRadius: "50%", width: "12px", height: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }} />
                                <div style={{
                                    backgroundColor: "var(--primary)", color: "white", padding: "3px 8px", borderRadius: "6px",
                                    fontSize: "11px", fontWeight: "600", marginTop: "4px", whiteSpace: "nowrap", boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                                }}>
                                    {cur.userName}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default WhiteboardModal;
