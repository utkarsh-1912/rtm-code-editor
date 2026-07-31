import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import "react-reflex/styles.css";
import "./ProjectPage.css";
import {
    FileText,
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
    Pause,
    Globe,
    RotateCcw,
    Trash2
} from "lucide-react";
import toast from "react-hot-toast";
import ProjectEditor from "../components/ProjectEditor";
import LogoLoader from "../components/LogoLoader";
import { getBackendUrl } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import ACTIONS from "../Action";
import { initSocket } from "../socket";
import VideoChat from "../components/VideoChat";
import WhiteboardModal from "../components/WhiteboardModal";
import ChatWindow from "../components/chatWindow";
import InviteModal from "../components/InviteModal";
import CommandPalette from "../components/CommandPalette";
import Client from "../components/clients";
import AICopilotModal from "../components/AICopilotModal";
import DiffViewerModal from "../components/DiffViewerModal";
import AnalyticsDashboardModal from "../components/AnalyticsDashboardModal";
import { 
    Eye, 
    EyeOff, 
    Search, 
    Layout,
    User,
    Bot,
    History,
    Activity
} from "lucide-react";

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


    // New Lobby States
    const [showGuestModal, setShowGuestModal] = useState(!user && !localStorage.getItem("guest-name"));
    const initialAudio = true;
    const initialVideo = true;

    const [sidebarTab, setSidebarTab] = useState('files');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMeetingActive, setIsMeetingActive] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem("app-theme") || "dark");
    const [isExecuting, setIsExecuting] = useState(false);
    const [output, setOutput] = useState("");
    const [mediaStates, setMediaStates] = useState({});
    const [isOutputVisible, setIsOutputVisible] = useState(true);
    const [webSrcDoc, setWebSrcDoc] = useState("");
    const [outputTab, setOutputTab] = useState("preview"); // "preview" | "terminal"
    const [activeTab, setActiveTab] = useState('code'); // 'code', 'files', 'chat', 'users', 'video'
    const [isMeetingMinimized, setIsMeetingMinimized] = useState(true); // default true for floating overlay
    const [isMeetingStarting, setIsMeetingStarting] = useState(false);
    const [isZenMode, setIsZenMode] = useState(false);
    const [showCommandPalette, setShowCommandPalette] = useState(false);

    const socketRef = useRef(null);
    const hasJoinedRef = useRef(false);
    const filesRef = useRef([]);
    const openFilesRef = useRef([]);
    const saveTimeoutRef = useRef(null);

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
        localStorage.setItem("app-theme", newTheme);
        if (newTheme === "light") {
            document.documentElement.classList.add("light-theme");
        } else {
            document.documentElement.classList.remove("light-theme");
        }
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

    const pollExecutionResult = React.useCallback(async (token) => {
        const url = `https://judge0-ce.p.rapidapi.com/submissions/${token}?base64_encoded=true&fields=*`;
        const options = {
            method: "GET",
            headers: {
                "X-RapidAPI-Key": process.env.REACT_APP_RAPIDAPI_KEY || 'd08f949d60mshc3405a91834ca1fp1a2502jsn34e3da2dd121',
                "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
            },
        };

        try {
            const response = await fetch(url, options);
            const data = await response.json();

            if (data.status?.id === 1 || data.status?.id === 2) {
                if ((pollExecutionResult._retries || 0) < 20) {
                    pollExecutionResult._retries = (pollExecutionResult._retries || 0) + 1;
                    setTimeout(() => pollExecutionResult(token), 2000);
                } else {
                    pollExecutionResult._retries = 0;
                    setIsExecuting(false);
                    setOutput("Execution timed out. Please try again.");
                }
                return;
            } else {
                setIsExecuting(false);
                // Safe UTF-8 atob decoding
                const safeDecode = (b64) => { try { return decodeURIComponent(escape(atob(b64))); } catch { return atob(b64); } };
                const decodedOutput = data.stdout ? safeDecode(data.stdout) : null;
                const decodedError = data.stderr ? safeDecode(data.stderr) : null;
                const decodedCompileOutput = data.compile_output ? safeDecode(data.compile_output) : null;

                if (data.status?.id === 3) {
                    setOutput(decodedOutput !== null ? decodedOutput : "Code Executed Successfully. No Output.");
                } else {
                    setOutput(decodedError || decodedCompileOutput || data.status?.description || "Unknown Error");
                }
            }
        } catch (err) {
            console.error(err);
            setOutput("Error retrieving execution output.");
            setIsExecuting(false);
        }
    }, []);

    const handleCompile = React.useCallback(async () => {
        const projectType = project?.type || "web";
        const fileExt = activeFile?.name?.split('.').pop()?.toLowerCase();

        if (projectType === "web" || fileExt === "html" || fileExt === "css" || fileExt === "js") {
            setIsOutputVisible(true);
            setOutputTab("preview");

            const htmlFile = files.find(f => f.name === 'index.html' || f.name.endsWith('.html'))?.content 
                || (fileExt === 'html' ? activeFile.content : '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Web App</title></head><body><h1>Web App Preview</h1></body></html>');
            const cssFile = files.find(f => f.name === 'style.css' || f.name.endsWith('.css'))?.content || '';
            const jsFile = files.find(f => f.name === 'script.js' || f.name.endsWith('.js'))?.content || '';

            const consoleInterceptor = `
            <script>
              (function() {
                const _log = console.log, _error = console.error, _warn = console.warn;
                console.log = function(...args) {
                  _log.apply(console, args);
                  window.parent.postMessage({ type: 'CONSOLE_LOG', log: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
                };
                console.error = function(...args) {
                  _error.apply(console, args);
                  window.parent.postMessage({ type: 'CONSOLE_ERROR', log: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
                };
                console.warn = function(...args) {
                  _warn.apply(console, args);
                  window.parent.postMessage({ type: 'CONSOLE_WARN', log: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
                };
                window.onerror = function(msg, url, line) {
                  window.parent.postMessage({ type: 'CONSOLE_ERROR', log: 'Uncaught Error: ' + msg + ' (Line ' + line + ')' }, '*');
                };
              })();
            </script>
            `;

            let src = htmlFile;
            if (src.includes('</head>')) {
                src = src.replace('</head>', `${consoleInterceptor}<style>\n${cssFile}\n</style></head>`);
            } else {
                src = `${consoleInterceptor}<style>\n${cssFile}\n</style>${src}`;
            }

            if (src.includes('</body>')) {
                src = src.replace('</body>', `<script>\n${jsFile}\n</script></body>`);
            } else {
                src = `${src}\n<script>\n${jsFile}\n</script>`;
            }

            setWebSrcDoc(src);
            const timeStr = new Date().toLocaleTimeString();
            setOutput(prev => prev ? `${prev}\n--- Web App Reloaded [${timeStr}] ---` : `--- Web App Reloaded [${timeStr}] ---`);
            return;
        }

        setIsExecuting(true);
        setIsOutputVisible(true);
        setOutput("Bundling and running...");

        const language = activeFile?.name.split('.').pop();
        let languageId = 63;
        if (language === 'cpp' || language === 'h') languageId = 54;
        else if (language === 'py') languageId = 71;
        else if (language === 'java') languageId = 62;

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

            // Safe UTF-8 base64 encoding
            const safeBase64 = (str) => { try { return btoa(unescape(encodeURIComponent(str))); } catch { return btoa(str); } };
            const formData = {
                language_id: languageId,
                source_code: safeBase64(sourceCode),
                stdin: btoa(""),
            };

        const url = "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&fields=*";
        const options = {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': process.env.REACT_APP_RAPIDAPI_KEY || 'd08f949d60mshc3405a91834ca1fp1a2502jsn34e3da2dd121',
                'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
            },
            body: JSON.stringify(formData)
        };

        try {
            const response = await fetch(url, options);
            const data = await response.json();
            if (data.token) {
                await pollExecutionResult(data.token);
            } else {
                throw new Error("Failed to get execution token.");
            }
        } catch (error) {
            console.error("Compilation error:", error);
            setOutput("Something went wrong while attempting to run your code.");
            setIsExecuting(false);
        }
    }, [project, activeFile, files, pollExecutionResult]);

    const renderOutputPanel = () => (
        <div style={{ backgroundColor: 'var(--bg-dark)', display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            <div style={outputHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '2px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <button
                            onClick={() => setOutputTab('preview')}
                            style={{
                                padding: '3px 10px',
                                fontSize: '10px',
                                fontWeight: '750',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: outputTab === 'preview' ? 'var(--primary)' : 'transparent',
                                color: outputTab === 'preview' ? '#ffffff' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Globe size={12} /> Live Preview
                        </button>
                        <button
                            onClick={() => setOutputTab('terminal')}
                            style={{
                                padding: '3px 10px',
                                fontSize: '10px',
                                fontWeight: '750',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: outputTab === 'terminal' ? 'var(--primary)' : 'transparent',
                                color: outputTab === 'terminal' ? '#ffffff' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Terminal size={12} /> Terminal Console
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {outputTab === 'terminal' && (
                        <button
                            onClick={() => setOutput("")}
                            title="Clear Terminal Logs"
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                    {outputTab === 'preview' && (
                        <button
                            onClick={handleCompile}
                            title="Refresh Web App"
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <RotateCcw size={13} />
                        </button>
                    )}
                    <X size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsOutputVisible(false)} />
                </div>
            </div>

            <div style={{ flex: 1, width: '100%', height: 'calc(100% - 36px)', position: 'relative', overflow: 'hidden' }}>
                {outputTab === 'preview' ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
                        <div style={{ height: '26px', backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                                <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                                <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                            </div>
                            <div style={{ flex: 1, backgroundColor: '#ffffff', height: '18px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', padding: '0 8px', fontFamily: 'monospace' }}>
                                http://localhost:3000/app
                            </div>
                        </div>
                        <iframe
                            key={webSrcDoc}
                            srcDoc={webSrcDoc || '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;color:#333">Click <b>RUN</b> to build & preview your web app.</body></html>'}
                            title="Web Preview"
                            style={{ width: '100%', flex: 1, border: 'none', backgroundColor: '#ffffff' }}
                            sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                        />
                    </div>
                ) : (
                    <pre style={outputTextStyle}>{output || "No console output yet. Click RUN to execute your web app or code."}</pre>
                )}
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

        const fileActions = files.map(file => ({
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
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setShowCommandPalette(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleGlobalKeydown);
        return () => window.removeEventListener('keydown', handleGlobalKeydown);
    }, [isZenMode]);



    const joinProject = React.useCallback((name) => {
        if (!socketRef.current || hasJoinedRef.current) return;

        socketRef.current.userName = name;
        socketRef.current.emit(ACTIONS.PROJECT_JOIN, {
            projectId,
            userName: name,
        });

        hasJoinedRef.current = true;
    }, [projectId]);

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

                if (filesData.length > 0) {
                    setActiveFile(filesData[0]);
                    setOpenFiles([filesData[0]]);
                }

                socketRef.current = await initSocket();
                socketRef.current.on('connect_error', (err) => handleErrors(err));
                socketRef.current.on('connect_failed', (err) => handleErrors(err));

                socketRef.current.on('media-state-update', ({ userId, state }) => {
                    setMediaStates(prev => ({ ...prev, [userId]: { ...prev[userId], ...state } }));
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
                socketRef.current.on(ACTIONS.SYNC_CHAT, ({ messages: history }) => {
                    setMessages(prev => {
                        if (prev.length > 0) return prev; // already loaded from localStorage
                        return history;
                    });
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

                function handleErrors(e) {
                    console.log('socket error', e);
                    toast.error('Socket connection failed, try again later.');
                    navigate('/dashboard');
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

        if (projectId) init();

        return () => {
            window.removeEventListener("resize", handleResize);
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [projectId, user, navigate, joinProject]);





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

    const handleAddFile = async () => {
        const type = project?.type || "web";
        let allowed = [];
        if (type === "web") allowed = ["html", "css", "js"];
        else if (type === "cpp") allowed = ["cpp", "h"];
        else if (type === "python") allowed = ["py"];
        else if (type === "java") allowed = ["java"];

        const fileName = prompt(`Enter file name (Allowed: ${allowed.join(", ")}):`);
        if (!fileName) return;

        const ext = fileName.split('.').pop().toLowerCase();
        if (!allowed.includes(ext)) {
            toast.error(`Invalid extension for ${type} project. Allowed: ${allowed.join(", ")}`);
            return;
        }

        try {
            const backendUrl = getBackendUrl();
            const res = await fetch(`${backendUrl}/api/projects/${projectId}/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: fileName,
                    path: `/${fileName}`,
                    content: '',
                    isDirectory: false
                })
            });

            if (!res.ok) throw new Error("Failed to create file");
            const newFile = await res.json();

            setFiles(prev => [...prev, newFile]);
            setActiveFile(newFile);
            setOpenFiles(prev => [...prev, newFile]);

            socketRef.current.emit(ACTIONS.FILE_CHANGE, {
                roomId: `project-${projectId}`,
                fileId: newFile.id,
                path: newFile.path,
                content: '',
                isNew: true
            });

            toast.success("File created!");
        } catch (err) {
            toast.error("Error creating file");
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
                        isDirectory: false
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



    if (loading) {
        return (
            <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-dark)", color: "white" }}>
                <LogoLoader message="Initialising Project Workspace..." />
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

    return (
        <div className="project-workspace" style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-dark)', color: 'var(--text-main)', overflow: 'hidden' }}>
            {/* Workspace Core Header */}
            {!isZenMode && (
                <div style={{
                    height: isMobile ? "50px" : "56px",
                    backgroundColor: "var(--bg-card)",
                    borderBottom: "1px solid var(--border-color)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: isMobile ? "0 12px" : "0 20px",
                    flexShrink: 0,
                    zIndex: 100
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "8px" : "14px" }}>
                        <div style={logoWrapperStyle} onClick={() => navigate('/dashboard')}>
                            <img
                                src={isMobile
                                    ? (isLightMode ? "/utkristi-labs.png" : "/utkristi-labs-dark.png")
                                    : (isLightMode ? "/utkristi-colabs.png" : "/utkristi-colabs-dark.png")
                                }
                                alt="Logo"
                                style={{ height: isMobile ? '24px' : '32px', objectFit: 'contain' }}
                            />
                        </div>
                        {!isMobile && <div style={{ height: "20px", width: "1px", backgroundColor: "var(--border-color)" }} />}
                        {!isMobile && (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Project</span>
                                <span style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text-main)", backgroundColor: "var(--secondary)", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", fontWeight: "600" }}>
                                    {project?.name || "Loading..."}
                                </span>
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "8px" : "12px" }}>
                        {!isMobile && (
                            <div style={{ display: "flex", alignItems: "center" }}>
                                {clients.slice(0, 5).map((client, idx) => (
                                    <div key={client.socketId || idx} style={{ marginLeft: idx === 0 ? 0 : "-8px", zIndex: 5 - idx }}>
                                        <Client 
                                            userName={client.userName || client.name} 
                                            isCompact={true} 
                                            isCurrentUser={(client.userName || client.name) === (user?.name || guestName)} 
                                        />
                                    </div>
                                ))}
                                {clients.length > 5 && (
                                    <div style={{ 
                                        marginLeft: "-8px", 
                                        width: "32px", 
                                        height: "32px", 
                                        borderRadius: "50%", 
                                        backgroundColor: "var(--secondary)", 
                                        display: "flex", 
                                        alignItems: "center", 
                                        justifyContent: "center", 
                                        fontSize: "11px", 
                                        fontWeight: "700", 
                                        color: "var(--text-muted)", 
                                        border: "2px solid var(--bg-card)" 
                                    }}>
                                        +{clients.length - 5}
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Redesigned Icon Tray (Clean IDE Style, matching editor.js) */}
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            backgroundColor: "var(--secondary)",
                            padding: "4px",
                            borderRadius: "10px",
                            border: "1px solid var(--border-color)"
                        }}>
                            {!isMobile && (
                                <>
                                    <button
                                        onClick={() => toggleSidebarTab('files')}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
                                            color: (isSidebarOpen && sidebarTab === 'files') ? "var(--primary)" : "var(--text-muted)",
                                            backgroundColor: (isSidebarOpen && sidebarTab === 'files') ? "rgba(59, 130, 246, 0.1)" : "transparent",
                                            borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s"
                                        }}
                                        onMouseOver={(e) => !(isSidebarOpen && sidebarTab === 'files') && (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                                        onMouseOut={(e) => !(isSidebarOpen && sidebarTab === 'files') && (e.currentTarget.style.backgroundColor = "transparent")}
                                        title="Files Explorer"
                                    >
                                        <Folder size={18} />
                                    </button>
                                    <button
                                        onClick={() => toggleSidebarTab('chat')}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
                                            color: (isSidebarOpen && sidebarTab === 'chat') ? "var(--primary)" : "var(--text-muted)",
                                            backgroundColor: (isSidebarOpen && sidebarTab === 'chat') ? "rgba(59, 130, 246, 0.1)" : "transparent",
                                            borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s",
                                            position: "relative"
                                        }}
                                        onMouseOver={(e) => !(isSidebarOpen && sidebarTab === 'chat') && (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                                        onMouseOut={(e) => !(isSidebarOpen && sidebarTab === 'chat') && (e.currentTarget.style.backgroundColor = "transparent")}
                                        title="Project Chat"
                                    >
                                        <MessageSquare size={18} />
                                        {messages.length > 0 && <div style={{ position: 'absolute', top: '4px', right: '4px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }} />}
                                    </button>
                                    <button
                                        onClick={() => toggleSidebarTab('users')}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
                                            color: (isSidebarOpen && sidebarTab === 'users') ? "var(--primary)" : "var(--text-muted)",
                                            backgroundColor: (isSidebarOpen && sidebarTab === 'users') ? "rgba(59, 130, 246, 0.1)" : "transparent",
                                            borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s"
                                        }}
                                        onMouseOver={(e) => !(isSidebarOpen && sidebarTab === 'users') && (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                                        onMouseOut={(e) => !(isSidebarOpen && sidebarTab === 'users') && (e.currentTarget.style.backgroundColor = "transparent")}
                                        title="Team Collaborators"
                                    >
                                        <Users size={18} />
                                    </button>
                                    <button
                                        onClick={() => setShowWhiteboard(true)}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
                                            color: "var(--text-muted)", backgroundColor: "transparent",
                                            borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s"
                                        }}
                                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                        title="Infinite Board"
                                    >
                                        <Layout size={18} />
                                    </button>
                                    <button
                                        onClick={() => setIsMeetingActive(!isMeetingActive)}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
                                            color: isMeetingActive ? "#22c55e" : "var(--text-muted)",
                                            backgroundColor: isMeetingActive ? "rgba(34, 197, 94, 0.1)" : "transparent",
                                            borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s"
                                        }}
                                        onMouseOver={(e) => !isMeetingActive && (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                                        onMouseOut={(e) => !isMeetingActive && (e.currentTarget.style.backgroundColor = "transparent")}
                                        title={isMeetingActive ? "Leave Video Call" : "Join Video Call"}
                                    >
                                        <Video size={18} />
                                    </button>
                                    <button
                                        onClick={() => setShowAICopilot(true)}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
                                            color: "var(--primary)", backgroundColor: "rgba(59, 130, 246, 0.1)",
                                            borderRadius: "6px", border: "1px solid rgba(59, 130, 246, 0.2)", cursor: "pointer", transition: "all 0.2s"
                                        }}
                                        title="AI Copilot Studio"
                                    >
                                        <Bot size={18} />
                                    </button>
                                    <button
                                        onClick={() => setShowDiffViewer(true)}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
                                            color: "var(--text-muted)", backgroundColor: "transparent",
                                            borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s"
                                        }}
                                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                        title="Version History & Diff Viewer"
                                    >
                                        <History size={18} />
                                    </button>
                                    <button
                                        onClick={() => setShowAnalytics(true)}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
                                            color: "var(--text-muted)", backgroundColor: "transparent",
                                            borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s"
                                        }}
                                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                        title="Workspace Telemetry Analytics"
                                    >
                                        <Activity size={18} />
                                    </button>
                                    <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-color)", margin: "0 2px" }} />
                                </>
                            )}
                            <button
                                onClick={handleCompile}
                                disabled={isExecuting}
                                style={{
                                    display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
                                    color: isExecuting ? "#4ade80" : "#22c55e", backgroundColor: "transparent",
                                    borderRadius: "6px", border: "none", cursor: isExecuting ? "default" : "pointer", transition: "all 0.2s"
                                }}
                                onMouseOver={(e) => !isExecuting && (e.currentTarget.style.backgroundColor = "rgba(34, 197, 94, 0.1)")}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                title="Run Code"
                            >
                                {isExecuting ? <Pause size={18} fill="#4ade80" /> : <Play size={18} fill="#22c55e" />}
                            </button>
                            <button
                                onClick={toggleTheme}
                                style={{
                                    display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
                                    color: isLightMode ? "#fbbf24" : "var(--text-muted)", backgroundColor: "transparent",
                                    borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s"
                                }}
                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                title="Toggle Theme"
                            >
                                {isLightMode ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                            {!isMobile && (
                                <>
                                    <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-color)", margin: "0 2px" }} />
                                    <button
                                        onClick={() => setShowCommandPalette(true)}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
                                            color: "var(--text-muted)", backgroundColor: "transparent",
                                            borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s"
                                        }}
                                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                        title="Command Palette (Ctrl+K)"
                                    >
                                        <Search size={18} />
                                    </button>
                                    <button
                                        onClick={() => setShowInviteModal(true)}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px",
                                            color: "#a855f7", backgroundColor: "transparent",
                                            borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s"
                                        }}
                                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(168, 85, 247, 0.1)")}
                                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                        title="Invite Team"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                {isMobile ? (
                    // MOBILE VIEW: Render view dynamically based on bottom tab
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: '56px' }}>
                        {activeTab === 'code' && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={studioTabContainerStyle}>
                                    {openFiles.map(file => (
                                        <div key={file.id} onClick={() => handleFileClick(file)} style={studioTabStyle(activeFile?.id === file.id, isLightMode)}>
                                            <FileText size={12} />
                                            <span>{file.name}</span>
                                            <button style={closeTabStyle} onClick={(e) => handleCloseTab(e, file.id)}><X size={10} /></button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <ReflexContainer orientation="horizontal">
                                        <ReflexElement flex={isOutputVisible ? 0.65 : 1}>
                                            {activeFile ? (
                                                <ProjectEditor
                                                    key={activeFile.id}
                                                    socketRef={socketRef}
                                                    roomId={`project-${projectId}`}
                                                    fileId={activeFile.id}
                                                    onCodeChange={handleSaveFile}
                                                    code={activeFile.content}
                                                    filename={activeFile.name}
                                                    language={activeFile.name.split('.').pop()}
                                                    settings={settings}
                                                    userName={user?.name || guestName}
                                                    isLightMode={isLightMode}
                                                />
                                            ) : (
                                                <div style={emptyEditorStyle}><Terminal size={48} style={{ opacity: 0.1 }} /></div>
                                            )}
                                        </ReflexElement>
                                        {isOutputVisible && <ReflexSplitter style={splitterStyle} />}
                                        {isOutputVisible && (
                                            <ReflexElement flex={0.4} style={{ backgroundColor: 'var(--bg-dark)' }}>
                                                {renderOutputPanel()}
                                            </ReflexElement>
                                        )}
                                    </ReflexContainer>
                                </div>
                            </div>
                        )}
                        {activeTab === 'files' && (
                            <div style={{ flex: 1, backgroundColor: 'var(--bg-dark)', padding: '16px', overflowY: 'auto' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.1em' }}>Files Explorer</h3>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                                    <label style={{ cursor: 'pointer', opacity: 0.8, color: 'var(--text-main)', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }} title="Import File">
                                        <Plus size={14} /> Import File
                                        <input type="file" style={{ display: 'none' }} onChange={handleImportFile} />
                                    </label>
                                    <button style={{ color: 'var(--text-main)', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-card)', cursor: 'pointer' }} onClick={handleAddFile} title="New File">
                                        <Plus size={14} /> New File
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {files.map(file => (
                                        <div key={file.id} onClick={() => handleFileClick(file)} style={fileItemStyle(activeFile?.id === file.id)}>
                                            <FileCode size={14} />
                                            <span>{file.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeTab === 'chat' && (
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <ChatWindow socketRef={socketRef} roomId={`project-${projectId}`} userName={user?.name || guestName} isLightMode={isLightMode} isMobile={isMobile} messages={messages} setMessages={setMessages} />
                            </div>
                        )}
                        {activeTab === 'users' && (
                            <div style={{ flex: 1, backgroundColor: 'var(--bg-dark)', padding: '16px', overflowY: 'auto' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.1em' }}>Team Members ({clients.length})</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {clients.map((client, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                            <div style={miniAvatarStyle}>
                                                {(client.userName || client.name || 'U')[0].toUpperCase()}
                                            </div>
                                            <span style={{ fontSize: '13px', fontWeight: '600' }}>
                                                {client.userName || client.name} {client.name === (user?.name || guestName) && "(You)"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeTab === 'video' && (
                            <div style={{ flex: 1, backgroundColor: 'var(--bg-dark)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                <VideoChat
                                    socketRef={socketRef}
                                    projectId={projectId}
                                    user={user || { name: guestName || 'Guest', isGuest: true }}
                                    isMinimized={false}
                                    onMinimizeToggle={() => {}}
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
                ) : (
                    // DESKTOP WORKSPACE LAYOUT
                    <ReflexContainer orientation="vertical" style={{ flex: 1, height: '100%', minHeight: 0 }}>
                        {!isZenMode && isSidebarOpen && ['files', 'chat', 'users'].includes(sidebarTab) && (
                            <ReflexElement flex={0.18} minSize={250} style={{ 
                                height: '100%', 
                                minHeight: 0, 
                                backgroundColor: 'var(--bg-card)', 
                                borderRight: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <div style={sidebarHeaderStyle}>
                                    <span style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '0.12em', color: 'var(--primary)', textTransform: 'uppercase' }}>
                                        {sidebarTab === 'chat' ? 'Messages' : sidebarTab === 'users' ? 'Team' : sidebarTab}
                                    </span>
                                    {sidebarTab === 'files' && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <label style={{ cursor: 'pointer', opacity: 0.6 }} title="Import File">
                                                <FileText size={14} />
                                                <input type="file" style={{ display: 'none' }} onChange={handleImportFile} />
                                            </label>
                                            <Plus size={14} style={{ cursor: 'pointer', opacity: 0.6 }} onClick={handleAddFile} title="New File" />
                                        </div>
                                    )}
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, backgroundColor: 'var(--bg-card)' }}>
                                    {sidebarTab === 'files' && (
                                        <div style={{ padding: '8px' }}>
                                            {files.map(file => (
                                                <div key={file.id} onClick={() => handleFileClick(file)} style={fileItemStyle(activeFile?.id === file.id)}>
                                                    <FileCode size={13} />
                                                    <span style={{ fontSize: '12px' }}>{file.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {sidebarTab === 'chat' && <ChatWindow socketRef={socketRef} roomId={`project-${projectId}`} userName={user?.name || guestName} isLightMode={isLightMode} isMobile={isMobile} messages={messages} setMessages={setMessages} />}
                                    {sidebarTab === 'users' && (
                                        <div style={{ padding: '12px' }}>
                                            {clients.map((client, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '6px', marginBottom: '4px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                                    <div style={miniAvatarStyle}>
                                                        {(client.userName || client.name || 'U')[0].toUpperCase()}
                                                    </div>
                                                    <span style={{ fontSize: '12px', fontWeight: '500' }}>
                                                        {client.userName || client.name} {client.name === (user?.name || guestName) && "(You)"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </ReflexElement>
                        )}
                        
                        {!isZenMode && isSidebarOpen && ['files', 'chat', 'users'].includes(sidebarTab) && <ReflexSplitter style={splitterStyle} />}
                        
                        <ReflexElement flex={1} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div style={studioTabContainerStyle}>
                                {openFiles.map(file => (
                                    <div key={file.id} onClick={() => handleFileClick(file)} style={studioTabStyle(activeFile?.id === file.id, isLightMode)}>
                                        <FileText size={12} />
                                        <span>{file.name}</span>
                                        <button style={closeTabStyle} onClick={(e) => handleCloseTab(e, file.id)}><X size={10} /></button>
                                    </div>
                                ))}
                            </div>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <ReflexContainer orientation="horizontal">
                                    <ReflexElement flex={isOutputVisible ? 0.7 : 1}>
                                    {activeFile ? (
                                        <ProjectEditor 
                                            key={activeFile.id}
                                            socketRef={socketRef}
                                            roomId={`project-${projectId}`}
                                            fileId={activeFile.id}
                                            onCodeChange={handleSaveFile}
                                            code={activeFile.content}
                                            filename={activeFile.name}
                                            language={activeFile.name.split('.').pop()}
                                            settings={settings}
                                            userName={user?.name || guestName}
                                            isLightMode={isLightMode}
                                        />
                                    ) : (
                                        <div style={emptyEditorStyle}><Terminal size={48} style={{ opacity: 0.1 }} /></div>
                                    )}
                                    </ReflexElement>
                                    {isOutputVisible && <ReflexSplitter style={splitterStyle} />}
                                    {isOutputVisible && (
                                        <ReflexElement flex={0.4} style={{ backgroundColor: 'var(--bg-dark)' }}>
                                            {renderOutputPanel()}
                                        </ReflexElement>
                                    )}
                                </ReflexContainer>
                            </div>
                        </ReflexElement>
                    </ReflexContainer>
                )}
            </div>

            {/* Draggable Mini Video Floating Box (Mounted on call activate) */}
            {isMeetingActive && !isMobile && (
                <VideoChat
                    socketRef={socketRef}
                    projectId={projectId}
                    user={user || { name: guestName || 'Guest', isGuest: true }}
                    isMinimized={isMeetingMinimized}
                    onMinimizeToggle={(val) => setIsMeetingMinimized(val)}
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

            {/* Studio Footer */}
            <footer style={studioFooterStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        boxShadow: '0 0 6px rgba(16, 185, 129, 0.4)'
                    }} />
                    <span style={{ fontSize: '9px', fontWeight: '750', color: 'var(--text-muted)' }}>
                        {project?.type?.toUpperCase()} ENGINE
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '100%' }}>
                    <button
                        onClick={() => setIsOutputVisible(!isOutputVisible)}
                        title="Toggle Terminal"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: isOutputVisible ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Terminal size={14} />
                    </button>

                    <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

                    <button
                        onClick={handleCompile}
                        disabled={isExecuting}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '0 12px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            fontSize: '9px',
                            fontWeight: '900',
                            cursor: isExecuting ? 'wait' : 'pointer',
                            height: '20px',
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Play size={10} fill="currentColor" />
                        {isExecuting ? '...' : 'RUN'}
                    </button>
                </div>
            </footer>

            {/* Guest Entry Name Overlay Modal */}
            {showGuestModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999
                }}>
                    <div style={{
                        backgroundColor: 'var(--bg-card)',
                        padding: '32px',
                        borderRadius: '16px',
                        border: '1px solid var(--border-color)',
                        width: '360px',
                        boxShadow: '0 20px 45px rgba(0,0,0,0.5)',
                        textAlign: 'center'
                    }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: 'white' }}>Join Studio</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Please enter a display name to enter the workspace.</p>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (guestName.trim()) {
                                localStorage.setItem('guest-name', guestName.trim());
                                joinProject(guestName.trim());
                                setShowGuestModal(false);
                            }
                        }}>
                            <input
                                autoFocus
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    backgroundColor: 'var(--bg-dark)',
                                    border: '1px solid var(--border-color)',
                                    color: 'white',
                                    fontSize: '14px',
                                    marginBottom: '20px',
                                    outline: 'none',
                                    textAlign: 'center'
                                }}
                                placeholder="Enter Display Name"
                                required
                            />
                            <button type="submit" style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                fontWeight: '700',
                                cursor: 'pointer',
                                fontSize: '14px',
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                            }}>Join Workspace</button>
                        </form>
                    </div>
                </div>
            )}

            {/* v2.0 Modals */}
            <AICopilotModal
                isOpen={showAICopilot}
                onClose={() => setShowAICopilot(false)}
                code={activeFile?.content || ""}
                language={activeFile?.name?.endsWith('.py') ? 'python' : activeFile?.name?.endsWith('.cpp') ? 'cpp' : 'javascript'}
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
                onRestoreSnapshot={(snap) => {
                    if (snap.code) handleSaveFile(snap.code);
                }}
            />

            <AnalyticsDashboardModal
                isOpen={showAnalytics}
                onClose={() => setShowAnalytics(false)}
                projectId={projectId}
            />

            {/* Mobile Bottom Navigation Bar */}
            {isMobile && (
                <nav style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 500,
                    height: '56px', backgroundColor: 'var(--bg-card)',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
                    padding: '0 8px',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                }}>
                    <button
                        onClick={() => setActiveTab('code')}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', color: activeTab === 'code' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '8px', fontSize: '9px', fontWeight: '700', transition: 'all 0.2s' }}
                    >
                        <FileCode size={18} />
                        <span>Code</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('files')}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', color: activeTab === 'files' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '8px', fontSize: '9px', fontWeight: '700', transition: 'all 0.2s' }}
                    >
                        <Folder size={18} />
                        <span>Files</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('chat')}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', color: activeTab === 'chat' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '8px', fontSize: '9px', fontWeight: '700', transition: 'all 0.2s', position: 'relative' }}
                    >
                        <MessageSquare size={18} />
                        {messages.length > 0 && <div style={{ position: 'absolute', top: '6px', right: '50%', transform: 'translateX(8px)', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }} />}
                        <span>Chat</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '8px', fontSize: '9px', fontWeight: '700', transition: 'all 0.2s' }}
                    >
                        <Users size={18} />
                        <span>People</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('video')}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', color: activeTab === 'video' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '8px', fontSize: '9px', fontWeight: '700', transition: 'all 0.2s' }}
                    >
                        <Video size={18} />
                        <span>Meet</span>
                    </button>
                </nav>
            )}

            {/* Team Invite Modal */}
            <InviteModal
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                projectId={projectId}
                projectName={project?.name || "this project"}
                inviterName={user?.name || guestName}
            />

            {/* Whiteboard Modal */}
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
                <button 
                    onClick={() => setIsZenMode(false)}
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1000,
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '100px',
                        fontSize: '11px',
                        fontWeight: '900',
                        cursor: 'pointer',
                        boxShadow: '0 10px 25px rgba(59, 130, 246, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        letterSpacing: '0.05em'
                    }}
                >
                    <Eye size={14} /> EXIT ZEN MODE
                </button>
            )}

        </div>
    );
};

const logoWrapperStyle = {
    width: 'auto',
    minWidth: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s'
};


const sidebarHeaderStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-card)',
    height: '40px'
};


const fileItemStyle = (active) => ({
    padding: '10px 12px',
    borderRadius: '6px',
    marginBottom: '2px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: active ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-main)',
    transition: 'all 0.2s',
    border: active ? '1px solid rgba(59, 130, 246, 0.1)' : '1px solid transparent'
});

const studioTabContainerStyle = {
    height: '40px',
    backgroundColor: 'var(--bg-card)',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'flex-end',
    padding: '0 4px',
    overflowX: 'auto',
    gap: '4px'
};

const studioTabStyle = (active, isLight) => ({
    height: '34px',
    padding: '0 16px',
    backgroundColor: active ? (isLight ? '#fff' : '#0d1117') : 'transparent',
    border: '1px solid var(--border-color)',
    borderBottom: active ? (isLight ? '1px solid #fff' : '1px solid #0d1117') : '1px solid var(--border-color)',
    borderRadius: '4px 4px 0 0',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '11px',
    fontWeight: active ? '750' : '600',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    cursor: 'pointer',
    minWidth: '130px',
    zIndex: active ? 2 : 1,
    marginBottom: '-1px',
    transition: 'all 0.2s ease'
});

const studioFooterStyle = {
    height: '28px',
    backgroundColor: 'var(--bg-card)',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    fontSize: '9px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
};


const emptyEditorStyle = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d1117'
};

const splitterStyle = {
    backgroundColor: 'var(--border-color)',
    width: '1px',
    opacity: 0.5
};

const miniAvatarStyle = {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: '800',
    border: '2px solid var(--bg-card)'
};


const outputHeaderStyle = {
    padding: '8px 16px',
    backgroundColor: 'var(--bg-card)',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '10px',
    fontWeight: '800',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em'
};

const outputTextStyle = {
    padding: '16px',
    margin: 0,
    color: 'var(--text-main)',
    fontSize: '13px',
    lineHeight: '1.6',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    overflowY: 'auto',
    height: '100%',
    opacity: 0.95
};

const closeTabStyle = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
};




export default ProjectPage;
