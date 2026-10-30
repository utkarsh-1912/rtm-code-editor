import React, { useRef, useEffect, useState, useLayoutEffect, useCallback, useMemo } from "react";
import {
    X, Eraser, Pencil, Trash2, Download, Square, Circle, Minus,
    Hand, Undo2, Redo2, ZoomIn, ZoomOut, Type, MousePointer2, Shapes, Spline, Copy,
    Play, Pause, RotateCcw, Gauge, ALargeSmall, Bold, AlignLeft, AlignCenter, AlignRight,
    AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
    AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
    AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter
} from "lucide-react";
import {
    SHAPES, TEMPLATES, SHAPE_PREVIEW, makeNode, snap, nodeAt, connectorAt, onResizeHandle, labelPoint,
    drawNode, drawConnector, drawNodeOutline, drawSimFooter, TEXT_SIZES, retypeNode,
} from "./whiteboard/diagram";
import { toTopology, simKind, isSimNode, isClient, hasCapacity, fieldsFor, typicalSim } from "./whiteboard/sim/topology";
import { explain, fmtRate, fmtMs } from "./whiteboard/sim/explain";
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

// Simulate mode. The load slider is logarithmic so 1–50 req/s is as easy to pick as 1k–5k.
const SIM_MAX_LOAD = 5000;
const SIM_FRAME = 500; // board ms between the snapshots everyone shows
const loadToPos = (v) => Math.round((Math.log10(Math.max(1, v)) / Math.log10(SIM_MAX_LOAD)) * 1000);
const posToLoad = (p) => Math.max(1, Math.round(10 ** ((p / 1000) * Math.log10(SIM_MAX_LOAD))));
const SIM_IDLE = { running: false, load: 200, seed: 1, elapsedMs: 0, at: 0 };

