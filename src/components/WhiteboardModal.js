import React, { useRef, useEffect, useState } from "react";
import { X, Eraser, Pencil, Trash2, Download, Square, Circle, Minus } from "lucide-react";
import ACTIONS from "../Action";

const WhiteboardModal = ({ isOpen, onClose, socketRef, roomId }) => {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState("pencil"); // pencil, eraser, square, circle, line
    const [color, setColor] = useState("#3b82f6");
    const [brushSize, setBrushSize] = useState(3);

    // For shapes
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [tempCanvasData, setTempCanvasData] = useState(null);

    useEffect(() => {
        if (!isOpen) return;

        const canvas = canvasRef.current;
        // Set display size
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        // Set actual resolution
        canvas.width = canvas.offsetWidth * 2;
        canvas.height = canvas.offsetHeight * 2;

        const context = canvas.getContext("2d");
        context.scale(2, 2);
        context.lineCap = "round";
        context.strokeStyle = color;
        context.lineWidth = brushSize;
        contextRef.current = context;

        const socket = socketRef.current;
        // Socket listener for drawing
        if (socket) {
            socket.on(ACTIONS.WHITEBOARD_DRAW, (data) => {
                drawFromSocket(data);
            });

            socket.on(ACTIONS.WHITEBOARD_CLEAR, () => {
                const canvas = canvasRef.current;
                const context = canvas.getContext("2d");
                context.clearRect(0, 0, canvas.width, canvas.height);
            });
        }

        return () => {
            if (socket) {
                socket.off(ACTIONS.WHITEBOARD_DRAW);
                socket.off(ACTIONS.WHITEBOARD_CLEAR);
            }
        };
    }, [isOpen, color, brushSize, socketRef]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (contextRef.current) {
            contextRef.current.strokeStyle = tool === "eraser" ? "var(--bg-card)" : color;
            contextRef.current.lineWidth = brushSize;
        }
    }, [color, tool, brushSize]);

    const startDrawing = ({ nativeEvent }) => {
        const { offsetX, offsetY } = nativeEvent;

        if (tool === "square" || tool === "circle" || tool === "line") {
            setStartPos({ x: offsetX, y: offsetY });
            setTempCanvasData(contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
        } else {
            contextRef.current.beginPath();
            contextRef.current.moveTo(offsetX, offsetY);
        }
        setIsDrawing(true);
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = nativeEvent;

        if (tool === "square" || tool === "circle" || tool === "line") {
            // Restore canvas to before shape started
            contextRef.current.putImageData(tempCanvasData, 0, 0);

            contextRef.current.beginPath();
            if (tool === "square") {
                contextRef.current.rect(startPos.x, startPos.y, offsetX - startPos.x, offsetY - startPos.y);
            } else if (tool === "circle") {
                const radius = Math.sqrt(Math.pow(offsetX - startPos.x, 2) + Math.pow(offsetY - startPos.y, 2));
                contextRef.current.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
            } else if (tool === "line") {
                contextRef.current.moveTo(startPos.x, startPos.y);
                contextRef.current.lineTo(offsetX, offsetY);
            }
            contextRef.current.stroke();
        } else {
            contextRef.current.lineTo(offsetX, offsetY);
            contextRef.current.stroke();

            // Emit drawing data
            socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, {
                roomId,
                x: offsetX,
                y: offsetY,
                prevX: nativeEvent.movementX ? offsetX - nativeEvent.movementX : offsetX,
                prevY: nativeEvent.movementY ? offsetY - nativeEvent.movementY : offsetY,
                color: tool === "eraser" ? "var(--bg-card)" : color,
                brushSize,
                tool: "pencil"
            });
        }
    };

    const stopDrawing = ({ nativeEvent }) => {
        if (!isDrawing) return;

        if (tool === "square" || tool === "circle" || tool === "line") {
            const { offsetX, offsetY } = nativeEvent;
            // Emit shape data
            socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, {
                roomId,
                startPos,
                x: offsetX,
                y: offsetY,
                color,
                brushSize,
                tool
            });
        }

        contextRef.current.closePath();
        setIsDrawing(false);
    };

    const drawFromSocket = (data) => {
        const { tool, color, brushSize, x, y, prevX, prevY, startPos } = data;
        const ctx = contextRef.current;
        if (!ctx) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
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

        // Reset current local styles
        ctx.strokeStyle = tool === "eraser" ? "var(--bg-card)" : color;
        ctx.lineWidth = brushSize;
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
                <div style={{ flex: 1, position: "relative", backgroundColor: "var(--bg-dark)" }}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        style={{ cursor: tool === "pencil" ? "crosshair" : tool === "eraser" ? "default" : "crosshair" }}
                    />
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
