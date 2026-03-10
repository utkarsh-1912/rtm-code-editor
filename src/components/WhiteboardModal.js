import React, { useRef, useEffect, useState } from "react";
import { X, Eraser, Pencil, Trash2, Download, Square, Circle, Minus } from "lucide-react";
import ACTIONS from "../Action";

const WhiteboardModal = ({ isOpen, onClose, socketRef, roomId }) => {
    const canvasRef = useRef(null);
    const topCanvasRef = useRef(null);
    const contextRef = useRef(null);
    const topContextRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState("pencil");
    const [color, setColor] = useState("#3b82f6");
    const [brushSize, setBrushSize] = useState(3);
    const [cursors, setCursors] = useState({}); // { socketId: { x, y, name } }

    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const lastPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!isOpen) return;

        const initCanvas = () => {
            const canvas = canvasRef.current;
            const topCanvas = topCanvasRef.current;
            if (!canvas || !topCanvas) return;

            const parent = canvas.parentElement;
            const width = parent.clientWidth;
            const height = parent.clientHeight;

            canvas.width = width * 2;
            canvas.height = height * 2;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            topCanvas.width = width * 2;
            topCanvas.height = height * 2;
            topCanvas.style.width = `${width}px`;
            topCanvas.style.height = `${height}px`;

            const ctx = canvas.getContext("2d");
            ctx.scale(2, 2);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            contextRef.current = ctx;

            const topCtx = topCanvas.getContext("2d");
            topCtx.scale(2, 2);
            topCtx.lineCap = "round";
            topCtx.lineJoin = "round";
            topContextRef.current = topCtx;
        };

        initCanvas();
        window.addEventListener("resize", initCanvas);

        const socket = socketRef.current;
        if (socket) {
            socket.on(ACTIONS.WHITEBOARD_DRAW, (data) => {
                drawFromSocket(data);
            });

            socket.on(ACTIONS.WHITEBOARD_CLEAR, () => {
                const ctx = contextRef.current;
                if (ctx) {
                    const canvas = canvasRef.current;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            });

            socket.on(ACTIONS.WHITEBOARD_CURSOR, ({ x, y, userName, socketId }) => {
                setCursors(prev => ({ ...prev, [socketId]: { x, y, userName } }));
            });

            socket.on(ACTIONS.DISCONNECTED, ({ socketId }) => {
                setCursors(prev => {
                    const next = { ...prev };
                    delete next[socketId];
                    return next;
                });
            });
        }

        return () => {
            window.removeEventListener("resize", initCanvas);
            if (socket) {
                socket.off(ACTIONS.WHITEBOARD_DRAW);
                socket.off(ACTIONS.WHITEBOARD_CLEAR);
                socket.off(ACTIONS.WHITEBOARD_CURSOR);
            }
        };
    }, [isOpen, socketRef]);

    // Update tool settings
    useEffect(() => {
        if (!contextRef.current || !topContextRef.current) return;

        const ctx = contextRef.current;
        const topCtx = topContextRef.current;

        if (tool === "eraser") {
            ctx.globalCompositeOperation = "destination-out";
            topCtx.globalCompositeOperation = "destination-out";
            ctx.lineWidth = brushSize * 2;
            topCtx.lineWidth = brushSize * 2;
        } else {
            ctx.globalCompositeOperation = "source-over";
            topCtx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = color;
            topCtx.strokeStyle = color;
            ctx.lineWidth = brushSize;
            topCtx.lineWidth = brushSize;
        }
    }, [color, tool, brushSize]);

    const getCoords = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        const { x, y } = getCoords(e);
        lastPos.current = { x, y };

        if (tool === "square" || tool === "circle" || tool === "line") {
            setStartPos({ x, y });
        } else {
            contextRef.current.beginPath();
            contextRef.current.moveTo(x, y);
        }
        setIsDrawing(true);
    };

    const draw = (e) => {
        const { x, y } = getCoords(e);

        // Emit cursor position
        socketRef.current?.emit(ACTIONS.WHITEBOARD_CURSOR, {
            roomId, x, y, userName: socketRef.current.userName || "Guest"
        });

        if (!isDrawing) return;

        if (tool === "square" || tool === "circle" || tool === "line") {
            const topCtx = topContextRef.current;
            topCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            topCtx.beginPath();
            if (tool === "square") {
                topCtx.rect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
            } else if (tool === "circle") {
                const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
                topCtx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
            } else if (tool === "line") {
                topCtx.moveTo(startPos.x, startPos.y);
                topCtx.lineTo(x, y);
            }
            topCtx.stroke();
        } else {
            contextRef.current.lineTo(x, y);
            contextRef.current.stroke();

            // Emit drawing data
            socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, {
                roomId,
                x, y,
                prevX: lastPos.current.x,
                prevY: lastPos.current.y,
                color: tool === "eraser" ? "white" : color,
                brushSize: tool === "eraser" ? brushSize * 2 : brushSize,
                tool
            });
            lastPos.current = { x, y };
        }
    };

    const stopDrawing = (e) => {
        if (!isDrawing) return;
        const { x, y } = getCoords(e);

        if (tool === "square" || tool === "circle" || tool === "line") {
            topContextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            const ctx = contextRef.current;
            ctx.beginPath();
            if (tool === "square") {
                ctx.rect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
            } else if (tool === "circle") {
                const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
                ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
            } else if (tool === "line") {
                ctx.moveTo(startPos.x, startPos.y);
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.closePath();

            // Emit shape data
            socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, {
                roomId,
                startPos,
                x, y,
                color,
                brushSize,
                tool
            });
        } else {
            contextRef.current.closePath();
        }
        setIsDrawing(false);
    };

    const handleTouchStart = (e) => {
        e.preventDefault();
        startDrawing(e.touches[0]);
    };

    const handleTouchMove = (e) => {
        e.preventDefault();
        draw(e.touches[0]);
    };

    const handleTouchEnd = (e) => {
        e.preventDefault();
        stopDrawing(e.changedTouches[0]);
    };

    const drawFromSocket = (data) => {
        const { tool, color, brushSize, x, y, prevX, prevY, startPos } = data;
        const ctx = contextRef.current;
        if (!ctx) return;

        // Save current style
        const oldGCO = ctx.globalCompositeOperation;
        const oldStroke = ctx.strokeStyle;
        const oldLineWidth = ctx.lineWidth;

        if (tool === "eraser") {
            ctx.globalCompositeOperation = "destination-out";
            ctx.lineWidth = brushSize;
        } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = color;
            ctx.lineWidth = brushSize;
        }

        ctx.beginPath();
        if (tool === "pencil" || tool === "eraser") {
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(x, y);
        } else if (tool === "square") {
            ctx.rect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
        } else if (tool === "circle") {
            const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
            ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        } else if (tool === "line") {
            ctx.moveTo(startPos.x, startPos.y);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.closePath();

        // Restore style
        ctx.globalCompositeOperation = oldGCO;
        ctx.strokeStyle = oldStroke;
        ctx.lineWidth = oldLineWidth;
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);
        socketRef.current?.emit(ACTIONS.WHITEBOARD_CLEAR, { roomId });
    };

    const downloadImage = () => {
        const link = document.createElement("a");
        link.download = "architecture-diagram.png";
        link.href = canvasRef.current.toDataURL();
        link.click();
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(8px)"
        }}>
            <div style={{
                width: "90vw",
                height: "85vh",
                backgroundColor: "var(--bg-card)",
                borderRadius: "24px",
                border: "1px solid var(--border-color)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
            }}>
                {/* Header */}
                <div style={{
                    padding: "16px 24px",
                    borderBottom: "1px solid var(--border-color)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "rgba(255,255,255,0.02)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ color: "var(--primary)" }}>
                            <Pencil size={20} />
                        </div>
                        <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Collaborative Whiteboard</h2>
                    </div>
                    <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Toolbar */}
                <div style={{
                    padding: "12px 24px",
                    borderBottom: "1px solid var(--border-color)",
                    display: "flex",
                    alignItems: "center",
                    gap: "20px",
                    backgroundColor: "rgba(255,255,255,0.01)",
                    flexWrap: "wrap"
                }}>
                    <div style={{ display: "flex", gap: "4px", backgroundColor: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "10px" }}>
                        {[
                            { id: "pencil", icon: <Pencil size={18} />, label: "Pencil" },
                            { id: "eraser", icon: <Eraser size={18} />, label: "Eraser" },
                            { id: "square", icon: <Square size={18} />, label: "Square" },
                            { id: "circle", icon: <Circle size={18} />, label: "Circle" },
                            { id: "line", icon: <Minus size={18} />, label: "Line" }
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setTool(t.id)}
                                title={t.label}
                                style={{
                                    padding: "8px",
                                    borderRadius: "8px",
                                    border: "none",
                                    backgroundColor: tool === t.id ? "var(--primary)" : "transparent",
                                    color: tool === t.id ? "white" : "var(--text-muted)",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            >
                                {t.icon}
                            </button>
                        ))}
                    </div>

                    <div style={{ height: "24px", width: "1px", backgroundColor: "var(--border-color)" }}></div>

                    <div style={{ display: "flex", gap: "8px" }}>
                        {["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#f8fafc"].map((c) => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                style={{
                                    width: "24px",
                                    height: "24px",
                                    borderRadius: "50%",
                                    backgroundColor: c,
                                    border: color === c ? "2px solid white" : "2px solid transparent",
                                    cursor: "pointer",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                                }}
                            />
                        ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Size</span>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            style={{ width: "80px", cursor: "pointer" }}
                        />
                    </div>

                    <div style={{ marginLeft: "auto", display: "flex", gap: "12px" }}>
                        <button
                            onClick={clearCanvas}
                            style={{
                                display: "flex", alignItems: "center", gap: "8px",
                                padding: "8px 16px", borderRadius: "10px", border: "1px solid rgba(239, 68, 68, 0.2)",
                                backgroundColor: "rgba(239, 68, 68, 0.05)", color: "#ef4444",
                                fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.15)"}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.05)"}
                        >
                            <Trash2 size={16} /> Clear
                        </button>
                        <button
                            onClick={downloadImage}
                            style={{
                                display: "flex", alignItems: "center", gap: "8px",
                                padding: "8px 16px", borderRadius: "10px", border: "1px solid var(--border-color)",
                                backgroundColor: "var(--secondary)", color: "var(--text-main)",
                                fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s"
                            }}
                        >
                            <Download size={16} /> Save Image
                        </button>
                    </div>
                </div>

                {/* Canvas Area */}
                <div style={{ flex: 1, position: "relative", backgroundColor: "var(--bg-dark)", overflow: "hidden" }}>
                    <canvas
                        ref={canvasRef}
                        style={{ position: "absolute", top: 0, left: 0 }}
                    />
                    <canvas
                        ref={topCanvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        style={{ position: "absolute", top: 0, left: 0, cursor: tool === "pencil" ? "crosshair" : tool === "eraser" ? "default" : "crosshair", touchAction: "none" }}
                    />

                    {/* Collaborative Cursors */}
                    {Object.entries(cursors).map(([id, cur]) => (
                        <div key={id} style={{
                            position: "absolute",
                            left: cur.x,
                            top: cur.y,
                            pointerEvents: "none",
                            zIndex: 10,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            transition: "all 0.1s linear"
                        }}>
                            <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "var(--primary)", border: "2px solid white", boxShadow: "0 0 5px rgba(0,0,0,0.5)" }} />
                            <div style={{
                                backgroundColor: "var(--primary)",
                                color: "white",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "10px",
                                fontWeight: "bold",
                                marginTop: "4px",
                                whiteSpace: "nowrap"
                            }}>
                                {cur.userName}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Info */}
                <div style={{ padding: "8px 24px", borderTop: "1px solid var(--border-color)", fontSize: "11px", color: "var(--text-muted)", backgroundColor: "rgba(0,0,0,0.1)" }}>
                    Real-time synchronization enabled. All participants can draw simultaneously.
                </div>
            </div>
        </div>
    );
};

export default WhiteboardModal;