// The strip under a block while simulating; measured numbers only.
function simFooter(node, m) {
    if (isClient(node)) {
        if (!m) return null;
        const ok = Math.round((1 - m.errors) * 100);
        return { text: `${fmtRate(m.offered)}/s sent · ${ok}% ok · p99 ${fmtMs(m.p99)}`, level: m.errors >= 0.1 ? 2 : m.errors >= 0.01 ? 1 : 0 };
    }
    if (!hasCapacity(node)) return { text: "no capacity set", level: 0 };
    if (!m) return null;
    // A queue only holds messages (its busy % means nothing); its backlog is the number to watch.
    if (simKind(node) === 'queue') return { text: `${m.waiting} waiting · ${fmtRate(m.offered)}/s in`, level: m.shed > 0 ? 2 : 0 };
    return { text: `busy ${m.busy}% · p99 ${fmtMs(m.p99)} · ${m.waiting} waiting`, level: m.shed > 0 || m.busy >= 95 ? 2 : m.busy >= 80 ? 1 : 0 };
}

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

    // --- Simulate mode: only { running, load, seed } and the board clock are shared ---
    const [sim, setSim] = useState(SIM_IDLE); // at: performance.now() when elapsedMs was read
    const [loadDraft, setLoadDraft] = useState(null); // slider value before the room confirms it
    const [simSnap, setSimSnap] = useState(null);
    const [simCatchUp, setSimCatchUp] = useState(null); // { t, goal } while the engine replays
    const [textMenu, setTextMenu] = useState(false); // text size / weight / alignment popover
    const [shapeMenu, setShapeMenu] = useState(false); // change the selected shape's type
    const [group, setGroup] = useState([]); // ids of several selected shapes (shift-click or drag a box)
    const [marquee, setMarquee] = useState(null); // selection box being dragged: { x1, y1, x2, y2 }
    const [propsOpen, setPropsOpen] = useState(false); // Properties popover in the selection toolbar
    const [propsDraft, setPropsDraft] = useState({});
    const workerRef = useRef(null);
    const loadTimer = useRef(null);
    const simActive = sim.running || sim.elapsedMs > 0;
    const load = loadDraft ?? sim.load;
    const topologyJson = useMemo(() => (simActive ? JSON.stringify(toTopology(elements, sim.load)) : ""), [simActive, elements, sim.load]);

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

        const onSync = ({ elements: serverElements, sim: serverSim }) => {
            if (serverSim) setSim({ ...serverSim, at: performance.now() });
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
            } else if (action === 'SIM') {
                // The server echoes every change to the whole room, the sender included,
                // with the board clock as of sending.
                if (payload) setSim({ ...payload, at: performance.now() });
                setLoadDraft((d) => (d === payload?.load ? null : d));
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

    // --- Simulate mode ---
    const emitSim = (patch) => emitDraw('SIM', patch);
    const toggleSim = () => emitSim({ running: !sim.running });
    const resetSim = () => emitSim({ running: false, reset: true });
    const chooseLoad = (v) => {
        setLoadDraft(v);
        clearTimeout(loadTimer.current);
        loadTimer.current = setTimeout(() => emitSim({ load: v }), 150);
    };
    useEffect(() => () => clearTimeout(loadTimer.current), []);

    // One engine per client, in a worker, while the board is open and simulating.
    useEffect(() => {
        if (!isOpen || !simActive) { setSimSnap(null); setSimCatchUp(null); return undefined; }
        const worker = new Worker(new URL('./whiteboard/sim/sim.worker.js', import.meta.url));
        worker.onmessage = ({ data }) => {
            if (data.type === 'snapshot') { setSimSnap(data); setSimCatchUp(null); }
            else if (data.type === 'progress') setSimCatchUp(data);
        };
        workerRef.current = worker;
        return () => { worker.terminate(); workerRef.current = null; };
    }, [isOpen, simActive]);

    // New inputs (blocks, capacity, wiring, load or seed): the engine replays from zero.
    useEffect(() => {
        if (topologyJson) workerRef.current?.postMessage({ type: 'setup', topology: JSON.parse(topologyJson), seed: sim.seed });
    }, [topologyJson, sim.seed, simActive]);

    // Ask for the snapshot at the room's board time, in whole frames, so every client
    // shows the same frame.
    useEffect(() => {
        if (!simActive) return undefined;
        let last = -1;
        const tick = () => {
            const t = sim.running ? sim.elapsedMs + (performance.now() - sim.at) : sim.elapsedMs;
            const frame = Math.floor(t / SIM_FRAME) * SIM_FRAME;
            if (frame !== last) { last = frame; workerRef.current?.postMessage({ type: 'seek', t: frame }); }
        };
        tick();
        if (!sim.running) return undefined;
        const id = setInterval(tick, 50);
        return () => clearInterval(id);
    }, [simActive, sim, topologyJson]);

    // Capacity edits from the Properties popover; a block without capacity starts from typical values.
    const closeMenus = () => { setCtxPal(false); setPropsOpen(false); setTextMenu(false); setShapeMenu(false); };
    useEffect(() => { closeMenus(); setPropsDraft({}); if (selectedId) setGroup([]); }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Several shapes at once: align, distribute, move, delete ---
    const groupNodes = group.map((id) => nodesById[id]).filter(Boolean);
    const groupActive = groupNodes.length >= 2;
    // A group of one is just a selection.
    useEffect(() => {
        if (group.length === 1) { setSelectedId(group[0]); setGroup([]); }
    }, [group]);
    const boxOf = (ns) => {
        const minX = Math.min(...ns.map((n) => n.x)), minY = Math.min(...ns.map((n) => n.y));
        const maxX = Math.max(...ns.map((n) => n.x + n.w)), maxY = Math.max(...ns.map((n) => n.y + n.h));
        return { minX, minY, maxX, maxY };
    };
    const alignGroup = (how) => {
        if (!groupActive) return;
        const { minX, minY, maxX, maxY } = boxOf(groupNodes);
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        let changed;
        if (how === 'hspace' || how === 'vspace') {
            // Equal gaps between neighbours; the outermost shapes stay where they are.
            const h = how === 'hspace';
            const sorted = [...groupNodes].sort((a, b) => (h ? a.x + a.w / 2 - (b.x + b.w / 2) : a.y + a.h / 2 - (b.y + b.h / 2)));
            const used = sorted.reduce((sum, n) => sum + (h ? n.w : n.h), 0);
            const gap = ((h ? maxX - minX : maxY - minY) - used) / (sorted.length - 1);
            let at = h ? minX : minY;
            changed = sorted.map((n) => {
                const next = h ? { ...n, x: Math.round(at) } : { ...n, y: Math.round(at) };
                at += (h ? n.w : n.h) + gap;
                return next;
            });
        } else {
            const place = {
                left: () => ({ x: minX }), center: (n) => ({ x: Math.round(cx - n.w / 2) }), right: (n) => ({ x: maxX - n.w }),
                top: () => ({ y: minY }), middle: (n) => ({ y: Math.round(cy - n.h / 2) }), bottom: (n) => ({ y: maxY - n.h }),
            }[how];
            changed = groupNodes.map((n) => ({ ...n, ...place(n) }));
        }
        changed = changed.filter((n) => { const o = nodesById[n.id]; return o.x !== n.x || o.y !== n.y; });
        if (changed.length) applyUpdate(changed);
    };
    const deleteGroup = () => { deleteIds(group); setGroup([]); };
    const selectNodes = (ids) => {
        if (ids.length === 1) { setGroup([]); setSelectedId(ids[0]); }
        else { setSelectedId(null); setGroup(ids); }
    };

    // Swap the selected shape for another shape or block. Capacity only carries over to a
    // block the simulator treats the same way.
    const changeType = (choice) => {
        if (selectedEl?.type !== 'node') return;
        const next = retypeNode(selectedEl, choice);
        if (simKind(next) !== simKind(selectedEl)) delete next.sim;
        applyUpdate([next]);
        setShapeMenu(false);
    };
    const commitSim = (patch) => {
        const el = elementsRef.current.find((x) => x.id === selectedId);
        if (!el) return;
        const base = el.sim || (isClient(el) ? {} : typicalSim(el));
        applyUpdate([{ ...el, sim: { ...base, ...patch } }]);
    };
    const commitSimField = (f) => {
        const raw = propsDraft[f.key];
        setPropsDraft((d) => { const next = { ...d }; delete next[f.key]; return next; });
        if (raw === undefined || raw === '') return;
        const v = Number(raw);
        if (!Number.isFinite(v)) return;
        const clamped = Math.min(f.max, Math.max(f.min, f.step >= 1 ? Math.round(v) : v));
        if (selectedEl?.sim?.[f.key] !== clamped) commitSim({ [f.key]: clamped });
    };
    const clearSim = () => {
        if (!selectedEl) return;
        const { sim: _drop, ...rest } = selectedEl;
        applyUpdate([rest]);
        setPropsDraft({});
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
        const edgeRate = (el) => {
            const v = simSnap?.edges[el.id];
            return v === undefined ? null : `${fmtRate(v)}/s`;
        };
        elements.forEach(el => {
            if (el.type === 'connector') drawConnector(ctx, el, map, { ink, bg, selected: el.id === selectedId, editing: editing?.id === el.id, rate: edgeRate(el) });
        });
        elements.forEach(el => {
            if (el.type === 'node') drawNode(ctx, el, { ink, editing: editing?.id === el.id });
            else if (el.type !== 'connector') drawElement(ctx, el);
        });
        if (simSnap) {
            elements.forEach(el => {
                if (!isSimNode(el)) return;
                const footer = simFooter(el, simSnap.nodes[el.id]);
                if (footer) drawSimFooter(ctx, el, footer, { ink, bg });
            });
        }
        Object.values(remoteStreams).forEach(el => drawElement(ctx, el));
        if (currentElement) drawElement(ctx, currentElement);
        if (preview) {
            drawConnector(ctx, { from: preview.from, to: null, ...connectStyle, color }, map, { ink, bg, pointer: preview.pointer });
            if (preview.target && map[preview.target]) drawNodeOutline(ctx, map[preview.target], zoom, { handle: false, accent: '#4ADE80' });
        }
        if (selectedId && map[selectedId]) drawNodeOutline(ctx, map[selectedId], zoom, { handle: !editing });
        group.forEach((id) => { if (map[id]) drawNodeOutline(ctx, map[id], zoom, { handle: false }); });
        if (marquee) {
            ctx.save();
            ctx.fillStyle = 'rgba(122,162,255,0.10)';
            ctx.strokeStyle = '#7AA2FF';
            ctx.lineWidth = 1 / zoom;
            const mx = Math.min(marquee.x1, marquee.x2), my = Math.min(marquee.y1, marquee.y2);
            const mw = Math.abs(marquee.x2 - marquee.x1), mh = Math.abs(marquee.y2 - marquee.y1);
            ctx.fillRect(mx, my, mw, mh);
            ctx.strokeRect(mx, my, mw, mh);
            ctx.restore();
        }
        ctx.restore();
    }, [elements, remoteStreams, currentElement, pan, zoom, themeTick, selectedId, editing, preview, connectStyle, color, simSnap, group, marquee]); // eslint-disable-line

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
            const shift = e.shiftKey;
            const under = nodeAt(els, pos.x, pos.y);
            if (groupActive) {
                if (under && shift) { setGroup((g) => (g.includes(under.id) ? g.filter((id) => id !== under.id) : [...g, under.id])); return; }
                if (under && group.includes(under.id)) {
                    dragRef.current = { mode: 'group', start: pos, origs: groupNodes.map((n) => ({ ...n })), moved: false };
                    capturePointer(e);
                    return;
                }
                setGroup([]);
            }
            // Shift-click a second shape: select both.
            if (shift && under && tool === 'select' && map[selectedId] && selectedId !== under.id) {
                selectNodes([selectedId, under.id]);
                return;
            }
            const sel = map[selectedId];
            const corner = sel?.type === 'node' && onResizeHandle(sel, pos.x, pos.y, zoom);
            if (corner) {
                dragRef.current = { mode: 'resize', corner, id: sel.id, start: pos, orig: { ...sel }, moved: false };
                capturePointer(e);
                return;
            }
            if (under) {
                setSelectedId(under.id);
                dragRef.current = { mode: 'move', id: under.id, start: pos, orig: { ...under }, moved: false };
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
            // Select tool on empty board: drag a box to select shapes (touch drags pan).
            if (e.pointerType !== 'touch') {
                dragRef.current = { mode: 'marquee', start: pos };
                setMarquee({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
                capturePointer(e);
                return;
            }
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
        // Resize cursor over a selected shape's corner handles.
        if (!drag && canvasRef.current && DIAGRAM_TOOLS.has(tool)) {
            const sel = selectedEl?.type === 'node' ? selectedEl : null;
            const corner = sel && !editing && onResizeHandle(sel, x, y, zoom);
            canvasRef.current.style.cursor = corner ? (corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize') : '';
        }
        if (drag) {
            if (drag.mode === 'connect') {
                const over = nodeAt(elementsRef.current, x, y);
                drag.target = over && over.id !== drag.from ? over.id : null;
                setPreview({ from: drag.from, pointer: { x, y }, target: drag.target });
                return;
            }
            if (drag.mode === 'marquee') {
                setMarquee({ x1: drag.start.x, y1: drag.start.y, x2: x, y2: y });
                return;
            }
            const dx = x - drag.start.x, dy = y - drag.start.y;
            if (!drag.moved && Math.hypot(dx, dy) < 3 / zoom) return;
            drag.moved = true;
            if (drag.mode === 'group') {
                const moved = new Map(drag.origs.map((o) => [o.id, { ...o, x: snap(o.x + dx), y: snap(o.y + dy) }]));
                const next = elementsRef.current.map((el) => moved.get(el.id) || el);
                elementsRef.current = next;
                setElements(next);
                const now = performance.now();
                if (now - lastUpdateSent.current > 50) {
                    lastUpdateSent.current = now;
                    emitDraw('UPDATE', { elements: [...moved.values()], transient: true });
                }
                return;
            }
            const o = drag.orig;
            let moved;
            if (drag.mode === 'move') moved = { ...o, x: snap(o.x + dx), y: snap(o.y + dy) };
            else {
                // Resize from the grabbed corner; the opposite corner stays put.
                const c = drag.corner;
                const w = Math.max(48, snap(c.includes('e') ? o.w + dx : o.w - dx));
                const h = Math.max(36, snap(c.includes('s') ? o.h + dy : o.h - dy));
                moved = { ...o, w, h, x: c.includes('w') ? o.x + o.w - w : o.x, y: c.includes('n') ? o.y + o.h - h : o.y };
            }
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
            if (drag.mode === 'marquee') {
                setMarquee(null);
                if (!marquee) return;
                // Every shape the box touches.
                const l = Math.min(marquee.x1, marquee.x2), r = Math.max(marquee.x1, marquee.x2);
                const t = Math.min(marquee.y1, marquee.y2), b = Math.max(marquee.y1, marquee.y2);
                if (r - l < 4 / zoom && b - t < 4 / zoom) return;
                const ids = elementsRef.current.filter((n) => n.type === 'node' && n.x < r && n.x + n.w > l && n.y < b && n.y + n.h > t).map((n) => n.id);
                if (ids.length) selectNodes(ids);
                return;
            }
            if (drag.mode === 'group') {
                if (drag.moved) {
                    const ids = new Set(drag.origs.map((o) => o.id));
                    commitAction(elementsRef.current);
                    emitDraw('UPDATE', { elements: elementsRef.current.filter((el) => ids.has(el.id)) });
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
            if ((e.ctrlKey || e.metaKey) && k === 'a') {
                const ids = elementsRef.current.filter((el) => el.type === 'node').map((el) => el.id);
                if (ids.length) { e.preventDefault(); selectNodes(ids); }
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if ((k === 'delete' || k === 'backspace') && groupActive) { e.preventDefault(); deleteGroup(); return; }
            if ((k === 'delete' || k === 'backspace') && selectedEl) { e.preventDefault(); deleteIds([selectedEl.id]); return; }
            if (k === 'enter' && selectedEl && (selectedEl.type === 'node' || selectedEl.type === 'connector')) {
                e.preventDefault();
                setEditing({ id: selectedEl.id, value: (selectedEl.type === 'node' ? selectedEl.text : selectedEl.label) || '' });
                return;
            }
            if (k === 'escape') { if (groupActive) setGroup([]); else if (selectedId) setSelectedId(null); else onClose(); return; }
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
                <span className="wb-sim" role="group" aria-label="Simulate">
                    <button className={sim.running ? 'on' : ''} onClick={toggleSim} title={sim.running ? 'Pause the simulation for everyone' : 'Simulate traffic through the system-design blocks, for everyone'} aria-pressed={sim.running}>
                        {sim.running ? <Pause size={15} /> : <Play size={15} />}
                        <span className="wb-sim-label">{sim.running ? 'Pause' : simActive ? 'Resume' : 'Simulate'}</span>
                    </button>
                    <input
                        type="range" min="0" max="1000" step="1"
                        value={loadToPos(load)}
                        onChange={(e) => chooseLoad(posToLoad(Number(e.target.value)))}
                        aria-label="Load (requests per second)"
                        aria-valuetext={`${load} requests per second`}
                        title="Load: requests per second sent by the clients"
                    />
                    <output className="wb-sim-load">{fmtRate(load)} req/s</output>
                    {simActive && (
                        <>
                            <span className="wb-sim-time" title="Simulated time since the run started">t {((simSnap?.t ?? 0) / 1000).toFixed(1)} s</span>
                            <button onClick={resetSim} title="Stop and reset the run" aria-label="Reset simulation"><RotateCcw size={14} /></button>
                        </>
                    )}
                </span>
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
                        style = { left: box.x * zoom + pan.x, top: box.y * zoom + pan.y, width: box.w * zoom, height: box.h * zoom, fontSize: (el.fontSize || 13.5) * zoom, fontWeight: el.bold ? 700 : 500, textAlign: el.align || 'center' };
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

                {simActive && (
                    <div className="wb-simnote" role="status" aria-live="polite">
                        {simCatchUp ? `Catching up to t ${(simCatchUp.goal / 1000).toFixed(1)} s…` : explain(elements, simSnap, sim.load)}
                    </div>
                )}

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

                {/* Several shapes selected: align and distribute */}
                {groupActive && !editing && (() => {
                    const { minX, minY, maxX } = boxOf(groupNodes);
                    const aw = areaRef.current?.clientWidth || 800;
                    const width = 330;
                    const top = minY * zoom + pan.y - 52;
                    const x = Math.max(8, Math.min(aw - width - 8, ((minX + maxX) / 2) * zoom + pan.x - width / 2));
                    const few = groupNodes.length < 3;
                    const btn = (how, I, label, disabled) => (
                        <button key={how} onClick={() => alignGroup(how)} title={label} aria-label={label} disabled={disabled}><I size={15} /></button>
                    );
                    return (
                        <div className="wb-ctx" style={{ left: x, top: Math.max(8, top) }} role="toolbar" aria-label={`${groupNodes.length} shapes`} onPointerDown={(e) => e.stopPropagation()}>
                            <span className="wb-ctx-count">{groupNodes.length}</span>
                            <span className="wb-ctx-sep" />
                            {btn('left', AlignStartVertical, 'Align left edges')}
                            {btn('center', AlignCenterVertical, 'Align centres horizontally')}
                            {btn('right', AlignEndVertical, 'Align right edges')}
                            <span className="wb-ctx-sep" />
                            {btn('top', AlignStartHorizontal, 'Align top edges')}
                            {btn('middle', AlignCenterHorizontal, 'Align centres vertically')}
                            {btn('bottom', AlignEndHorizontal, 'Align bottom edges')}
                            <span className="wb-ctx-sep" />
                            {btn('hspace', AlignHorizontalDistributeCenter, few ? 'Distribute horizontally (select 3 or more)' : 'Distribute horizontally', few)}
                            {btn('vspace', AlignVerticalDistributeCenter, few ? 'Distribute vertically (select 3 or more)' : 'Distribute vertically', few)}
                            <span className="wb-ctx-sep" />
                            <button className="wb-ctx-del" onClick={deleteGroup} title="Delete (Del)" aria-label="Delete selected shapes"><Trash2 size={15} /></button>
                        </div>
                    );
                })()}

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
                    const simmable = isSimNode(selectedEl);
                    const width = isConn ? 300 : simmable ? 302 : 264;
                    const y = top - 52 >= 8 ? top - 52 : bottom + 12;
                    const x = Math.max(8, Math.min(aw - width - 8, cx - width / 2));
                    const cur = selectedEl.color || 'ink';
                    return (
                        <div className="wb-ctx" style={{ left: x, top: y }} role="toolbar" aria-label={isConn ? 'Connector' : 'Shape'} onPointerDown={(e) => e.stopPropagation()}>
                            <span className="wb-ctx-pal">
                                <button className="wb-chip" style={{ '--sw': cur === 'ink' ? 'var(--wb-ink)' : cur }} onClick={() => { const open = !ctxPal; closeMenus(); setCtxPal(open); }} title="Colour" aria-label="Colour" aria-expanded={ctxPal}><i /></button>
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
                            {!isConn && (
                                <span className="wb-ctx-pal">
                                    <button className={textMenu ? 'on' : ''} onClick={() => { const open = !textMenu; closeMenus(); setTextMenu(open); }} title="Text size and alignment" aria-label="Text style" aria-expanded={textMenu}><ALargeSmall size={16} /></button>
                                    {textMenu && (
                                        <span className="wb-ctx-swatches wb-textmenu" role="group" aria-label="Text style">
                                            <span className="wb-seg">
                                                {TEXT_SIZES.map((sz) => (
                                                    <button key={sz.id} className={(selectedEl.fontSize || 13.5) === sz.px ? 'on' : ''} onClick={() => applyUpdate([{ ...selectedEl, fontSize: sz.px }])} title={`Text size ${sz.id}`}>{sz.id}</button>
                                                ))}
                                            </span>
                                            <span className="wb-textmenu-row">
                                                <button className={selectedEl.bold ? 'on' : ''} onClick={() => applyUpdate([{ ...selectedEl, bold: !selectedEl.bold }])} title="Bold" aria-label="Bold" aria-pressed={!!selectedEl.bold}><Bold size={15} /></button>
                                                <i />
                                                {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([a, I]) => (
                                                    <button key={a} className={(selectedEl.align || 'center') === a ? 'on' : ''} onClick={() => applyUpdate([{ ...selectedEl, align: a }])} title={`Align ${a}`} aria-label={`Align text ${a}`}><I size={15} /></button>
                                                ))}
                                                <i />
                                                {[['top', AlignVerticalJustifyStart], ['middle', AlignVerticalJustifyCenter], ['bottom', AlignVerticalJustifyEnd]].map(([a, I]) => (
                                                    <button key={a} className={(selectedEl.valign || 'middle') === a ? 'on' : ''} onClick={() => applyUpdate([{ ...selectedEl, valign: a }])} title={`Text at ${a}`} aria-label={`Text at ${a}`}><I size={15} /></button>
                                                ))}
                                            </span>
                                        </span>
                                    )}
                                </span>
                            )}
                            {!isConn && (
                                <span className="wb-ctx-pal">
                                    <button className={shapeMenu ? 'on' : ''} onClick={() => { const open = !shapeMenu; closeMenus(); setShapeMenu(open); }} title="Change shape" aria-label="Change shape" aria-expanded={shapeMenu}><Shapes size={15} /></button>
                                    {shapeMenu && (
                                        <span className="wb-ctx-swatches wb-shapemenu" role="menu" aria-label="Change to">
                                            <span className="wb-lib-h">Flowchart</span>
                                            <span className="wb-lib-shapes">
                                                {SHAPES.map((sh) => (
                                                    <button key={sh.id} className={!selectedEl.kind && selectedEl.shape === sh.id ? 'on' : ''} onClick={() => changeType({ shape: sh.id })} title={sh.label} role="menuitem">
                                                        <svg width="32" height="26" viewBox="0 0 32 26" aria-hidden="true"><path d={SHAPE_PREVIEW[sh.id]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /></svg>
                                                        <span>{sh.label}</span>
                                                    </button>
                                                ))}
                                            </span>
                                            <span className="wb-lib-h">System design</span>
                                            <span className="wb-lib-blocks">
                                                {TEMPLATES.map((t) => (
                                                    <button key={t.id} className={selectedEl.kind === t.id ? 'on' : ''} onClick={() => changeType({ template: t.id })} title={t.text} role="menuitem">
                                                        <i style={{ background: t.color === 'ink' ? 'var(--wb-ink)' : t.color }} />
                                                        {t.label}
                                                    </button>
                                                ))}
                                            </span>
                                        </span>
                                    )}
                                </span>
                            )}
                            {simmable && (
                                <>
                                    <span className="wb-ctx-sep" />
                                    <button className={propsOpen ? 'on' : ''} onClick={() => { const open = !propsOpen; closeMenus(); setPropsOpen(open); }} title="Properties: capacity for simulate mode" aria-label="Properties" aria-expanded={propsOpen}><Gauge size={15} /></button>
                                </>
                            )}
                            <span className="wb-ctx-sep" />
                            <button onClick={() => startEdit(selectedEl)} title={isConn ? 'Edit label (Enter)' : 'Edit text (Enter)'} aria-label="Edit text"><Type size={15} /></button>
                            {!isConn && <button onClick={duplicateSelected} title="Duplicate (Ctrl+D)" aria-label="Duplicate"><Copy size={15} /></button>}
                            <button className="wb-ctx-del" onClick={() => deleteIds([selectedEl.id])} title="Delete (Del)" aria-label="Delete"><Trash2 size={15} /></button>
                            {simmable && propsOpen && (() => {
                                const client = isClient(selectedEl);
                                const set = client || hasCapacity(selectedEl);
                                const typical = typicalSim(selectedEl);
                                return (
                                    <div className={`wb-props${x + 280 > aw ? ' wb-props--end' : ''}${y + 380 > (area?.clientHeight || 600) && y > 380 ? ' wb-props--up' : ''}`} role="dialog" aria-label="Properties">
                                        <strong className="wb-props-h">Properties</strong>
                                        {client ? (
                                            <p className="wb-pop-tip">Clients send the load set in the header, shared evenly between them.</p>
                                        ) : !set && (
                                            <div className="wb-props-empty">
                                                <p className="wb-pop-tip">No capacity set. While simulating, traffic passes through this block instantly and it shows no numbers.</p>
                                                <button onClick={() => commitSim({})}>Use typical values</button>
                                            </div>
                                        )}
                                        <div className="wb-props-grid">
                                            {fieldsFor(selectedEl).map((f) => (
                                                <label key={f.key} title={f.hint}>
                                                    <span>{f.label}</span>
                                                    <input
                                                        type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step}
                                                        value={propsDraft[f.key] ?? selectedEl.sim?.[f.key] ?? ''}
                                                        placeholder={String(typical[f.key] ?? '')}
                                                        onChange={(e) => setPropsDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                                        onBlur={() => commitSimField(f)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setPropsDraft({}); setPropsOpen(false); } }}
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                        {selectedEl.sim && <button className="wb-props-clear" onClick={clearSim}>{client ? 'Reset to defaults' : 'Clear capacity'}</button>}
                                    </div>
                                );
                            })()}
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
