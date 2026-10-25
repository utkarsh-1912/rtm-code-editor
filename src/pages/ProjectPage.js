import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import "react-reflex/styles.css";
import "./ProjectPage.css";
import {
    Folder,
    Plus,
    X,
    MessageSquare,
    Sun,
    Video,
    Terminal,
    FileCode,
    Moon,
    Users,
    Play,
    Globe,
    RotateCcw,
    Trash2,
    Zap,
    ExternalLink
} from "lucide-react";
import toast from "react-hot-toast";
import ProjectEditor from "../components/ProjectEditor";
import ProjectFileTree, { FileIcon, relPath } from "../components/ProjectFileTree";
import WorkspaceHeader from "../components/WorkspaceHeader";
import RoomLayout, { useRoomLayout, LayoutMenu, CardHandle, useDockSlot } from "../components/RoomLayout";
import Client from "../components/clients";
import Loader from "../components/ux/Loader";
import { getBackendUrl } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { runCode, formatRun } from "../utils/runner";
import { languageForFile, LANGS } from "../utils/languages";
import { CLIENT_ID } from "../utils/clientId";
import { resolveTheme, setThemePref } from "../utils/theme";
import "../styles/app.css";
import ACTIONS from "../Action";
import { initSocket } from "../socket";
import VideoChat from "../components/VideoChat";
import WhiteboardModal from "../components/WhiteboardModal";
import ChatWindow from "../components/chatWindow";
import InviteModal from "../components/InviteModal";
import CommandPalette from "../components/CommandPalette";
import AICopilotModal from "../components/AICopilotModal";
import DiffViewerModal from "../components/DiffViewerModal";
import AnalyticsDashboardModal from "../components/AnalyticsDashboardModal";
import FocusModeModal from "../components/FocusModeModal";
import { 
    Eye, 
    EyeOff, 
    Search, 
    Layout,
    User,
    History,
    Activity,
    PanelLeftClose,
    SquareTerminal,
    HardDriveDownload,
    FileUp,
    FolderOpen,
    LayoutTemplate
} from "lucide-react";
import { bundleWebProject } from "../utils/webBundle";
import AiIcon from "../components/AiIcon";
import { pickFiles, pickFolder, uploadFiles, describeSkipped, saveToDisk, openTerminal, rootFor, linkRoot, canWriteToDisk, canOpenTerminal } from "../utils/localFiles";

const SIDE_TABS = [
    { id: 'files', label: 'Files', Icon: Folder },
    { id: 'chat', label: 'Chat', Icon: MessageSquare },
    { id: 'users', label: 'People', Icon: Users },
];

// Optional card layout (same machinery as rooms, project cards). Classic, the sidebar layout,
// stays the default; cards are opt-in from the status bar's layout menu.
const PROJECT_LAYOUT = {
    key: 'project-layout-v1',
    panels: {
        files: { label: 'Files' },
        code: { label: 'Editor' },
        output: { label: 'Output' },
        chat: { label: 'Chat' },
        people: { label: 'People' },
        call: { label: 'Call' },
    },
    presets: [
        { id: 'ide', label: 'Files left', note: 'Like an IDE', layout: { left: ['files'], right: ['code', 'output'] } },
        { id: 'team', label: 'Files and chat', note: 'Team project', layout: { left: ['files', 'chat'], right: ['code', 'output'] } },
        { id: 'preview', label: 'Preview right', note: 'Web projects', layout: { left: ['files', 'code'], right: ['output'] } },
        { id: 'pair', label: 'Files and call', note: 'Pairing', layout: { left: ['files', 'call'], right: ['code', 'output'] } },
        { id: 'review', label: 'Chat right', note: 'Code review', layout: { left: ['code', 'output'], right: ['chat', 'people'] } },
        { id: 'focus', label: 'Focus', note: 'Just the code', layout: { left: [], right: ['code', 'output'] } },
    ],
    fallback: { left: ['files'], right: ['code', 'output'] },
    toggles: ['files', 'chat', 'people', 'call'],
    below: { output: 'code' },
};
// Default card heights in a column, by weight (the editor gets most of it).
const PROJECT_WEIGHT = { code: 3, output: 1.4, files: 1, chat: 1.2, people: 0.8, call: 1.4 };
const projectFlex = (id, ids) => (PROJECT_WEIGHT[id] || 1) / ids.reduce((sum, x) => sum + (PROJECT_WEIGHT[x] || 1), 0);

