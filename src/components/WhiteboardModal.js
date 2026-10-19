import React, { useRef, useEffect, useState, useLayoutEffect, useCallback, useMemo } from "react";
import {
    X, Eraser, Pencil, Trash2, Download, Square, Circle, Minus,
    Hand, Undo2, Redo2, ZoomIn, ZoomOut, Type, MousePointer2, Shapes, Spline, Copy
} from "lucide-react";
import {
    SHAPES, TEMPLATES, SHAPE_PREVIEW, makeNode, snap, nodeAt, connectorAt, onResizeHandle, labelPoint,
    drawNode, drawConnector, drawNodeOutline,
} from "./whiteboard/diagram";
import toast from "react-hot-toast";
import ACTIONS from "../Action";
import { resolveTheme } from "../utils/theme";

const generateId = () => Math.random().toString(36).slice(2, 11);

// Shortcut keys match common whiteboard apps.
const TOOLS = [
    { id: "select", key: "v", label: "Select & move", Icon: MousePointer2 },
    { id: "hand", key: "h", label: "Pan", Icon: Hand },
    { id: "shape", key: "s", label: "Shapes & system design", Icon: Shapes },
    { id: "connector", key: "a", label: "Connector (drag from shape to shape)", Icon: Spline },
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
const boardBg = () => (resolveTheme() === "light" ? "#FAFAF7" : "#111110");
const DIAGRAM_TOOLS = new Set(["select", "shape", "connector"]);
const byIdOf = (els) => Object.fromEntries(els.filter((e) => e.type === "node").map((e) => [e.id, e]));

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

    // --- Diagram state (flowcharts / system design) ---
    const [selectedId, setSelectedId] = useState(null);
    const [editing, setEditing] = useState(null); // { id, value } text of a node or connector label
    const [pick, setPick] = useState({ shape: "process", template: null }); // what the shape tool places
    const [connectStyle, setConnectStyle] = useState({ route: "straight", dashed: false, arrows: "end" });
    const [preview, setPreview] = useState(null); // connector being dragged: { from, pointer, target }
    const [palOpen, setPalOpen] = useState(false); // colour & size popover on the dock
    const [ctxPal, setCtxPal] = useState(false); // colour row in the selection toolbar
    const tinyStrokes = useRef([]); // { id, at } dots left by clicks with the pen (removed on double-click edit)
    const lastTap = useRef({ t: 0, x: 0, y: 0 }); // touch double-tap detection
    const dragRef = useRef(null); // { mode: move | resize | connect, ... }
    const lastUpdateSent = useRef(0);
    const elementsRef = useRef(elements);
    elementsRef.current = elements;
    const nodesById = useMemo(() => byIdOf(elements), [elements]);
    const selectedEl = elements.find((e) => e.id === selectedId) || null;

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
            } else if (action === 'UPDATE') {
                // Someone moved/resized/edited diagram elements. Drags arrive as "transient"
                // updates (no history entry); the final one is recorded.
                const changed = new Map((payload?.elements || []).map((e) => [e.id, e]));
                setElements(prev => {
                    const next = prev.map((e) => changed.get(e.id) || e);
                    if (!payload?.transient) {
                        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
                        newHistory.push(next);
                        historyRef.current = newHistory;
                        historyIndexRef.current = newHistory.length - 1;
                        setHistory(newHistory);
                        setHistoryIndex(newHistory.length - 1);
                    }
                    return next;
                });
            } else if (action === 'DELETE') {
                const gone = new Set(payload?.ids || []);
                setElements(prev => {
                    const next = prev.filter((e) => !gone.has(e.id));
                    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
                    newHistory.push(next);
                    historyRef.current = newHistory;
                    historyIndexRef.current = newHistory.length - 1;
                    setHistory(newHistory);
                    setHistoryIndex(newHistory.length - 1);
                    return next;
                });
                setSelectedId((id) => (gone.has(id) ? null : id));
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

    // --- Diagram edits (local + synced) ---
    const emitDraw = (action, payload) => socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action, payload });

    const addElements = (els) => {
        const next = [...elementsRef.current, ...els];
        elementsRef.current = next;
        commitAction(next);
        els.forEach((el) => emitDraw('ADD', { ...el, socketId: socketRef.current?.id }));
    };

    const applyUpdate = (changed) => {
        const map = new Map(changed.map((e) => [e.id, e]));
        const next = elementsRef.current.map((e) => map.get(e.id) || e);
        elementsRef.current = next;
        commitAction(next);
        emitDraw('UPDATE', { elements: changed });
    };

    // Deleting a node also deletes the connectors attached to it.
    const deleteIds = (ids) => {
        const gone = new Set(ids);
        elementsRef.current.forEach((e) => { if (e.type === 'connector' && (gone.has(e.from) || gone.has(e.to))) gone.add(e.id); });
        const next = elementsRef.current.filter((e) => !gone.has(e.id));
        elementsRef.current = next;
        commitAction(next);
        emitDraw('DELETE', { ids: [...gone] });
        setSelectedId(null);
    };

    const duplicateSelected = () => {
        if (selectedEl?.type !== 'node') return;
        const copy = { ...selectedEl, id: generateId(), x: snap(selectedEl.x + 24), y: snap(selectedEl.y + 24) };
        addElements([copy]);
        setSelectedId(copy.id);
    };

    const commitEdit = () => {
        if (!editing) return;
        const el = elementsRef.current.find((x) => x.id === editing.id);
        setEditing(null);
        if (!el) return;
        const field = el.type === 'connector' ? 'label' : 'text';
        const value = editing.value.trim() ? editing.value.replace(/\s+$/, '') : '';
        if ((el[field] || '') !== value) applyUpdate([{ ...el, [field]: value }]);
    };

    // Colour / connector style changes apply to the selection too.
    const chooseColor = (c) => {
        setColor(c);
        if (selectedEl && (selectedEl.type === 'node' || selectedEl.type === 'connector')) applyUpdate([{ ...selectedEl, color: c }]);
    };
    const chooseConnectStyle = (patch) => {
        setConnectStyle((st) => ({ ...st, ...patch }));
        if (selectedEl?.type === 'connector') applyUpdate([{ ...selectedEl, ...patch }]);
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

        const ink = inkColor(), bg = boardBg();
        const map = byIdOf(elements);
        // Connectors under shapes, then shapes and freehand in the order they were made.
        elements.forEach(el => {
            if (el.type === 'connector') drawConnector(ctx, el, map, { ink, bg, selected: el.id === selectedId, editing: editing?.id === el.id });
        });
        elements.forEach(el => {
            if (el.type === 'node') drawNode(ctx, el, { ink, editing: editing?.id === el.id });
            else if (el.type !== 'connector') drawElement(ctx, el);
        });
        Object.values(remoteStreams).forEach(el => drawElement(ctx, el));
        if (currentElement) drawElement(ctx, currentElement);
        if (preview) {
            drawConnector(ctx, { from: preview.from, to: null, ...connectStyle, color }, map, { ink, bg, pointer: preview.pointer });
            if (preview.target && map[preview.target]) drawNodeOutline(ctx, map[preview.target], zoom, { handle: false, accent: '#4ADE80' });
        }
        if (selectedId && map[selectedId]) drawNodeOutline(ctx, map[selectedId], zoom, { handle: !editing });
        ctx.restore();
    }, [elements, remoteStreams, currentElement, pan, zoom, themeTick, selectedId, editing, preview, connectStyle, color]); // eslint-disable-line

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

    // Keep receiving moves while dragging outside the canvas (some pointers can't be captured).
    const capturePointer = (e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ } };

    const handlePointerDown = (e) => {
        setPalOpen(false);
        if (e.pointerType === 'touch') {
            const now = performance.now();
            const prev = lastTap.current;
            lastTap.current = { t: now, x: e.clientX, y: e.clientY };
            if (now - prev.t < 320 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24) {
                lastTap.current = { t: 0, x: 0, y: 0 };
                handleDoubleClick(e);
                return;
            }
        }
        if (textInput.active) {
            commitTextInput();
            return;
        }
        if (editing) {
            commitEdit();
            return;
        }
        // Diagram tools: select / move / resize, place shapes, connect shapes.
        if (DIAGRAM_TOOLS.has(tool) && e.button !== 1) {
            const pos = getPos(e);
            const els = elementsRef.current;
            const map = byIdOf(els);
            if (tool === 'connector') {
                const from = nodeAt(els, pos.x, pos.y);
                if (from) {
                    dragRef.current = { mode: 'connect', from: from.id, target: null };
                    setPreview({ from: from.id, pointer: pos, target: null });
                    capturePointer(e);
                } else {
                    setSelectedId(connectorAt(els, map, pos.x, pos.y, 10 / zoom)?.id || null);
                }
                return;
            }
            const sel = map[selectedId];
            if (sel && onResizeHandle(sel, pos.x, pos.y, zoom)) {
                dragRef.current = { mode: 'resize', id: sel.id, start: pos, orig: { ...sel }, moved: false };
                capturePointer(e);
                return;
            }
            const hitNode = nodeAt(els, pos.x, pos.y);
            if (hitNode) {
                setSelectedId(hitNode.id);
                dragRef.current = { mode: 'move', id: hitNode.id, start: pos, orig: { ...hitNode }, moved: false };
                capturePointer(e);
                return;
            }
            const hitConn = connectorAt(els, map, pos.x, pos.y, 10 / zoom);
            if (hitConn) { setSelectedId(hitConn.id); return; }
            setSelectedId(null);
            if (tool === 'shape') {
                const node = makeNode({ shape: pick.shape, template: pick.template, x: pos.x, y: pos.y, color, id: generateId() });
                addElements([node]);
                setSelectedId(node.id);
                setEditing({ id: node.id, value: node.text || '' });
                return;
            }
            // Select tool on empty board: drag to pan.
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
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
        const drag = dragRef.current;
        if (drag) {
            if (drag.mode === 'connect') {
                const over = nodeAt(elementsRef.current, x, y);
                drag.target = over && over.id !== drag.from ? over.id : null;
                setPreview({ from: drag.from, pointer: { x, y }, target: drag.target });
                return;
            }
            const dx = x - drag.start.x, dy = y - drag.start.y;
            if (!drag.moved && Math.hypot(dx, dy) < 3 / zoom) return;
            drag.moved = true;
            const o = drag.orig;
            const moved = drag.mode === 'move'
                ? { ...o, x: snap(o.x + dx), y: snap(o.y + dy) }
                : { ...o, w: Math.max(48, snap(o.w + dx)), h: Math.max(36, snap(o.h + dy)) };
            const next = elementsRef.current.map((el) => (el.id === moved.id ? moved : el));
            elementsRef.current = next;
            setElements(next);
            const now = performance.now();
            if (now - lastUpdateSent.current > 50) {
                lastUpdateSent.current = now;
                emitDraw('UPDATE', { elements: [moved], transient: true });
            }
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
        const drag = dragRef.current;
        if (drag) {
            dragRef.current = null;
            if (drag.mode === 'connect') {
                setPreview(null);
                if (drag.target) {
                    const conn = { id: generateId(), type: 'connector', from: drag.from, to: drag.target, label: '', color, ...connectStyle };
                    addElements([conn]);
                    setSelectedId(conn.id);
                }
                return;
            }
            if (drag.moved) {
                const el = elementsRef.current.find((x) => x.id === drag.id);
                if (el) {
                    commitAction(elementsRef.current);
                    emitDraw('UPDATE', { elements: [el] });
                }
            }
            return;
        }
        if (!isDrawing || !currentElement) return;
        setIsDrawing(false);
        if (currentElement.type === 'pencil') {
            const pts = currentElement.points || [];
            const span = pts.length ? Math.max(...pts.map((pt) => Math.hypot(pt.x - pts[0].x, pt.y - pts[0].y))) : 0;
            if (span < 3) tinyStrokes.current = [...tinyStrokes.current.filter((t) => performance.now() - t.at < 800), { id: currentElement.id, at: performance.now() }];
        }
        commitAction([...elements, currentElement]);
        socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action: 'ADD', payload: currentElement });
        socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action: 'STREAM_END', payload: { socketId: socketRef.current.id } });
        setCurrentElement(null);
    };

    // Double-click: edit a shape's text or a connector's label; on empty board (select tool)
    // add a box.
    // Clicks with the pen leave dots; when those clicks turn out to be a double-click on a
    // shape, remove them.
    const dropClickDots = () => {
        const recent = tinyStrokes.current.filter((t) => performance.now() - t.at < 800).map((t) => t.id);
        tinyStrokes.current = [];
        const ids = recent.filter((id) => elementsRef.current.some((el) => el.id === id));
        if (ids.length) deleteIds(ids);
    };

    const startEdit = (el) => {
        setSelectedId(el.id);
        setCtxPal(false);
        setEditing({ id: el.id, value: (el.type === 'connector' ? el.label : el.text) || '' });
    };

    const handleDoubleClick = (e) => {
        const pos = getPos(e);
        const els = elementsRef.current;
        const n = nodeAt(els, pos.x, pos.y);
        if (n) { dropClickDots(); startEdit(n); return; }
        const c = connectorAt(els, byIdOf(els), pos.x, pos.y, 10 / zoom);
        if (c) { dropClickDots(); startEdit(c); return; }
        if (tool === 'select' || tool === 'shape') {
            const node = makeNode({ shape: pick.shape, template: pick.template, x: pos.x, y: pos.y, color, id: generateId() });
            addElements([node]);
            setSelectedId(node.id);
            setEditing({ id: node.id, value: node.text || '' });
        }
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
            if ((e.ctrlKey || e.metaKey) && k === 'd' && selectedEl?.type === 'node') { e.preventDefault(); duplicateSelected(); return; }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if ((k === 'delete' || k === 'backspace') && selectedEl) { e.preventDefault(); deleteIds([selectedEl.id]); return; }
            if (k === 'enter' && selectedEl && (selectedEl.type === 'node' || selectedEl.type === 'connector')) {
                e.preventDefault();
                setEditing({ id: selectedEl.id, value: (selectedEl.type === 'node' ? selectedEl.text : selectedEl.label) || '' });
                return;
            }
            if (k === 'escape') { if (selectedId) setSelectedId(null); else onClose(); return; }
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
                    onDoubleClick={handleDoubleClick}
                />

                {/* Editing a shape's text or a connector's label, in place. */}
                {editing && (() => {
                    const el = elements.find((x) => x.id === editing.id);
                    if (!el) return null;
                    let style;
                    if (el.type === 'node') {
                        const box = el.shape === 'actor' ? { x: el.x - 50, y: el.y + el.h + 2, w: el.w + 100, h: 44 } : el;
                        style = { left: box.x * zoom + pan.x, top: box.y * zoom + pan.y, width: box.w * zoom, height: box.h * zoom, fontSize: 13.5 * zoom };
                    } else {
                        const m = labelPoint(el, nodesById);
                        if (!m) return null;
                        style = { left: m.x * zoom + pan.x - 90, top: m.y * zoom + pan.y - 16, width: 180, height: 32, fontSize: 12.5 };
                    }
                    return (
                        <textarea
                            className={`wb-edit${el.type === 'connector' ? ' wb-edit--label' : ''}`}
                            style={style}
                            autoFocus
                            value={editing.value}
                            onChange={(e) => setEditing((ed) => ({ ...ed, value: e.target.value }))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                                if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
                            }}
                            onBlur={commitEdit}
                            onFocus={(e) => e.target.select()}
                            placeholder={el.type === 'connector' ? 'Label (e.g. HTTPS, async)' : 'Type, Enter to finish'}
                            aria-label={el.type === 'connector' ? 'Connector label' : 'Shape text'}
                        />
                    );
                })()}

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
                    <div className="wb-empty">Draw, sketch an idea, or build a flowchart or system design with shapes (S) and connectors (A). Everyone in the room sees it live.</div>
                )}

                {/* Tools */}
                <div className="wb-dock" role="toolbar" aria-label="Tools">
                    {TOOLS.map((t, i) => (
                        <React.Fragment key={t.id}>
                            {(i === 2 || i === 4 || i === 7) && <span className="wb-sep" />}
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
                    <span className="wb-sep" />
                    <span className="wb-colorpick">
                        <button className={`wb-chip wb-chip--dock${palOpen ? ' on' : ''}`} style={{ '--sw': color === 'ink' ? 'var(--wb-ink)' : color }} onClick={(e) => { e.stopPropagation(); setPalOpen((o) => !o); }} title="Colour & size" aria-label="Colour and size" aria-expanded={palOpen} disabled={tool === 'eraser'}>
                            <i />
                        </button>
                    </span>
                </div>
                {/* Colour & size popover: outside the dock so its scrolling (narrow screens) cannot clip it */}
                {palOpen && (
                    <div className="wb-pop" role="dialog" aria-label="Colour and size" onPointerDown={(e) => e.stopPropagation()}>
                        <div className="wb-swatches">
                            {PALETTE.map((c, i) => (
                                <button key={c} className={color === c ? 'on' : ''} style={{ '--sw': i === 0 ? 'var(--wb-ink)' : c }} onClick={() => { setColor(c); setPalOpen(false); }} aria-label={`Colour ${i === 0 ? 'ink' : c}`} />
                            ))}
                            <label className="wb-custom" title="Custom colour">
                                <input type="color" value={color.startsWith('#') ? color : '#7AA2FF'} onChange={(e) => setColor(e.target.value)} />
                            </label>
                        </div>
                        {!DIAGRAM_TOOLS.has(tool) && (
                            <div className="wb-size">
                                {[2, 4, 8, 14].map((sz) => (
                                    <button key={sz} className={brushSize === sz ? 'on' : ''} onClick={() => setBrushSize(sz)} aria-label={`Size ${sz}`} title={tool === 'text' ? `Text ${sz * 4 + 8}px` : `${sz}px`}>
                                        <i style={{ width: Math.min(16, sz + 2), height: Math.min(16, sz + 2) }} />
                                    </button>
                                ))}
                            </div>
                        )}
                        {tool === 'connector' && (
                            <div className="wb-conn">
                                <div className="wb-seg">
                                    <button className={connectStyle.route !== 'elbow' ? 'on' : ''} onClick={() => setConnectStyle((st) => ({ ...st, route: 'straight' }))}>Straight</button>
                                    <button className={connectStyle.route === 'elbow' ? 'on' : ''} onClick={() => setConnectStyle((st) => ({ ...st, route: 'elbow' }))}>Elbow</button>
                                </div>
                                <div className="wb-seg">
                                    <button className={!connectStyle.dashed ? 'on' : ''} onClick={() => setConnectStyle((st) => ({ ...st, dashed: false }))}>Solid</button>
                                    <button className={connectStyle.dashed ? 'on' : ''} onClick={() => setConnectStyle((st) => ({ ...st, dashed: true }))}>Dashed</button>
                                </div>
                            </div>
                        )}
                        <p className="wb-pop-tip">{DIAGRAM_TOOLS.has(tool) ? 'Used for new shapes and connectors. Select one to recolour it.' : 'Pen, shapes and text use this colour.'}</p>
                    </div>
                )}

                {/* Selection toolbar: floats just above the selected shape / connector */}
                {selectedEl && !editing && (selectedEl.type === 'node' || selectedEl.type === 'connector') && (() => {
                    const area = areaRef.current;
                    const aw = area?.clientWidth || 800;
                    let cx, top, bottom;
                    if (selectedEl.type === 'node') {
                        cx = (selectedEl.x + selectedEl.w / 2) * zoom + pan.x;
                        top = selectedEl.y * zoom + pan.y;
                        bottom = (selectedEl.y + selectedEl.h) * zoom + pan.y;
                    } else {
                        const m = labelPoint(selectedEl, nodesById);
                        if (!m) return null;
                        cx = m.x * zoom + pan.x;
                        top = m.y * zoom + pan.y - 14;
                        bottom = m.y * zoom + pan.y + 14;
                    }
                    const isConn = selectedEl.type === 'connector';
                    const width = isConn ? 300 : 196;
                    const y = top - 52 >= 8 ? top - 52 : bottom + 12;
                    const x = Math.max(8, Math.min(aw - width - 8, cx - width / 2));
                    const cur = selectedEl.color || 'ink';
                    return (
                        <div className="wb-ctx" style={{ left: x, top: y }} role="toolbar" aria-label={isConn ? 'Connector' : 'Shape'} onPointerDown={(e) => e.stopPropagation()}>
                            <span className="wb-ctx-pal">
                                <button className="wb-chip" style={{ '--sw': cur === 'ink' ? 'var(--wb-ink)' : cur }} onClick={() => setCtxPal((o) => !o)} title="Colour" aria-label="Colour" aria-expanded={ctxPal}><i /></button>
                                {ctxPal && (
                                    <span className="wb-ctx-swatches">
                                        {PALETTE.map((c, i) => (
                                            <button key={c} className={cur === c ? 'on' : ''} style={{ '--sw': i === 0 ? 'var(--wb-ink)' : c }} onClick={() => { chooseColor(c); setCtxPal(false); }} aria-label={`Colour ${i === 0 ? 'ink' : c}`} />
                                        ))}
                                    </span>
                                )}
                            </span>
                            {isConn && (
                                <>
                                    <span className="wb-ctx-sep" />
                                    <button className={selectedEl.route === 'elbow' ? 'on' : ''} onClick={() => chooseConnectStyle({ route: selectedEl.route === 'elbow' ? 'straight' : 'elbow' })} title={selectedEl.route === 'elbow' ? 'Elbow (click for straight)' : 'Straight (click for elbow)'} aria-label="Route">
                                        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d={selectedEl.route === 'elbow' ? 'M2 3h6v10h6' : 'M2 13L14 3'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </button>
                                    <button className={selectedEl.dashed ? 'on' : ''} onClick={() => chooseConnectStyle({ dashed: !selectedEl.dashed })} title={selectedEl.dashed ? 'Dashed (async)' : 'Solid'} aria-label="Line style">
                                        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray={selectedEl.dashed ? '2.5 2.5' : '0'} /></svg>
                                    </button>
                                    <button onClick={() => chooseConnectStyle({ arrows: ({ end: 'both', both: 'none', none: 'end' })[selectedEl.arrows || 'end'] })} title="Arrows: one way, both ways, none" aria-label="Arrows">
                                        <span className="wb-ctx-glyph">{({ end: '→', both: '↔', none: '—' })[selectedEl.arrows || 'end']}</span>
                                    </button>
                                </>
                            )}
                            <span className="wb-ctx-sep" />
                            <button onClick={() => startEdit(selectedEl)} title={isConn ? 'Edit label (Enter)' : 'Edit text (Enter)'} aria-label="Edit text"><Type size={15} /></button>
                            {!isConn && <button onClick={duplicateSelected} title="Duplicate (Ctrl+D)" aria-label="Duplicate"><Copy size={15} /></button>}
                            <button className="wb-ctx-del" onClick={() => deleteIds([selectedEl.id])} title="Delete (Del)" aria-label="Delete"><Trash2 size={15} /></button>
                        </div>
                    );
                })()}

                {/* Shape library: flowchart shapes and system-design blocks */}
                {tool === 'shape' && (
                    <div className="wb-lib" aria-label="Shapes">
                        <span className="wb-lib-h">Flowchart</span>
                        <div className="wb-lib-shapes">
                            {SHAPES.map((sh) => (
                                <button key={sh.id} className={!pick.template && pick.shape === sh.id ? 'on' : ''} onClick={() => setPick({ shape: sh.id, template: null })} title={sh.label} aria-label={sh.label}>
                                    <svg width="32" height="26" viewBox="0 0 32 26" aria-hidden="true"><path d={SHAPE_PREVIEW[sh.id]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /></svg>
                                    <span>{sh.label}</span>
                                </button>
                            ))}
                        </div>
                        <span className="wb-lib-h">System design</span>
                        <div className="wb-lib-blocks">
                            {TEMPLATES.map((t) => (
                                <button key={t.id} className={pick.template === t.id ? 'on' : ''} onClick={() => setPick({ shape: t.shape, template: t.id })} title={t.text}>
                                    <i style={{ background: t.color === 'ink' ? 'var(--wb-ink)' : t.color }} />
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <p className="wb-lib-tip">Click the board to place it. Connect shapes with the connector (A); double-click to edit text.</p>
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