const ProjectPage = () => {
    const { projectId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [files, setFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [openFiles, setOpenFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [showWhiteboard, setShowWhiteboard] = useState(false);
    const [settings] = useState({
        fontSize: 16,
        lineNumbers: true,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        foldGutter: true,
        highlightActiveLine: true,
        tabSize: 4,
        keybinding: "default",
        enableLinting: true,
        wordWrap: true
    });


    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [clients, setClients] = useState([]);
    const [guestName, setGuestName] = useState(localStorage.getItem("guest-name") || "");
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showAICopilot, setShowAICopilot] = useState(false);
    const [showDiffViewer, setShowDiffViewer] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [showFocusModal, setShowFocusModal] = useState(false);


    // New Lobby States
    const [showGuestModal, setShowGuestModal] = useState(!user && !localStorage.getItem("guest-name"));
    const initialAudio = true;
    const initialVideo = true;

    const [sidebarTab, setSidebarTab] = useState('files');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMeetingActive, setIsMeetingActive] = useState(false);
    const [theme, setTheme] = useState(resolveTheme);
    const [isExecuting, setIsExecuting] = useState(false);
    const [output, setOutput] = useState("");
    const [mediaStates, setMediaStates] = useState({});
    const [isOutputVisible, setIsOutputVisible] = useState(true);
    const [webSrcDoc, setWebSrcDoc] = useState("");
    const [outputTab, setOutputTab] = useState("preview"); // "preview" | "terminal"
    const [programInput, setProgramInput] = useState("");
    const [activeTab, setActiveTab] = useState('code'); // 'code', 'files', 'chat', 'users', 'video'
    const [isMeetingMinimized, setIsMeetingMinimized] = useState(true); // default true for floating overlay
    const [isMeetingStarting, setIsMeetingStarting] = useState(false);
    const [isZenMode, setIsZenMode] = useState(false);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const projectLayout = useRoomLayout(PROJECT_LAYOUT);
    const [layoutMode, setLayoutMode] = useState(() => {
        try { return localStorage.getItem('project-layout-mode') === 'cards' ? 'cards' : 'classic'; } catch { return 'classic'; }
    });
    useEffect(() => {
        try { localStorage.setItem('project-layout-mode', layoutMode); } catch { /* storage blocked */ }
    }, [layoutMode]);
    const [showLayoutMenu, setShowLayoutMenu] = useState(false);
    const [setCallSlot, callRect] = useDockSlot();
    const cards = layoutMode === 'cards' && !isMobile && !isZenMode;

    const socketRef = useRef(null);
    const hasJoinedRef = useRef(false);
    const filesRef = useRef([]);
    const openFilesRef = useRef([]);
    const reloadFilesRef = useRef(null);
    const saveTimeoutRef = useRef(null);
    const compileRef = useRef(null);
    const saveDiskRef = useRef(null);

    const isLightMode = theme === "light";

    useEffect(() => {
        filesRef.current = files;
    }, [files]);

    useEffect(() => {
        openFilesRef.current = openFiles;
    }, [openFiles]);



    // --- Core Handlers (callback-stabilized for palette) ---
    const toggleTheme = React.useCallback(() => {
        const newTheme = theme === "dark" ? "light" : "dark";
        setTheme(newTheme);
        setThemePref(newTheme);
    }, [theme]);

    useEffect(() => {
        const handleIframeMessage = (event) => {
            if (event.data?.type === 'CONSOLE_LOG') {
                setOutput((prev) => (prev ? `${prev}\n[LOG] ${event.data.log}` : `[LOG] ${event.data.log}`));
            } else if (event.data?.type === 'CONSOLE_WARN') {
                setOutput((prev) => (prev ? `${prev}\n[WARN] ${event.data.log}` : `[WARN] ${event.data.log}`));
            } else if (event.data?.type === 'CONSOLE_ERROR') {
                setOutput((prev) => (prev ? `${prev}\n[ERROR] ${event.data.log}` : `[ERROR] ${event.data.log}`));
            }
        };
        window.addEventListener('message', handleIframeMessage);
        return () => window.removeEventListener('message', handleIframeMessage);
    }, []);

    const handleFileClick = React.useCallback((file) => {
        setActiveFile(file);
        if (!openFiles.find(f => f.id === file.id)) {
            setOpenFiles(prev => [...prev, file]);
        }
        if (isMobile) setActiveTab('code');
    }, [openFiles, isMobile]);

    // Live preview for web projects: rebuild shortly after any file changes (yours or a
    // teammate's), no Run needed. Run still forces a fresh reload.
    const isWebType = (project?.type || 'web') === 'web';
    const activeHtml = /\.html?$/i.test(activeFile?.name || '') ? activeFile.path || activeFile.name : null;
    useEffect(() => {
        if (!project || !isWebType || !files.length) return undefined;
        const t = setTimeout(() => {
            const html = activeHtml ? files.find((f) => (f.path || f.name) === activeHtml) : null;
            setOutput(''); // the console shows the current page's logs, not every rebuild's
            setWebSrcDoc(bundleWebProject(files, { activeFile: html }));
        }, 350);
        return () => clearTimeout(t);
    }, [project, isWebType, files, activeHtml]);

    const handleCompile = React.useCallback(async () => {
        const projectType = project?.type || "web";
        const fileExt = activeFile?.name?.split('.').pop()?.toLowerCase();

        if (projectType === "web" || fileExt === "html" || fileExt === "css") {
            setIsOutputVisible(true);
            setOutputTab("preview");

            // Same doc twice would not reload the frame; the comment makes it unique.
            const src = bundleWebProject(files, { activeFile }) + `<!-- run ${Date.now()} -->`;
            setWebSrcDoc(src);
            const timeStr = new Date().toLocaleTimeString();
            setOutput(prev => prev ? `${prev}\n--- Web App Reloaded [${timeStr}] ---` : `--- Web App Reloaded [${timeStr}] ---`);
            return;
        }

        if (!activeFile?.name) {
            toast.error("Open a file before running the project.");
            return;
        }

        setIsExecuting(true);
        setIsOutputVisible(true);
        setOutputTab("terminal");
        setOutput("Running…");

        const language = activeFile.name.split('.').pop();
        const runtime = languageForFile(activeFile.name);
        if (!runtime) {
            setIsExecuting(false);
            setOutput(`Can't run .${language} files. Open a source file (${LANGS.map((l) => '.' + l.ext[0]).join(' ')}).`);
            return;
        }

        let sourceCode = activeFile.content;

        if (language === 'cpp' || language === 'h') {
            const visited = new Set([activeFile.name]);
            function resolveIncludes(content) {
                return content.replace(/#include\s*"(.*?)"/g, (match, fileName) => {
                    if (visited.has(fileName)) return `// Already included: ${fileName}`;
                    const includedFile = files.find(f => f.name === fileName);
                    if (includedFile) {
                        visited.add(fileName);
                        return `// Included from ${fileName}\n${resolveIncludes(includedFile.content)}`;
                    }
                    return match;
                });
            }
            sourceCode = resolveIncludes(sourceCode);
        } else if (language === 'java') {
            const visited = new Set([activeFile.name]);
            function resolveJavaImports(code) {
                // Remove package declaration
                let resolved = code.replace(/^package\s+.*?;/gm, '');
                // Resolve imports for project classes
                resolved = resolved.replace(/^import\s+([a-zA-Z0-9_.]+);/gm, (match, fullClassName) => {
                    const className = fullClassName.split('.').pop();
                    const fileName = `${className}.java`;
                    if (visited.has(fileName)) return `// File ${fileName} already bundled`;
                    const importedFile = files.find(f => f.name === fileName);
                    if (importedFile) {
                        visited.add(fileName);
                        const content = importedFile.content.replace(/public\s+class/g, 'class');
                        return `// Bundled from ${fileName}\n${resolveJavaImports(content)}`;
                    }
                    return match;
                });
                return resolved;
            }

            sourceCode = resolveJavaImports(activeFile.content);
            // Append any other java files not explicitly imported
            files.filter(f => f.name.endsWith('.java') && !visited.has(f.name)).forEach(f => {
                visited.add(f.name);
                const cleanContent = f.content.replace(/public\s+class/g, 'class').replace(/^package\s+.*?;/gm, '');
                sourceCode += `\n\n// From ${f.name}\n${resolveJavaImports(cleanContent)}`;
            });
        } else if (language === 'py') {
            const visited = new Set([activeFile.name]);
            function resolvePythonImports(content) {
                // Handle: from module import ...
                let resolved = content.replace(/^from\s+([a-zA-Z0-9_.]+)\s+import\s+/gm, (match, moduleName) => {
                    const fileName = `${moduleName}.py`;
                    if (visited.has(fileName)) return `# Already imported: ${moduleName}\n`;
                    const importedFile = files.find(f => f.name === fileName);
                    if (importedFile) {
                        visited.add(fileName);
                        return `# Imported from ${fileName}\n${resolvePythonImports(importedFile.content)}\n`;
                    }
                    return match;
                });

                // Handle: import module
                resolved = resolved.replace(/^import\s+([a-zA-Z0-9_.]+)/gm, (match, moduleName) => {
                    const fileName = `${moduleName}.py`;
                    if (visited.has(fileName)) return `# Already imported: ${moduleName}\n`;
                    const importedFile = files.find(f => f.name === fileName);
                    if (importedFile) {
                        visited.add(fileName);
                        return `# Imported from ${fileName}\n${resolvePythonImports(importedFile.content)}\n`;
                    }
                    return match;
                });

                return resolved;
            }
            sourceCode = resolvePythonImports(sourceCode);
        }

        try {
            const result = await runCode({ language: runtime, source: sourceCode, stdin: programInput });
            setOutput(formatRun(result) + `

— ${result.status} · ${result.timeMs ?? '?'} ms · ${result.engine}`);
        } catch (error) {
            setOutput(`Could not run the code: ${error.message}`);
        } finally {
            setIsExecuting(false);
        }
    }, [project, activeFile, files, programInput]);

    const isWebProject = (project?.type || 'web') === 'web';

    // Web projects get a live preview + console; compiled/scripted languages get stdin + output.
    const renderOutputPanel = () => isWebProject ? (
        <div className="ws-out">
            <div className="ws-pane-head">
                <div className="u-seg" role="tablist" aria-label="Output">
                    <button className={outputTab === 'preview' ? 'on' : ''} onClick={() => setOutputTab('preview')}><Globe size={12} /> Preview</button>
                    <button className={outputTab === 'terminal' ? 'on' : ''} onClick={() => setOutputTab('terminal')}><Terminal size={12} /> Console</button>
                </div>
                <div className="ws-out-actions">
                    {outputTab === 'terminal' && (
                        <button className="u-icon" onClick={() => setOutput("")} title="Clear console" aria-label="Clear console"><Trash2 size={14} /></button>
                    )}
                    {outputTab === 'preview' && (
                        <>
                            <button className="u-icon" onClick={handleCompile} title="Rebuild preview" aria-label="Rebuild preview"><RotateCcw size={14} /></button>
                            <button className="u-icon" onClick={() => window.open(`/render/${projectId}`, '_blank')} title="Open preview in a new tab" aria-label="Open preview in a new tab"><ExternalLink size={14} /></button>
                        </>
                    )}
                    {!cards && <button className="u-icon" onClick={() => setIsOutputVisible(false)} title="Hide panel" aria-label="Hide panel"><X size={14} /></button>}
                </div>
            </div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {outputTab === 'preview' ? (
                    <div className="ws-browser">
                        <div className="ws-browser-bar"><i /><i /><i /><span>{(project?.name || 'app').toLowerCase().replace(/\s+/g, '-')}.preview</span></div>
                        <iframe
                            srcDoc={webSrcDoc || '<!DOCTYPE html><html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;color:#8E8C85;background:#fff">Building preview…</body></html>'}
                            title="Web Preview"
                            sandbox="allow-scripts allow-modals allow-forms allow-popups"
                        />
                    </div>
                ) : (
                    <pre className="ws-console">{output || <span className="u-caret">No console output yet.</span>}</pre>
                )}
            </div>
        </div>
    ) : (
        <div className="ws-out ws-io">
            <div className="ws-io-col">
                <div className="ws-pane-head"><span>Input</span><b>stdin</b></div>
                <textarea
                    className="ws-stdin"
                    value={programInput}
                    onChange={(e) => setProgramInput(e.target.value)}
                    placeholder="Text your program reads from standard input"
                    spellCheck={false}
                    aria-label="Program input"
                />
            </div>
            <div className="ws-io-col">
                <div className="ws-pane-head">
                    <span>Output</span>
                    <div className="ws-out-actions">
                        <button className="u-icon" onClick={() => setOutput("")} title="Clear output" aria-label="Clear output"><Trash2 size={14} /></button>
                        {!cards && <button className="u-icon" onClick={() => setIsOutputVisible(false)} title="Hide panel" aria-label="Hide panel"><X size={14} /></button>}
                    </div>
                </div>
                <pre className="ws-console">{isExecuting ? <span className="u-caret">Running</span> : (output || <span className="u-caret">No output yet. Press Run</span>)}</pre>
            </div>
        </div>
    );

    // --- Keyboard Shortcuts & Palette Actions ---
    const commandActions = useMemo(() => {
        const baseActions = [
            { 
                id: 'zen-toggle', 
                label: isZenMode ? 'Exit Zen Mode' : 'Enter Zen Mode', 
                icon: isZenMode ? <Eye size={18} /> : <EyeOff size={18} />, 
                category: 'Actions',
                description: 'Focus on code without distractions.',
                shortcut: 'ALT + Z',
                run: () => setIsZenMode(prev => !prev) 
            },
            { 
                id: 'terminal-toggle', 
                label: isOutputVisible ? 'Hide Terminal' : 'Show Terminal', 
                icon: <Terminal size={18} />, 
                category: 'Actions',
                description: 'Toggle the system terminal/output panel.',
                run: () => setIsOutputVisible(prev => !prev) 
            },
            { 
                id: 'theme-toggle', 
                label: isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode', 
                icon: isLightMode ? <Moon size={18} /> : <Sun size={18} />, 
                category: 'Settings',
                description: 'Switch between light and dark IDE themes.',
                run: () => toggleTheme() 
            },
            { 
                id: 'run-project', 
                label: 'Run Project', 
                icon: <Play size={18} fill="currentColor" />, 
                category: 'Actions',
                description: 'Compile and execute the current project.',
                shortcut: 'CTRL + ENTER',
                run: () => handleCompile() 
            },
            { 
                id: 'whiteboard', 
                label: 'Open Whiteboard', 
                icon: <Layout size={18} />, 
                category: 'Collaboration',
                description: 'Collaborate on an infinite digital canvas.',
                run: () => setShowWhiteboard(true) 
            },
            { 
                id: 'invite', 
                label: 'Invite Team', 
                icon: <Plus size={18} />, 
                category: 'Collaboration',
                description: 'Share project access with others.',
                run: () => setShowInviteModal(true) 
            },
            { 
                id: 'dashboard', 
                label: 'Go to Dashboard', 
                icon: <Folder size={18} />, 
                category: 'Navigation',
                description: 'Exit to the main project management hub.',
                run: () => navigate('/dashboard') 
            }
        ];

        const fileActions = files.filter(file => !file.is_directory).map(file => ({
            id: `file-${file.id}`,
            label: file.name,
            icon: <FileCode size={18} />,
            category: 'Files',
            description: `Open ${file.name}`,
            run: () => handleFileClick(file)
        }));

        const teamActions = clients.map(client => ({
            id: `user-${client.socketId}`,
            label: client.userName || 'Guest',
            icon: <User size={18} />,
            category: 'Collaboration',
            description: 'Connected team member.',
            run: () => toast(`Jumping to ${client.userName}'s cursor coming soon!`)
        }));

        return [...baseActions, ...fileActions, ...teamActions];
    }, [isZenMode, isOutputVisible, isLightMode, files, clients, navigate, handleCompile, handleFileClick, toggleTheme, setShowWhiteboard, setShowInviteModal]);

    useEffect(() => {
        const handleGlobalKeydown = (e) => {
            if (e.altKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                setIsZenMode(prev => !prev);
                toast.success(!isZenMode ? "Zen Mode Active" : "Zen Mode Disabled", {
                    icon: !isZenMode ? '🧘' : '👁️',
                    style: { borderRadius: '10px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
                });
            }
            if (e.altKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                setShowFocusModal(prev => !prev);
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setShowCommandPalette(prev => !prev);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                compileRef.current?.();
            }
            // Desktop app: Ctrl+S writes the project to its folder on disk.
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's' && canWriteToDisk()) {
                e.preventDefault();
                e.stopPropagation();
                saveDiskRef.current?.();
            }
        };
        // Capture phase so Ctrl+Enter / Ctrl+S never reach the editor (no stray newline).
        window.addEventListener('keydown', handleGlobalKeydown, true);
        return () => window.removeEventListener('keydown', handleGlobalKeydown, true);
    }, [isZenMode]);



    // The name we joined with; re-sent on every reconnect (a reconnected socket has a new id
    // and is in no rooms, so without this the person disappears for everyone else).
    const joinedNameRef = useRef(null);
    const joinProject = React.useCallback((name) => {
        if (!socketRef.current || !name) return;
        joinedNameRef.current = name;
        socketRef.current.userName = name;
        socketRef.current.emit(ACTIONS.PROJECT_JOIN, {
            projectId,
            userName: name,
            photoURL: user?.photoURL || null,
            uid: user?.uid || null,
            clientId: CLIENT_ID,
        });
        hasJoinedRef.current = true;
    }, [projectId, user?.photoURL, user?.uid]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener("resize", handleResize);

        const init = async () => {
            try {
                const backendUrl = getBackendUrl();
                const projRes = await fetch(`${backendUrl}/api/projects/${projectId}`);
                if (!projRes.ok) throw new Error("Project not found");
                const projData = await projRes.json();
                setProject(projData);

                if (projData.type === 'web') {
                    setIsOutputVisible(true);
                }

                const filesRes = await fetch(`${backendUrl}/api/projects/${projectId}/files`);
                const filesData = await filesRes.json();
                setFiles(filesData);

                // Open the entry file: index.html for web, the language's main file, else a main.*.
                const base = (f) => (f.path || f.name || '').replace(/^[/]+/, '');
                const entry = filesData.find((f) => projData.type === 'web' && /^index\.html?$/i.test(base(f)))
                    || filesData.find((f) => base(f) === LANGS.find((l) => l.id === projData.type)?.file)
                    || filesData.find((f) => /^(main|index|app)\.[a-z]+$/i.test(base(f)) && languageForFile(base(f)))
                    || filesData.find((f) => !/^readme/i.test(base(f)) && !f.is_directory)
                    || filesData.find((f) => !f.is_directory);
                if (entry) {
                    setActiveFile(entry);
                    setOpenFiles([entry]);
                }

                const sock = await initSocket();
                if (cancelled) { sock.disconnect(); return; }
                socketRef.current = sock;
                sock.on('connect', () => {
                    toast.dismiss('socket-reconnect');
                    if (joinedNameRef.current) joinProject(joinedNameRef.current);
                });
                socketRef.current.on('connect_error', (err) => handleErrors(err));
                socketRef.current.on('connect_failed', (err) => handleErrors(err));

                socketRef.current.on('media-state-update', ({ userId, state }) => {
                    setMediaStates(prev => ({ ...prev, [userId]: { ...prev[userId], ...state } }));
                });

                // Someone created, moved, imported or deleted files: reload the list.
                socketRef.current.on('project-files-changed', () => { reloadFilesRef.current?.(); });

                socketRef.current.on('project-renamed', ({ name }) => {
                    if (name) setProject((p) => (p ? { ...p, name } : p));
                });

                socketRef.current.on(ACTIONS.JOINED, ({ clients }) => {
                    setClients(clients);
                });

                socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId }) => {
                    setClients(prev => prev.filter(c => c.socketId !== socketId));
                    setMediaStates(prev => {
                        const next = { ...prev };
                        delete next[socketId];
                        return next;
                    });
                });

                socketRef.current.on(ACTIONS.FILE_CHANGE, ({ fileId, content, socketId }) => {
                    if (socketRef.current.id === socketId) return;
                    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content } : f));
                    setActiveFile(prev => prev?.id === fileId ? { ...prev, content } : prev);
                });

                // Track which file each remote user is editing
                socketRef.current.on(ACTIONS.CURSOR_MOVE, ({ fileId }) => {
                    // Cursors logic disabled to resolve unused state warn
                });

                // Sync chat history when joining project room
                // The server's history wins over the browser cache: it knows about deleted
                // messages and ones sent while you were away. The cache only shows until it arrives.
                socketRef.current.on(ACTIONS.SYNC_CHAT, ({ messages: history }) => {
                    const list = Array.isArray(history) ? history : [];
                    setMessages(list);
                    try { localStorage.setItem(`project-chat-${projectId}`, JSON.stringify(list)); } catch { /* storage blocked */ }
                });

                socketRef.current.on(ACTIONS.FOLLOW_MODE, ({ viewState, userName }) => {
                    if (viewState?.fileId) {
                        const file = filesRef.current.find(f => f.id === viewState.fileId);
                        if (file) {
                            setActiveFile(file);
                            if (!openFilesRef.current.find(f => f.id === file.id)) {
                                setOpenFiles(prev => [...prev, file]);
                            }
                        }
                    }
                });

                socketRef.current.on(ACTIONS.RECEIVE_MESSAGE, (message) => {
                    setMessages(prev => {
                        if (prev.find(m => m.id === message.id)) return prev;
                        const updated = [...prev, message];
                        localStorage.setItem(`project-chat-${projectId}`, JSON.stringify(updated));
                        return updated;
                    });
                });

                socketRef.current.on(ACTIONS.EDIT_MESSAGE, ({ messageId, newText }) => {
                    setMessages(prev => {
                        const updated = prev.map(m => m.id === messageId ? { ...m, text: newText, isEdited: true } : m);
                        localStorage.setItem(`project-chat-${projectId}`, JSON.stringify(updated));
                        return updated;
                    });
                });

                socketRef.current.on(ACTIONS.DELETE_MESSAGE, ({ messageId }) => {
                    setMessages(prev => {
                        const updated = prev.filter(m => m.id !== messageId);
                        localStorage.setItem(`project-chat-${projectId}`, JSON.stringify(updated));
                        return updated;
                    });
                });

                // Connection trouble: stay on the project and keep retrying (socket.io does);
                // "connect" re-joins. Never leave the page over a retry error.
                function handleErrors(e) {
                    console.log('socket error', e?.message || e);
                    toast.loading('Connection lost. Reconnecting…', { id: 'socket-reconnect' });
                }

                // Bypass lobby and connect directly
                const savedGuestName = localStorage.getItem("guest-name");
                if (user) {
                    joinProject(user.name);
                } else if (savedGuestName) {
                    joinProject(savedGuestName);
                } else {
                    setShowGuestModal(true);
                }

                // Load chat history from localstorage
                const savedChat = localStorage.getItem(`project-chat-${projectId}`);
                if (savedChat) {
                    try { setMessages(JSON.parse(savedChat)); } catch { /* ignore corrupted cache */ }
                }

                setLoading(false);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load project");
                navigate('/dashboard');
            }
        };

        let cancelled = false;
        const onPageHide = () => socketRef.current?.disconnect();
        window.addEventListener("pagehide", onPageHide);
        if (projectId) init();

        return () => {
            cancelled = true;
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("pagehide", onPageHide);
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            // The next run makes a new socket that must join again.
            hasJoinedRef.current = false;
            joinedNameRef.current = null;
        };
        // Re-run only when the project or the signed-in person changes, not on every profile
        // update (that used to tear the socket down and leave the person out of the room).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, user?.uid]);





    const handleSaveFile = (content, isRemote = false) => {
        if (!activeFile) return;

        // 1. Immediate local UI update
        setFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, content } : f));

        // Update both activeFile and openFiles to prevent stale content when switching via tabs
        setActiveFile(prev => (prev && prev.id === activeFile.id) ? { ...prev, content } : prev);
        setOpenFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, content } : f));

        if (isRemote) return; // Don't re-emit or re-save if change came from socket

        // 2. Real-time broadcast (This is now primarily handled by ProjectEditor, 
        // but we keep this as a fallback or for other UI parts)
        if (socketRef.current) {
            socketRef.current.emit(ACTIONS.FILE_CHANGE, {
                roomId: `project-${projectId}`,
                fileId: activeFile.id,
                content,
                socketId: socketRef.current.id
            });
        }

        // 3. Debounced backend persistence
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                const backendUrl = getBackendUrl();
                await fetch(`${backendUrl}/api/projects/${projectId}/files`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: activeFile.name,
                        path: activeFile.path || activeFile.name,
                        content,
                        isDirectory: false
                    })
                });
            } catch (err) {
                console.error("Failed to persist file changes", err);
            }
        }, 1500);
    };

    const handleCloseTab = (e, fileId) => {
        e.stopPropagation();
        const nextOpenFiles = openFiles.filter(f => f.id !== fileId);
        setOpenFiles(nextOpenFiles);
        if (activeFile?.id === fileId) {
            setActiveFile(nextOpenFiles.length > 0 ? nextOpenFiles[nextOpenFiles.length - 1] : null);
        }
    };

    // Create a file or folder. `pathArg` is relative to the project root and may include
    // folders ("src/utils/math.js"); missing parent folders appear from the path itself.
    const handleAddFile = async (pathArg, { isDirectory = false } = {}) => {
        const rel = String(typeof pathArg === "string" ? pathArg : "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        if (!rel) return;
        if (rel.split("/").some((seg) => !seg || seg === "." || seg === "..")) {
            toast.error("That name isn't a valid path.");
            return;
        }
        if (files.some((f) => relPath(f) === rel)) {
            toast.error(`${rel} already exists`);
            return;
        }
        try {
            const res = await fetch(`${getBackendUrl()}/api/projects/${projectId}/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: rel, path: `/${rel}`, content: '', isDirectory, isNew: true }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to create");
            const created = await res.json();
            if (!created?.id) throw new Error("Failed to create");

            setFiles(prev => [...prev, created]);
            if (!isDirectory) {
                setActiveFile(created);
                setOpenFiles(prev => [...prev, created]);
            }
            socketRef.current?.emit(ACTIONS.FILE_CHANGE, {
                roomId: `project-${projectId}`,
                fileId: created.id,
                path: created.path,
                content: '',
                isNew: true
            });
            toast.success(isDirectory ? `Folder ${rel} created` : `${rel} created`);
        } catch (err) {
            toast.error(err.message || (isDirectory ? "Could not create the folder" : "Could not create the file"));
        }
    };

    // Delete a file, or a folder and everything inside it.
    const handleDeleteFile = async (item) => {
        const target = item.isFolder ? item.path : relPath(item);
        const inside = (f) => {
            const p = relPath(f);
            return item.isFolder ? p === target || p.startsWith(`${target}/`) : f.id === item.id;
        };
        const doomed = files.filter(inside);
        const fileCount = doomed.filter((f) => !f.is_directory).length;
        const question = item.isFolder
            ? `Delete folder ${target}${fileCount ? ` and ${fileCount} file${fileCount === 1 ? '' : 's'} in it` : ''}? This cannot be undone.`
            : `Delete ${target}? This cannot be undone.`;
        if (!window.confirm(question)) return;
        try {
            const res = await fetch(`${getBackendUrl()}/api/projects/${projectId}/files?path=${encodeURIComponent(`/${target}`)}${item.isFolder ? '&recursive=1' : ''}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Delete failed");
            const gone = new Set(doomed.map((f) => f.id));
            setFiles(prev => prev.filter(f => !gone.has(f.id)));
            const nextOpen = openFiles.filter(f => !gone.has(f.id));
            setOpenFiles(nextOpen);
            if (activeFile && gone.has(activeFile.id)) setActiveFile(nextOpen[nextOpen.length - 1] || null);
            toast.success(item.isFolder ? `Deleted ${target}` : "File deleted");
        } catch (err) {
            toast.error(item.isFolder ? "Could not delete the folder" : "Could not delete file");
        }
    };

    // Reload the file list from the server (after a move here, or a change by someone else).
    // Rows are matched by id, so a moved file keeps its open tab and its unsaved text.
    const reloadFiles = async () => {
        try {
            const res = await fetch(`${getBackendUrl()}/api/projects/${projectId}/files`);
            if (!res.ok) return;
            const rows = await res.json();
            if (!Array.isArray(rows)) return;
            const byId = new Map(rows.map((r) => [r.id, r]));
            const local = new Map(filesRef.current.map((f) => [f.id, f]));
            setFiles(rows.map((r) => (local.has(r.id) ? { ...local.get(r.id), path: r.path, name: r.name } : r)));
            const remap = (f) => (byId.has(f.id) ? { ...f, path: byId.get(f.id).path, name: byId.get(f.id).name } : null);
            setOpenFiles((prev) => prev.map(remap).filter(Boolean));
            setActiveFile((prev) => (prev ? remap(prev) : prev));
        } catch { /* offline: the next change reloads it */ }
    };
    reloadFilesRef.current = reloadFiles;

    // Move or rename a file, or a folder with everything in it (paths from the project root).
    const handleMoveFile = async (from, to) => {
        try {
            const res = await fetch(`${getBackendUrl()}/api/projects/${projectId}/files/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from, to }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || 'Could not move it');
            await reloadFiles();
            const renamed = from.split('/').slice(0, -1).join('/') === to.split('/').slice(0, -1).join('/');
            toast.success(renamed ? `Renamed to ${to.split('/').pop()}` : `Moved to ${to.includes('/') ? to.split('/').slice(0, -1).join('/') : 'the project root'}`);
        } catch (err) {
            toast.error(err.message || 'Could not move it');
        }
    };

    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target.result;
            const fileName = file.name;

            try {
                const backendUrl = getBackendUrl();
                const res = await fetch(`${backendUrl}/api/projects/${projectId}/files`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: fileName,
                        path: `/${fileName}`,
                        content: content,
                        isDirectory: false,
                        isNew: true
                    })
                });

                if (!res.ok) throw new Error("Import failed");
                const newFile = await res.json();

                setFiles(prev => [...prev, newFile]);
                setActiveFile(newFile);
                socketRef.current.emit(ACTIONS.FILE_CHANGE, {
                    roomId: `project-${projectId}`,
                    fileId: newFile.id,
                    path: newFile.path,
                    content: content,
                    isNew: true
                });
                toast.success("File imported!");
            } catch (err) {
                toast.error("Import failed");
            }
        };
        reader.readAsText(file);
    };

    // ---- Disk (desktop app: open/save to a folder, terminal; browser: add files) ----
    const handleAddFromDisk = async (kind) => {
        let picked;
        try {
            picked = kind === 'folder' ? await pickFolder() : await pickFiles();
        } catch (err) {
            return toast.error(err.message || 'Could not open that');
        }
        if (!picked) return;
        if (!picked.files.length) return toast.error(`Nothing to add. ${describeSkipped(picked.skipped)}`.trim());
        const id = toast.loading(`Adding ${picked.files.length} file${picked.files.length === 1 ? '' : 's'}…`);
        try {
            const saved = await uploadFiles(projectId, picked.files, (done, total) => toast.loading(`Adding ${done}/${total} files…`, { id }));
            setFiles((prev) => {
                const byPath = new Map(prev.map((f) => [f.path, f]));
                saved.forEach((f) => byPath.set(f.path, f));
                return [...byPath.values()];
            });
            if (kind === 'folder' && picked.root && !rootFor(projectId)) linkRoot(projectId, picked.root);
            toast.success(`Added ${saved.length} file${saved.length === 1 ? '' : 's'}. ${describeSkipped(picked.skipped)}`.trim(), { id });
        } catch (err) {
            toast.error(err.message || 'Could not add files', { id });
        }
    };

    const handleSaveToDisk = async (chooseFolder = false) => {
        try {
            const r = await saveToDisk(projectId, filesRef.current, { chooseFolder });
            if (r) toast.success(`Saved ${r.written} file${r.written === 1 ? '' : 's'} to ${r.root}`);
        } catch (err) {
            // The folder may have been moved or never opened here: ask for one.
            if (!chooseFolder && /not opened|ENOENT/i.test(err.message || '')) return handleSaveToDisk(true);
            toast.error(err.message || 'Save failed');
        }
    };

    const handleOpenTerminal = async () => {
        try {
            await openTerminal(projectId, project?.name);
            if (!rootFor(projectId)) toast('Terminal opened in your home folder. Use "Save to disk" to give this project a folder.', { icon: '›' });
        } catch (err) {
            toast.error(err.message || 'Could not open a terminal');
        }
    };

    const diskActions = [
        ...(canOpenTerminal() ? [{ id: 'terminal', label: 'Open terminal', icon: <SquareTerminal size={18} />, onClick: handleOpenTerminal, pin: !isMobile }] : []),
        ...(canWriteToDisk() ? [
            { id: 'save-disk', label: rootFor(projectId) ? 'Save to disk' : 'Save to disk…', icon: <HardDriveDownload size={18} />, onClick: () => handleSaveToDisk(false), section: 'more' },
            ...(rootFor(projectId) ? [{ id: 'save-disk-as', label: 'Save to another folder…', icon: <HardDriveDownload size={18} />, onClick: () => handleSaveToDisk(true), section: 'more' }] : []),
        ] : []),
        { id: 'add-files', label: 'Add files from disk', icon: <FileUp size={18} />, onClick: () => handleAddFromDisk('files'), section: 'more' },
        { id: 'add-folder', label: 'Add folder from disk', icon: <FolderOpen size={18} />, onClick: () => handleAddFromDisk('folder'), section: 'more' },
    ];
    compileRef.current = handleCompile;
    saveDiskRef.current = () => handleSaveToDisk(false);



    if (loading) {
        return (
            <div className="ws">
                <Loader variant="fill" message="Opening project" detail="Loading files and joining the session" />
            </div>
        );
    }

    const toggleSidebarTab = (tab) => {
        if (sidebarTab === tab) {
            setIsSidebarOpen(prev => !prev);
        } else {
            setSidebarTab(tab);
            setIsSidebarOpen(true);
        }
    };

    const me = user?.name || guestName;

    // Sidebar switch (Files / Chat / People), at the top of the sidebar itself.
    const renderSideTabs = () => (
        <div className="ws-side-tabs">
            <div className="u-seg" role="tablist" aria-label="Sidebar">
                {SIDE_TABS.map((t) => (
                    <button key={t.id} role="tab" aria-selected={sidebarTab === t.id} className={sidebarTab === t.id ? 'on' : ''} onClick={() => setSidebarTab(t.id)}>
                        <t.Icon size={13} /> {t.label}
                        {t.id === 'chat' && messages.length > 0 && sidebarTab !== 'chat' && <i className="ws-rail-dot" />}
                    </button>
                ))}
            </div>
            <button className="ws-side-close" onClick={() => setIsSidebarOpen(false)} title="Hide sidebar" aria-label="Hide sidebar"><PanelLeftClose size={15} /></button>
        </div>
    );

    const renderTabs = (handle = null) => (
        <div className="ws-tabs" role="tablist" aria-label="Open files">
            {handle}
            {openFiles.map(file => (
                <div key={file.id} role="tab" aria-selected={activeFile?.id === file.id} className={`ws-tab${activeFile?.id === file.id ? ' on' : ''}`} onClick={() => handleFileClick(file)}>
                    <FileIcon name={file.name} size={13} />
                    <span title={relPath(file)}>{relPath(file).split('/').pop()}</span>
                    <button onClick={(e) => handleCloseTab(e, file.id)} aria-label={`Close ${file.name}`}><X size={12} /></button>
                </div>
            ))}
        </div>
    );

    const renderEditor = () => (activeFile ? (
        <ProjectEditor
            key={activeFile.id}
            socketRef={socketRef}
            roomId={`project-${projectId}`}
            fileId={activeFile.id}
            onCodeChange={handleSaveFile}
            code={activeFile.content}
            filename={activeFile.name}
            language={activeFile.name?.split('.').pop() || 'javascript'}
            settings={settings}
            userName={me}
            isLightMode={isLightMode}
        />
    ) : (
        <div className="ws-empty">
            <span className="u-display">No file open</span>
            <p style={{ margin: 0 }}>Pick a file from the tree, or create one.</p>
            <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => { setSidebarTab('files'); setIsSidebarOpen(true); setActiveTab('files'); }}><Folder size={14} /> Show files</button>
        </div>
    ));

    const renderPeople = () => (
        <div className="ws-people">
            {clients.map((client, i) => {
                const name = client.userName || client.name || 'Guest';
                return (
                    <Client key={client.socketId || i} userName={name} photoURL={client.photoURL} isCurrentUser={client.socketId ? client.socketId === socketRef.current?.id : name === me} />
                );
            })}
        </div>
    );

    const renderWorkArea = (outputFlex) => (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {renderTabs()}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                <ReflexContainer orientation="horizontal">
                    <ReflexElement flex={isOutputVisible ? 1 - outputFlex : 1} minSize={120}>
                        {renderEditor()}
                    </ReflexElement>
                    {isOutputVisible && <ReflexSplitter />}
                    {isOutputVisible && (
                        <ReflexElement flex={outputFlex} minSize={90}>
                            {renderOutputPanel()}
                        </ReflexElement>
                    )}
                </ReflexContainer>
            </div>
        </div>
    );

    // One card of the optional card layout. `handle` is the drag grip for cards that show it inline.
    const renderProjectPanel = (id, handle) => {
        if (id === 'files') {
            return (
                <div className="ws-card-scroll" style={{ background: 'var(--u-bg-2)' }}>
                    <ProjectFileTree files={files} activeFile={activeFile} project={project} onSelect={handleFileClick} onCreate={handleAddFile} onDelete={handleDeleteFile} onImport={handleImportFile} onMove={handleMoveFile} />
                </div>
            );
        }
        if (id === 'code') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {renderTabs(handle)}
                    <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>{renderEditor()}</div>
                </div>
            );
        }
        if (id === 'output') return renderOutputPanel();
        if (id === 'chat') return <ChatWindow socketRef={socketRef} roomId={`project-${projectId}`} userName={me} isLightMode={isLightMode} isMobile={isMobile} messages={messages} setMessages={setMessages} />;
        if (id === 'people') return <div className="ws-card-scroll">{renderPeople()}</div>;
        if (id === 'call') {
            if (isMeetingActive) return <div ref={setCallSlot} className="rl-call-slot" />;
            return (
                <div className="rl-call-empty">
                    <span className="rl-call-icon"><Video size={20} /></span>
                    <strong>No call running</strong>
                    <span>Start a call and it plays here, next to your code.</span>
                    <button onClick={() => setIsMeetingActive(true)}><Video size={14} /> Start call</button>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="ws project-workspace">
            {!isZenMode && (
                <WorkspaceHeader
                    isMobile={isMobile}
                    isLightMode={isLightMode}
                    onLogo={() => navigate('/dashboard')}
                    mode="Project"
                    title={project?.name || "Loading..."}
                    subtitle={project?.type}
                    clients={clients}
                    currentUserName={me}
                    onRun={handleCompile}
                    isExecuting={isExecuting}
                    onToggleTheme={toggleTheme}
                    actions={[
                        { id: 'call', label: isMeetingActive ? 'Leave call' : 'Start voice & video call', icon: <Video size={18} />, onClick: () => setIsMeetingActive(!isMeetingActive), active: isMeetingActive, tone: 'green' },
                        { id: 'board', label: 'Whiteboard', icon: <Layout size={18} />, onClick: () => setShowWhiteboard(true) },
                        { id: 'ai', label: 'AI Copilot', icon: <AiIcon size={18} />, onClick: () => setShowAICopilot(true) },
                        { id: 'invite', label: 'Invite team', icon: <Plus size={18} />, onClick: () => setShowInviteModal(true) },
                        ...diskActions,
                        { id: 'search', label: 'Command palette', icon: <Search size={18} />, onClick: () => setShowCommandPalette(true), section: 'more' },
                        { id: 'focus', label: 'Focus mode', icon: <Zap size={18} />, onClick: () => setShowFocusModal(true), section: 'more' },
                        { id: 'history', label: 'Version history', icon: <History size={18} />, onClick: () => setShowDiffViewer(true), section: 'more' },
                        { id: 'analytics', label: 'Analytics', icon: <Activity size={18} />, onClick: () => setShowAnalytics(true), section: 'more' },
                        { id: 'dash', label: 'Back to dashboard', icon: <Layout size={18} />, onClick: () => navigate('/dashboard'), section: 'more' },
                    ]}
                />
            )}

            <div className="ws-body">
                {isMobile ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {activeTab === 'code' && renderWorkArea(0.4)}
                        {activeTab === 'files' && (
                            <div style={{ flex: 1, background: 'var(--u-bg-2)', overflow: 'hidden' }}>
                                <ProjectFileTree files={files} activeFile={activeFile} project={project} onSelect={(f) => { handleFileClick(f); setActiveTab('code'); }} onCreate={handleAddFile} onDelete={handleDeleteFile} onImport={handleImportFile} onMove={handleMoveFile} />
                            </div>
                        )}
                        {activeTab === 'chat' && (
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <ChatWindow socketRef={socketRef} roomId={`project-${projectId}`} userName={me} isLightMode={isLightMode} isMobile={isMobile} messages={messages} setMessages={setMessages} />
                            </div>
                        )}
                        {activeTab === 'users' && (
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                <div className="ws-pane-head"><span>People</span><b>{clients.length} online</b></div>
                                {renderPeople()}
                            </div>
                        )}
                        {activeTab === 'video' && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                <VideoChat
                                    socketRef={socketRef}
                                    projectId={projectId}
                                    user={user || { name: guestName || 'Guest', isGuest: true }}
                                    isMinimized={false}
                                    externalInCall={isMeetingStarting}
                                    onCallStateChange={setIsMeetingStarting}
                                    clients={clients}
                                    mediaStates={mediaStates}
                                    initialAudioState={initialAudio}
                                    initialVideoState={initialVideo}
                                    isMobile={isMobile}
                                />
                            </div>
                        )}
                    </div>
                ) : cards ? (
                    <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                        <RoomLayout
                            state={projectLayout}
                            renderPanel={renderProjectPanel}
                            inlineHandles={isMeetingActive ? ['call'] : []}
                            flexOf={projectFlex}
                            hidden={isOutputVisible ? [] : ['output']}
                            onHideCard={(id) => { if (id !== 'output') return false; setIsOutputVisible(false); return true; }}
                        />
                    </div>
                ) : (
                    <ReflexContainer orientation="vertical" style={{ flex: 1, height: '100%', minHeight: 0 }}>
                        {!isZenMode && isSidebarOpen && ['files', 'chat', 'users'].includes(sidebarTab) && (
                            <ReflexElement flex={0.2} minSize={240} style={{ height: '100%', minHeight: 0, background: 'var(--u-bg-2)', display: 'flex', flexDirection: 'column' }}>
                                {renderSideTabs()}
                                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                                    {sidebarTab === 'files' && <ProjectFileTree files={files} activeFile={activeFile} project={project} onSelect={handleFileClick} onCreate={handleAddFile} onDelete={handleDeleteFile} onImport={handleImportFile} onMove={handleMoveFile} />}
                                    {sidebarTab === 'chat' && <ChatWindow socketRef={socketRef} roomId={`project-${projectId}`} userName={me} isLightMode={isLightMode} isMobile={isMobile} messages={messages} setMessages={setMessages} />}
                                    {sidebarTab === 'users' && renderPeople()}
                                </div>
                            </ReflexElement>
                        )}

                        {!isZenMode && isSidebarOpen && ['files', 'chat', 'users'].includes(sidebarTab) && <ReflexSplitter />}

                        <ReflexElement flex={1} style={{ height: '100%', display: 'flex', flexDirection: 'row' }}>
                            {!isZenMode && !isSidebarOpen && (
                                <nav className="ws-rail" aria-label="Sidebar">
                                    {SIDE_TABS.map((t) => (
                                        <button key={t.id} onClick={() => toggleSidebarTab(t.id)} title={t.label} aria-label={`Show ${t.label}`}>
                                            <t.Icon size={16} />
                                            {t.id === 'chat' && messages.length > 0 && <i className="ws-rail-dot" />}
                                        </button>
                                    ))}
                                </nav>
                            )}
                            <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                {renderWorkArea(0.36)}
                            </div>
                        </ReflexElement>
                    </ReflexContainer>
                )}
            </div>

            {isMeetingActive && !isMobile && (
                <VideoChat
                    socketRef={socketRef}
                    projectId={projectId}
                    user={user || { name: guestName || 'Guest', isGuest: true }}
                    isMinimized={isMeetingMinimized}
                    onMinimizeToggle={(val) => setIsMeetingMinimized(val)}
                    dock={cards && projectLayout.has('call') ? callRect : null}
                    onDockToggle={cards ? () => projectLayout.toggle('call') : undefined}
                    dockHandle={<CardHandle id="call" state={projectLayout} />}
                    externalInCall={isMeetingStarting}
                    onCallStateChange={(active) => {
                        setIsMeetingStarting(active);
                        if (!active) setIsMeetingActive(false);
                    }}
                    clients={clients}
                    mediaStates={mediaStates}
                    initialAudioState={initialAudio}
                    initialVideoState={initialVideo}
                    isMobile={isMobile}
                />
            )}

            {!isMobile && (
                <footer className="ws-status">
                    <div>
                        <span><span className="u-dot" /> live</span>
                        <span>{(project?.type || 'project')} engine</span>
                        <span>{files.length} file{files.length === 1 ? '' : 's'}</span>
                        {activeFile && <span>{activeFile.path || `/${activeFile.name}`}</span>}
                    </div>
                    <div>
                        <span>{clients.length} online</span>
                        <span className="rl-anchor">
                            <button className={showLayoutMenu ? 'on' : ''} onClick={() => setShowLayoutMenu((v) => !v)} aria-expanded={showLayoutMenu} title="Layout: classic sidebar or rearrangeable cards">
                                <LayoutTemplate size={12} /> layout
                            </button>
                            {showLayoutMenu && (
                                <LayoutMenu
                                    state={projectLayout}
                                    onClose={() => setShowLayoutMenu(false)}
                                    classic={{ on: layoutMode === 'classic', onPick: () => setLayoutMode('classic'), onCards: () => setLayoutMode('cards') }}
                                />
                            )}
                        </span>
                        <button className={isOutputVisible ? 'on' : ''} onClick={() => setIsOutputVisible(!isOutputVisible)} title="Toggle output panel">
                            <Terminal size={12} /> output
                        </button>
                        <button onClick={handleCompile} disabled={isExecuting}><Play size={10} fill="currentColor" /> {isExecuting ? 'running…' : 'run'}</button>
                    </div>
                </footer>
            )}

            {isMobile && (
                <nav className="ws-tabbar" aria-label="Workspace">
                    {[
                        { id: 'code', icon: <FileCode size={19} />, label: 'Code' },
                        { id: 'files', icon: <Folder size={19} />, label: 'Files' },
                        { id: 'chat', icon: <MessageSquare size={19} />, label: 'Chat', dot: messages.length > 0 },
                        { id: 'users', icon: <Users size={19} />, label: 'People' },
                        { id: 'video', icon: <Video size={19} />, label: 'Meet' },
                    ].map((t) => (
                        <button key={t.id} className={activeTab === t.id ? 'on' : ''} onClick={() => setActiveTab(t.id)}>
                            {t.icon}<span>{t.label}</span>
                            {t.dot && <span className="u-count" style={{ minWidth: 8, height: 8, padding: 0 }} />}
                        </button>
                    ))}
                </nav>
            )}

            {showGuestModal && (
                <div className="u-modal-back">
                    <form className="u-modal" style={{ maxWidth: 420 }} onSubmit={(e) => {
                        e.preventDefault();
                        if (guestName.trim()) {
                            localStorage.setItem('guest-name', guestName.trim());
                            joinProject(guestName.trim());
                            setShowGuestModal(false);
                        }
                    }}>
                        <div className="u-modal-head">
                            <div>
                                <span className="u-label">project/{project?.name || projectId}</span>
                                <h3>Join the project</h3>
                                <p>Pick a name so teammates know who is typing.</p>
                            </div>
                        </div>
                        <div className="u-modal-body">
                            <div className="u-field">
                                <label htmlFor="guest-name">Display name</label>
                                <input id="guest-name" className="u-input" autoFocus value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="e.g. Ada Lovelace" required />
                            </div>
                            <button type="submit" className="u-btn u-btn--solid u-btn--lg u-btn--block">Join workspace</button>
                        </div>
                    </form>
                </div>
            )}

            <AICopilotModal
                isOpen={showAICopilot}
                onClose={() => setShowAICopilot(false)}
                code={activeFile?.content || ""}
                language={languageForFile(activeFile?.name) || 'javascript'}
                projectId={projectId}
                userId={user?.uid}
                onApplyCode={(newCode) => {
                    handleSaveFile(newCode);
                }}
            />

            <DiffViewerModal
                isOpen={showDiffViewer}
                onClose={() => setShowDiffViewer(false)}
                projectId={projectId}
                currentCode={activeFile?.content || ""}
                files={files.map((f) => ({ path: f.path, name: f.name, content: f.content }))}
                createdBy={me}
                onRestoreSnapshot={(snap) => {
                    if (snap.code) handleSaveFile(snap.code);
                }}
            />

            <AnalyticsDashboardModal
                isOpen={showAnalytics}
                onClose={() => setShowAnalytics(false)}
                projectId={projectId}
            />

            <FocusModeModal
                isOpen={showFocusModal}
                onClose={() => setShowFocusModal(false)}
                files={files}
                activeFile={activeFile}
                onFileSelect={(file) => handleFileClick(file)}
                code={activeFile?.content || ""}
                onCodeChange={(val) => handleSaveFile(val)}
                language={activeFile?.name?.split('.').pop() || 'javascript'}
                fileName={activeFile?.name || 'main.js'}
                isLightMode={isLightMode}
            />

            <InviteModal
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                projectId={projectId}
                projectName={project?.name || "this project"}
                inviterName={me}
            />

            <WhiteboardModal
                isOpen={showWhiteboard}
                onClose={() => setShowWhiteboard(false)}
                socketRef={socketRef}
                roomId={`project-${projectId}`}
                user={user || { name: guestName || 'Guest' }}
            />

            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                actions={commandActions}
                isLightMode={isLightMode}
            />

            {isZenMode && (
                <button className="u-btn u-btn--solid ws-zen-exit" onClick={() => setIsZenMode(false)}>
                    <Eye size={15} /> Exit zen mode
                </button>
            )}
        </div>
    );
};

export default ProjectPage;
