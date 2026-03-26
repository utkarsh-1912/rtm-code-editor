import React, { useState, useEffect, useRef } from "react";
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
    Trash2,
    RotateCcw,
    Palette,
    ChevronRight,
    Square,
    Mic,
    MicOff,
    VideoOff,
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
        tabSize: 4,
        keybinding: "default",
        enableLinting: true,
        wordWrap: true
    });

    const [isSidebarVisible, setIsSidebarVisible] = useState(true);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [clients, setClients] = useState([]);
    const [guestName, setGuestName] = useState("");
    const [remoteCursors, setRemoteCursors] = useState({}); // { socketId: { userName, fileId } }
    const [showInviteModal, setShowInviteModal] = useState(false);


    // New Lobby States
    const [showLobby, setShowLobby] = useState(false);
    const [initialAudio, setInitialAudio] = useState(true);
    const [initialVideo, setInitialVideo] = useState(true);
    const lobbyVideoRef = useRef(null);
    const lobbyStreamRef = useRef(null);

    const [sidebarTab, setSidebarTab] = useState('files');
    const [theme, setTheme] = useState(localStorage.getItem("app-theme") || "dark");
    const [isExecuting, setIsExecuting] = useState(false);
    const [output, setOutput] = useState("");
    const [terminalTab, setTerminalTab] = useState('output');
    const [mediaStates, setMediaStates] = useState({});
    const [isOutputVisible, setIsOutputVisible] = useState(true);
    const [showPreview, setShowPreview] = useState(false);
    const [activeTab, setActiveTab] = useState('code'); // 'code', 'files', 'chat', 'users', 'video'
    const [userInput, setUserInput] = useState("");
    const [isMeetingMinimized, setIsMeetingMinimized] = useState(false); // false = no PiP until user explicitly minimizes an active call
    const [isMeetingStarting, setIsMeetingStarting] = useState(false);

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

    // --- Lobby Media Preview ---
    useEffect(() => {
        if (showLobby) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(stream => {
                    lobbyStreamRef.current = stream;
                    if (lobbyVideoRef.current) {
                        lobbyVideoRef.current.srcObject = stream;
                    }
                    setInitialAudio(true);
                    setInitialVideo(true);
                })
                .catch(err => {
                    console.error("Lobby camera error:", err);
                    setInitialAudio(false);
                    setInitialVideo(false);
                });
        } else {
            if (lobbyStreamRef.current) {
                lobbyStreamRef.current.getTracks().forEach(t => t.stop());
                lobbyStreamRef.current = null;
            }
        }
        return () => {
            if (lobbyStreamRef.current) {
                lobbyStreamRef.current.getTracks().forEach(t => t.stop());
                lobbyStreamRef.current = null;
            }
        };
    }, [showLobby]);

    const toggleLobbyAudio = () => {
        setInitialAudio(prev => {
            if (lobbyStreamRef.current) {
                lobbyStreamRef.current.getAudioTracks().forEach(t => t.enabled = !prev);
            }
            return !prev;
        });
    };

    const toggleLobbyVideo = () => {
        setInitialVideo(prev => {
            if (lobbyStreamRef.current) {
                lobbyStreamRef.current.getVideoTracks().forEach(t => t.enabled = !prev);
            }
            return !prev;
        });
    };

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
                    setShowPreview(true);
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
                socketRef.current.on(ACTIONS.CURSOR_MOVE, ({ socketId, fileId, userName: remoteName }) => {
                    if (fileId) {
                        setRemoteCursors(prev => ({ ...prev, [socketId]: { userName: remoteName, fileId } }));
                    }
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

                // Show Lobby instead of directly joining
                setShowLobby(true);

                // Load chat history from localstorage
                const savedChat = localStorage.getItem(`project-chat-${projectId}`);
                if (savedChat) {
                    setMessages(JSON.parse(savedChat));
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

    const toggleTheme = () => {
        const newTheme = theme === "dark" ? "light" : "dark";
        setTheme(newTheme);
        localStorage.setItem("app-theme", newTheme);
        if (newTheme === "light") {
            document.documentElement.classList.add("light-theme");
        } else {
            document.documentElement.classList.remove("light-theme");
        }
    };

    const handleLobbyJoin = (e) => {
        if (e) e.preventDefault();
        if (!user && !guestName.trim()) {
            toast.error("Please enter a display name to join.");
            return;
        }
        setShowLobby(false);
        joinProject(user ? user.name : guestName.trim());
    };

    const handleFileClick = (file) => {
        setActiveFile(file);
        if (!openFiles.find(f => f.id === file.id)) {
            setOpenFiles([...openFiles, file]);
        }
        if (isMobile) setActiveTab('code');
    };

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

    const handleDeleteFile = async (e, file) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete ${file.name}?`)) return;

        try {
            const backendUrl = getBackendUrl();
            const res = await fetch(`${backendUrl}/api/projects/${projectId}/files?path=${encodeURIComponent(file.path)}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error("Failed to delete file");

            setFiles(prev => {
                const updated = prev.filter(f => f.id !== file.id);
                if (activeFile?.id === file.id) {
                    setActiveFile(updated.length > 0 ? updated[0] : null);
                }
                return updated;
            });
            setOpenFiles(prev => prev.filter(f => f.id !== file.id));

            socketRef.current.emit(ACTIONS.FILE_CHANGE, {
                roomId: `project-${projectId}`,
                fileId: file.id,
                isDeleted: true
            });

            toast.success("File deleted");
        } catch (err) {
            toast.error("Error deleting file");
        }
    };

    const handleResetFile = async (file) => {
        if (!window.confirm(`Reset ${file.name} to default content? This will overwrite your changes.`)) return;

        const type = project?.type || "web";
        let defaultContent = "";

        if (type === "web") {
            if (file.name === 'index.html') defaultContent = '<!DOCTYPE html>\n<html>\n<head>\n  <title>New Project</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>';
            else if (file.name === 'style.css') defaultContent = 'body {\n  background-color: #f0f0f0;\n  font-family: sans-serif;\n}';
            else if (file.name === 'script.js') defaultContent = 'console.log("Hello from script.js");';
        } else if (type === "cpp") {
            if (file.name === 'main.cpp') defaultContent = '#include <iostream>\n\nint main() {\n    std::cout << "Hello RTM Studio!" << std::endl;\n    return 0;\n}';
            else if (file.name === 'utils.h') defaultContent = '// Utility functions\n#ifndef UTILS_H\n#define UTILS_H\n\nvoid greet();\n\n#endif';
        } else if (type === "python") {
            if (file.name === 'main.py') defaultContent = 'def main():\n    print("Hello from RTM Studio!")\n\nif __name__ == "__main__":\n    main()';
        } else if (type === "java") {
            if (file.name === 'Main.java') defaultContent = 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}';
        }

        if (!defaultContent) {
            toast.error("No default content for this file.");
            return;
        }

        try {
            const backendUrl = getBackendUrl();
            await fetch(`${backendUrl}/api/projects/${projectId}/files`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId: file.id, content: defaultContent })
            });

            setFiles(prev => prev.map(f => f.id === file.id ? { ...f, content: defaultContent } : f));
            if (activeFile?.id === file.id) setActiveFile({ ...activeFile, content: defaultContent });

            socketRef.current.emit(ACTIONS.FILE_CHANGE, {
                roomId: `project-${projectId}`,
                fileId: file.id,
                content: defaultContent,
                socketId: socketRef.current.id
            });
            toast.success("File reset to default");
        } catch (err) {
            toast.error("Failed to reset file");
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

    const handleCompile = async () => {
        const projectType = project?.type || "web";
        if (projectType === "web") {
            setShowPreview(true);
            setIsOutputVisible(true);
            return;
        }

        setIsExecuting(true);
        setIsOutputVisible(true);
        setTerminalTab('output');
        setOutput("Bundling and running...");

        const language = activeFile?.name.split('.').pop();
        let languageId = 63;
        if (language === 'cpp' || language === 'h') languageId = 54;
        else if (language === 'py') languageId = 71;
        else if (language === 'java') languageId = 62;

        let sourceCode = activeFile.content;

        if (language === 'cpp' || language === 'h') {
            const visited = new Set([activeFile.name]);
            const resolveIncludes = (content) => {
                return content.replace(/#include\s*"(.*?)"/g, (match, fileName) => {
                    if (visited.has(fileName)) return `// Already included: ${fileName}`;
                    const includedFile = files.find(f => f.name === fileName);
                    if (includedFile) {
                        visited.add(fileName);
                        return `// Included from ${fileName}\n${resolveIncludes(includedFile.content)}`;
                    }
                    return match;
                });
            };
            sourceCode = resolveIncludes(sourceCode);
        } else if (language === 'java') {
            const visited = new Set([activeFile.name]);
            const resolveJavaImports = (code) => {
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
            };

            sourceCode = resolveJavaImports(activeFile.content);
            // Append any other java files not explicitly imported
            files.filter(f => f.name.endsWith('.java') && !visited.has(f.name)).forEach(f => {
                visited.add(f.name);
                const cleanContent = f.content.replace(/public\s+class/g, 'class').replace(/^package\s+.*?;/gm, '');
                sourceCode += `\n\n// From ${f.name}\n${resolveJavaImports(cleanContent)}`;
            });
        } else if (language === 'py') {
            const visited = new Set([activeFile.name]);
            const resolvePythonImports = (content) => {
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
            };
            sourceCode = resolvePythonImports(sourceCode);
        }

        const formData = {
            language_id: languageId,
            source_code: btoa(sourceCode),
            stdin: btoa(userInput || ""),
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
    };

    const pollExecutionResult = async (token) => {
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
                setTimeout(() => pollExecutionResult(token), 2000);
                return;
            } else {
                setIsExecuting(false);
                const decodedOutput = data.stdout ? atob(data.stdout) : null;
                const decodedError = data.stderr ? atob(data.stderr) : null;
                const decodedCompileOutput = data.compile_output ? atob(data.compile_output) : null;

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
    };

    const generatePreviewDoc = () => {
        let html = files.find(f => f.name === 'index.html')?.content || '';
        const css = files.find(f => f.name === 'style.css')?.content || '';
        const js = files.find(f => f.name === 'script.js')?.content || '';

        // Strip tags that might cause 404s since we are inlining
        html = html.replace(/<script\s+src=["']script\.js["']\s*><\/script>/gi, '');
        html = html.replace(/<link\s+rel=["']stylesheet["']\s+href=["']style\.css["']\s*\/?>/gi, '');

        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <style>${css}</style>
                </head>
                <body>
                    ${html}
                    <script>${js}</script>
                </body>
            </html>
        `;
    };

    if (loading) {
        return (
            <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-dark)", color: "white" }}>
                <LogoLoader message="Initialising Project Workspace..." />
            </div>
        );
    }

    return (
        <div className="project-workspace">
            {/* Redesigned IDE-style Navbar */}
            <header className="studio-header">
                {/* Left Section: Branding & Project Meta */}
                <div className="header-left">
                    <div style={logoWrapperStyle} onClick={() => navigate('/dashboard')}>
                        <img
                            src={isMobile
                                ? (isLightMode ? "/utkristi-labs.png" : "/utkristi-labs-dark.png")
                                : (isLightMode ? "/utkristi-colabs.png" : "/utkristi-colabs-dark.png")
                            }
                            alt="Logo"
                            style={{ height: isMobile ? '24px' : '26px', objectFit: 'contain' }}
                        />
                    </div>
                    <div style={{ width: '1px', height: '28px', backgroundColor: 'var(--border-color)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: '13px',
                                fontWeight: '900',
                                color: 'var(--text-main)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '150px'
                            }}>
                                {project ? project.name : "UNTITLED PROJECT"}
                            </h2>
                            <span style={statusBadgeStyle}>LIVE</span>
                        </div>
                        <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.05em', opacity: 0.8 }}>RTM STUDIO</span>
                    </div>
                </div>

                {isMobile && (
                    <div style={{ display: 'flex', gap: '8px', marginRight: '8px' }}>
                        <button 
                            className="tray-btn" 
                            onClick={() => setShowWhiteboard(true)} 
                            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: 'white' }}
                        >
                            <Palette size={16} />
                        </button>
                        <button 
                            className="tray-btn" 
                            onClick={toggleTheme}
                            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: 'white' }}
                        >
                            {isLightMode ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                    </div>
                )}

                {/* Center Section: Active File Display (VS Code Style) */}
                <div className="header-center">
                    <span style={{ opacity: 0.5 }}>{project?.type || 'Web'}</span>
                    <ChevronRight size={10} style={{ opacity: 0.3 }} />
                    {activeFile ? (
                        <div className="active-file-pill">
                            <FileCode size={12} color="var(--primary)" />
                            <span>{activeFile.name}</span>
                        </div>
                    ) : (
                        <span style={{ opacity: 0.5 }}>Workspace Editor</span>
                    )}
                </div>

                {/* Right Section: Unified Icon Tray & Actions */}
                <div className="header-right">
                    {!isMobile && (
                        <div style={{ ...collaboratorAvatarsStyle, marginRight: '4px' }}>
                            {clients.slice(0, 3).map((client, i) => (
                                <div key={i} style={{ ...miniAvatarStyle, marginLeft: i > 0 ? '-8px' : '0' }} title={client.userName}>
                                    {(client.userName || 'U')[0]}
                                </div>
                            ))}
                            {clients.length > 3 && (
                                <div style={{ ...miniAvatarStyle, marginLeft: '-8px', backgroundColor: 'var(--bg-dark)', fontSize: '8px' }}>
                                    +{clients.length - 3}
                                </div>
                            )}
                        </div>
                    )}

                    {!isMobile && (
                        <div className="icon-tray">
                            <button
                                className={`tray-btn ${sidebarTab === 'video' ? 'active' : ''}`}
                                onClick={() => {
                                    setSidebarTab('video');
                                    setIsMeetingMinimized(false);
                                }}
                                title="Streaming View"
                            >
                                <Video size={16} />
                            </button>
                            <div style={trayIconsStyle}>
                                <button
                                    style={{
                                        ...toolRunButtonStyle,
                                        width: '32px',
                                        height: '32px',
                                        padding: '0',
                                        borderRadius: '8px',
                                        background: isExecuting ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                        color: isExecuting ? '#ef4444' : '#3b82f6',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: '8px'
                                    }}
                                    onClick={isExecuting ? () => setIsExecuting(false) : handleCompile}
                                    title={isExecuting ? "Stop Running" : "Run Code"}
                                >
                                    {isExecuting ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                </button>
                                <button className="tray-btn" onClick={() => setShowWhiteboard(true)} title="Whiteboard">
                                    <Palette size={16} />
                                </button>
                                <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 8px 0 0' }} />
                                <button
                                    className={`tray-btn ${sidebarTab === 'files' ? 'active' : ''}`}
                                    onClick={() => {
                                        if (sidebarTab === 'video' && isMeetingStarting) setIsMeetingMinimized(true);
                                        if (sidebarTab === 'files' && isSidebarVisible) {
                                            setIsSidebarVisible(false);
                                        } else {
                                            setSidebarTab('files');
                                            setIsSidebarVisible(true);
                                        }
                                    }}
                                    title="File Explorer"
                                >
                                    <Folder size={16} />
                                </button>
                                <button
                                    className={`tray-btn ${sidebarTab === 'chat' ? 'active' : ''}`}
                                    onClick={() => {
                                        if (sidebarTab === 'video' && isMeetingStarting) setIsMeetingMinimized(true);
                                        if (sidebarTab === 'chat' && isSidebarVisible) {
                                            setIsSidebarVisible(false);
                                        } else {
                                            setSidebarTab('chat');
                                            setIsSidebarVisible(true);
                                        }
                                    }}
                                    title="Team Chat"
                                >
                                    <div style={{ position: 'relative' }}>
                                        <MessageSquare size={16} />
                                        {messages.length > 0 && <div style={{ ...notifDotStyle, top: '-2px', right: '-2px', width: '6px', height: '6px' }} />}
                                    </div>
                                </button>
                                <button
                                    className={`tray-btn ${sidebarTab === 'users' ? 'active' : ''}`}
                                    onClick={() => {
                                        if (sidebarTab === 'video' && isMeetingStarting) setIsMeetingMinimized(true);
                                        if (sidebarTab === 'users' && isSidebarVisible) {
                                            setIsSidebarVisible(false);
                                        } else {
                                            setSidebarTab('users');
                                            setIsSidebarVisible(true);
                                        }
                                    }}
                                    title="People"
                                >
                                    <Users size={16} />
                                </button>
                                <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 2px' }} />
                                <button className="tray-btn" onClick={toggleTheme} title="Toggle Theme">
                                    {isLightMode ? <Sun size={16} /> : <Moon size={16} />}
                                </button>
                            </div>
                        </div>
                    )}


                    {!isMobile && (
                        <button className="share-button" style={{
                            ...shareButtonStyle,
                            padding: '8px 16px',
                            borderRadius: '8px'
                        }} onClick={() => setShowInviteModal(true)}>
                            <Users size={14} /> <span>Invite</span>
                        </button>
                    )}
                </div>
            </header>

            <div className="workspace-container">
                <div className="workspace-content" style={{ flex: 1, height: '100%', minHeight: 0, position: 'relative', display: 'flex', overflow: 'hidden' }}>
                    {/* Switch between full-screen mobile views or standard desktop split */}
                    {isMobile && activeTab !== 'code' ? (
                        <div style={{ flex: 1, height: '100%', backgroundColor: 'var(--bg-dark)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ ...sidebarHeaderStyle, backgroundColor: 'var(--bg-card)', height: '48px', padding: '0 20px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '0.1em', color: 'var(--text-main)', textTransform: 'uppercase' }}>
                                    {activeTab}
                                </span>
                                {activeTab === 'files' && (
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <label style={{ cursor: 'pointer', opacity: 0.8 }} title="Import File">
                                            <FileText size={16} />
                                            <input type="file" style={{ display: 'none' }} onChange={handleImportFile} />
                                        </label>
                                        <Plus size={16} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={handleAddFile} title="New File" />
                                    </div>
                                )}
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {activeTab === 'files' && (
                                    <div style={{ padding: '12px' }}>
                                        {files.map(file => {
                                            const editingUsersM = Object.values(remoteCursors).filter(c => c.fileId === file.id);
                                            return (
                                                <div
                                                    key={file.id}
                                                    onClick={() => handleFileClick(file)}
                                                    style={fileItemStyle(activeFile?.id === file.id)}
                                                    className="file-item-hover"
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                                        <FileCode size={16} opacity={0.7} color={activeFile?.id === file.id ? 'var(--primary)' : 'inherit'} />
                                                        <span style={{ fontSize: '14px', fontWeight: activeFile?.id === file.id ? '700' : '500' }}>{file.name}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                        {editingUsersM.map((u, idx) => (
                                                            <div key={idx} title={`${u.userName} editing`} style={{
                                                                width: '18px', height: '18px', borderRadius: '50%',
                                                                backgroundColor: `hsl(${(u.userName.charCodeAt(0) * 47) % 360}, 70%, 50%)`,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '9px', fontWeight: '700', color: 'white'
                                                            }}>
                                                                {u.userName[0]?.toUpperCase()}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {activeTab === 'chat' && (
                                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                                        <ChatWindow
                                            socketRef={socketRef}
                                            roomId={`project-${projectId}`}
                                            userName={user?.name || socketRef.current?.userName || 'Guest'}
                                            isLightMode={isLightMode}
                                            isMobile={true}
                                            messages={messages}
                                            setMessages={setMessages}
                                        />
                                    </div>
                                )}

                                {activeTab === 'users' && (
                                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {clients.map((client, i) => {
                                            const isMe = client.socketId === socketRef.current?.id;
                                            const isCreator = i === 0;
                                            const isGuestUser = !client.userName || client.userName === 'Guest';
                                            const role = isCreator ? 'Admin' : isGuestUser ? 'Guest' : 'Member';
                                            const roleColor = isCreator ? '#fbbf24' : isGuestUser ? '#94a3b8' : 'var(--primary)';
                                            return (
                                                <div key={client.socketId || i} style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px',
                                                    padding: '12px', borderRadius: '10px',
                                                    backgroundColor: 'var(--bg-card)',
                                                    border: isMe ? '1px solid var(--primary)' : '1px solid var(--border-color)'
                                                }}>
                                                    {isMe && user?.photoURL ? (
                                                        <img src={user.photoURL} alt="avatar" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div style={{
                                                            width: '38px', height: '38px', borderRadius: '50%',
                                                            background: `linear-gradient(135deg, hsl(${( (client.userName?.[0]?.charCodeAt(0) || i || 0) * 47) % 360}, 70%, 45%), hsl(${( (client.userName?.[0]?.charCodeAt(0) || i || 0) * 47 + 60) % 360}, 70%, 35%))`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '15px', fontWeight: '800', color: 'white', flexShrink: 0
                                                        }}>
                                                            {client.userName?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
                                                            {client.userName} {isMe && <span style={{ opacity: 0.4, fontSize: '11px' }}>(you)</span>}
                                                        </div>
                                                        <div style={{ fontSize: '10px', color: roleColor, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{role}</div>
                                                    </div>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {activeTab === 'video' && (
                                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                                        <VideoChat
                                            socketRef={socketRef}
                                            projectId={projectId}
                                            user={user || { name: socketRef.current?.userName || "Guest", isGuest: true }}
                                            isMinimized={false}
                                            onMinimizeToggle={(v) => { if (v) setActiveTab('code'); setIsMeetingMinimized(v); }}
                                            externalInCall={isMeetingStarting}
                                            onCallStateChange={setIsMeetingStarting}
                                            clients={clients}
                                            mediaStates={mediaStates}
                                            initialAudioState={initialAudio}
                                            initialVideoState={initialVideo}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        ) : (
                            <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                                {sidebarTab === 'video' ? (
                                    <VideoChat
                                        socketRef={socketRef}
                                        projectId={projectId}
                                        user={user || { name: socketRef.current?.userName || "Guest", isGuest: true }}
                                        isMinimized={false}
                                        onMinimizeToggle={(v) => { 
                                            if (v) setSidebarTab('files'); 
                                            setIsMeetingMinimized(v); 
                                        }}
                                        externalInCall={isMeetingStarting}
                                        onCallStateChange={setIsMeetingStarting}
                                        clients={clients}
                                        mediaStates={mediaStates}
                                        initialAudioState={initialAudio}
                                        initialVideoState={initialVideo}
                                    />
                                ) : (
                                    <ReflexContainer orientation="vertical" style={{ flex: 1, height: '100%', minHeight: 0 }}>
                                        {!isMobile && isSidebarVisible && ['files', 'chat', 'users'].includes(sidebarTab) && (
                                            <ReflexElement flex={0.2} minSize={250} style={{ height: '100%', minHeight: 0, backgroundColor: 'var(--bg-card)', borderRight: '1px solid var(--border-color)' }}>
                                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                                    <div style={sidebarHeaderStyle}>
                                                        <span style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.1em', color: 'var(--primary)', textTransform: 'uppercase' }}>
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

                                                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                                        {sidebarTab === 'files' && (
                                                            <div style={{ padding: '8px' }}>
                                                                {files.map(file => {
                                                                    const editingUsers = Object.values(remoteCursors).filter(c => c.fileId === file.id);
                                                                    return (
                                                                        <div
                                                                            key={file.id}
                                                                            onClick={() => handleFileClick(file)}
                                                                            style={fileItemStyle(activeFile?.id === file.id)}
                                                                            className="file-item-hover"
                                                                        >
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                                                                <FileCode size={13} opacity={0.6} color={activeFile?.id === file.id ? 'var(--primary)' : 'inherit'} />
                                                                                <span style={{ fontSize: '12px', fontWeight: activeFile?.id === file.id ? '700' : '500' }}>{file.name}</span>
                                                                            </div>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                                {editingUsers.map((u, idx) => (
                                                                                    <div key={idx} title={`${u.userName} is editing`} style={{
                                                                                        width: '16px', height: '16px', borderRadius: '50%',
                                                                                        backgroundColor: `hsl(${( (u.userName?.charCodeAt(0) || 0) * 47) % 360}, 70%, 50%)`,
                                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                        fontSize: '8px', fontWeight: '700', color: 'white',
                                                                                        border: '1px solid var(--bg-card)'
                                                                                    }}>
                                                                                        {u.userName?.[0]?.toUpperCase() || '?'}
                                                                                    </div>
                                                                                ))}
                                                                                <div style={{ display: 'flex', gap: '4px', opacity: 0, transition: 'opacity 0.2s' }} className="file-actions">
                                                                                    <RotateCcw
                                                                                        size={12}
                                                                                        style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                                                                                        onClick={(e) => { e.stopPropagation(); handleResetFile(file); }}
                                                                                        title="Reset to Default"
                                                                                    />
                                                                                    <Trash2
                                                                                        size={12}
                                                                                        style={{ cursor: 'pointer', color: '#f87171' }}
                                                                                        onClick={(e) => handleDeleteFile(e, file)}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {sidebarTab === 'chat' && (
                                                            <ChatWindow
                                                                socketRef={socketRef}
                                                                roomId={`project-${projectId}`}
                                                                userName={user?.name || socketRef.current?.userName || 'Guest'}
                                                                isLightMode={isLightMode}
                                                                isMobile={isMobile}
                                                                messages={messages}
                                                                setMessages={setMessages}
                                                            />
                                                        )}

                                                        {sidebarTab === 'users' && (
                                                            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                {clients.map((client, i) => {
                                                                    const isMe = client.socketId === socketRef.current?.id;
                                                                    const isCreator = project?.created_by && (client.userId === project.created_by || i === 0);
                                                                    const isGuest = !client.userName || client.userName === 'Guest' || client.isGuest;
                                                                    const role = isCreator ? 'Admin' : isGuest ? 'Guest' : 'Member';
                                                                    const roleBgColor = isCreator ? 'rgba(251,191,36,0.15)' : isGuest ? 'rgba(148,163,184,0.15)' : 'rgba(99,102,241,0.15)';
                                                                    const roleColor = isCreator ? '#fbbf24' : isGuest ? '#94a3b8' : 'var(--primary)';

                                                                    return (
                                                                        <div key={client.socketId} style={{
                                                                            display: 'flex', alignItems: 'center', gap: '12px',
                                                                            padding: '10px 12px', borderRadius: '10px',
                                                                            backgroundColor: 'var(--bg-card)',
                                                                            border: isMe ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                                            transition: 'all 0.2s'
                                                                        }}>
                                                                            {isMe && user?.photoURL ? (
                                                                                <img src={user.photoURL} alt="avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                                                                            ) : (
                                                                                <div style={{
                                                                                    width: '36px', height: '36px', borderRadius: '50%',
                                                                                    background: `linear-gradient(135deg, hsl(${( (client.userName?.[0]?.charCodeAt(0) || i || 0) * 47) % 360}, 70%, 45%), hsl(${( (client.userName?.[0]?.charCodeAt(0) || i || 0) * 47 + 60) % 360}, 70%, 35%))`,
                                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                    fontSize: '14px', fontWeight: '800', color: 'white',
                                                                                    border: isMe ? '2px solid var(--primary)' : '2px solid var(--border-color)',
                                                                                    flexShrink: 0
                                                                                }}>
                                                                                    {client.userName?.[0]?.toUpperCase() || '?'}
                                                                                </div>
                                                                            )}

                                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                                                                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                        {client.userName} {isMe && <span style={{ opacity: 0.5, fontWeight: '400', fontSize: '11px' }}>(you)</span>}
                                                                                    </span>
                                                                                </div>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <span style={{ fontSize: '9px', fontWeight: '800', backgroundColor: roleBgColor, color: roleColor, padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                                                                        {role}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.5)', flexShrink: 0 }} />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </ReflexElement>
                                        )}

                                        {isSidebarVisible && ['files', 'chat', 'users'].includes(sidebarTab) && <ReflexSplitter style={splitterStyle} />}

                                        <ReflexElement flex={isSidebarVisible && ['files', 'chat', 'users'].includes(sidebarTab) ? 0.8 : 1} minSize={400} style={{ height: '100%' }}>
                                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0d1117' }}>
                                                <div style={studioTabContainerStyle}>
                                                    {openFiles.map(file => (
                                                        <div key={file.id} onClick={() => handleFileClick(file)} style={studioTabStyle(activeFile?.id === file.id, isLightMode)}>
                                                            <FileText size={12} opacity={0.7} />
                                                            <span>{file.name}</span>
                                                            <button style={closeTabStyle} onClick={(e) => handleCloseTab(e, file.id)}><X size={10} /></button>
                                                        </div>
                                                    ))}
                                                    {openFiles.length === 0 && <div style={{ height: '36px' }} />}
                                                </div>
                                                <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                                                    <ReflexContainer orientation="horizontal" style={{ flex: 1, minHeight: 0 }}>
                                                        <ReflexElement flex={isOutputVisible ? 0.6 : 1} minSize={120} style={{ overflow: 'hidden' }}>
                                                            {activeFile ? (
                                                                <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
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
                                                                        userName={user?.name || socketRef.current?.userName}
                                                                        isLightMode={isLightMode}
                                                                        userInput={userInput}
                                                                        setUserInput={setUserInput}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div style={emptyEditorStyle}>
                                                                    <Terminal size={48} style={{ opacity: 0.05, marginBottom: '20px' }} />
                                                                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', letterSpacing: '0.1em' }}>SELECT A MODULE TO BEGIN</p>
                                                                </div>
                                                            )}
                                                        </ReflexElement>

                                                        {isOutputVisible && (
                                                            <ReflexSplitter style={{
                                                                ...splitterStyle,
                                                                height: '6px',
                                                                width: '100%',
                                                                cursor: 'row-resize',
                                                                backgroundColor: 'var(--border-color)',
                                                                borderTop: '1px solid rgba(255,255,255,0.04)',
                                                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                                transition: 'background-color 0.15s',
                                                            }} />
                                                        )}

                                                        {isOutputVisible && (
                                                            <ReflexElement flex={0.4} minSize={80} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                                                <div style={{ ...outputPaneStyle, flex: 1, height: '100%' }}>
                                                                    <div style={outputHeaderStyle}>
                                                                        <span>{project?.type === 'web' ? 'LIVE PREVIEW' : (showPreview ? 'Live Preview' : 'Terminal Output')}</span>
                                                                        <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }} onClick={() => { setIsOutputVisible(false); setShowPreview(false); }}>
                                                                            <X size={14} />
                                                                        </button>
                                                                    </div>
                                                                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
                                                                        {showPreview ? (
                                                                            <iframe
                                                                                title="Preview"
                                                                                style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                                                                                srcDoc={generatePreviewDoc()}
                                                                            />
                                                                        ) : (
                                                                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                                                                <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', height: '28px' }}>
                                                                                    <button
                                                                                        onClick={() => setTerminalTab('output')}
                                                                                        style={{
                                                                                            padding: '0 16px',
                                                                                            height: '100%',
                                                                                            backgroundColor: terminalTab === 'output' ? 'rgba(255,255,255,0.05)' : 'transparent',
                                                                                            border: 'none',
                                                                                            borderBottom: terminalTab === 'output' ? '2px solid var(--primary)' : 'none',
                                                                                            color: terminalTab === 'output' ? 'var(--primary)' : 'var(--text-muted)',
                                                                                            fontSize: '9px',
                                                                                            fontWeight: '800',
                                                                                            cursor: 'pointer',
                                                                                            textTransform: 'uppercase',
                                                                                            letterSpacing: '0.05em'
                                                                                        }}
                                                                                    >
                                                                                        OUTPUT
                                                                                    </button>
                                                                                    {project?.type !== 'web' && (
                                                                                        <button
                                                                                            onClick={() => setTerminalTab('input')}
                                                                                            style={{
                                                                                                padding: '0 16px',
                                                                                                height: '100%',
                                                                                                backgroundColor: terminalTab === 'input' ? 'rgba(255,255,255,0.05)' : 'transparent',
                                                                                                border: 'none',
                                                                                                borderBottom: terminalTab === 'input' ? '2px solid var(--primary)' : 'none',
                                                                                                color: terminalTab === 'input' ? 'var(--primary)' : 'var(--text-muted)',
                                                                                                fontSize: '9px',
                                                                                                fontWeight: '800',
                                                                                                cursor: 'pointer',
                                                                                                textTransform: 'uppercase',
                                                                                                letterSpacing: '0.05em'
                                                                                            }}
                                                                                        >
                                                                                            INPUT (STDIN)
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
                                                                                    {terminalTab === 'output' ? (
                                                                                        <pre style={outputTextStyle}>{output}</pre>
                                                                                    ) : (
                                                                                        <textarea
                                                                                            value={userInput}
                                                                                            onChange={(e) => setUserInput(e.target.value)}
                                                                                            placeholder="Enter program input here..."
                                                                                            style={{
                                                                                                width: '100%',
                                                                                                height: '100%',
                                                                                                backgroundColor: 'transparent',
                                                                                                border: 'none',
                                                                                                color: '#d1d5db',
                                                                                                padding: '12px',
                                                                                                fontSize: '12px',
                                                                                                fontFamily: 'monospace',
                                                                                                outline: 'none',
                                                                                                resize: 'none',
                                                                                                display: 'block'
                                                                                            }}
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </ReflexElement>
                                                        )}
                                                    </ReflexContainer>
                                                </div>
                                            </div>
                                        </ReflexElement>
                                    </ReflexContainer>
                                )}
                            </div>
                        )
                    }
                </div>

                {showLobby && (
                    <div style={modalOverlayStyle}>
                        <div style={{ ...modalContentStyle, maxWidth: '600px', padding: '30px' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', color: 'white' }}>Join Studio</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Configure your media before entering.</p>
                            
                            <div style={{ display: 'flex', gap: '24px', flexDirection: isMobile ? 'column' : 'row' }}>
                                {/* Media Preview Column */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ 
                                        width: '100%', aspectRatio: '16/9', backgroundColor: '#000', 
                                        borderRadius: '12px', overflow: 'hidden', position: 'relative',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        <video 
                                            autoPlay 
                                            muted 
                                            playsInline 
                                            ref={lobbyVideoRef} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: initialVideo ? 1 : 0 }} 
                                        />
                                        {!initialVideo && (
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f2937' }}>
                                                <VideoOff size={48} color="#4b5563" />
                                            </div>
                                        )}
                                        
                                        <div style={{ position: 'absolute', bottom: '12px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                            <button 
                                                onClick={toggleLobbyAudio}
                                                style={{
                                                    width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                                                    backgroundColor: initialAudio ? 'rgba(0,0,0,0.6)' : '#ef4444',
                                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                                    backdropFilter: 'blur(4px)', transition: 'all 0.2s'
                                                }}
                                            >
                                                {initialAudio ? <Mic size={18} /> : <MicOff size={18} />}
                                            </button>
                                            <button 
                                                onClick={toggleLobbyVideo}
                                                style={{
                                                    width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                                                    backgroundColor: initialVideo ? 'rgba(0,0,0,0.6)' : '#ef4444',
                                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                                    backdropFilter: 'blur(4px)', transition: 'all 0.2s'
                                                }}
                                            >
                                                {initialVideo ? <Video size={18} /> : <VideoOff size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Auth/Guest Form Column */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    {user ? (
                                        <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                                            <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.name}&background=0D8ABC&color=fff`} alt="Avatar" style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '12px', border: '3px solid var(--primary)' }} />
                                            <h3 style={{ margin: 0, fontSize: '18px', color: 'white' }}>{user.name}</h3>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{user.email}</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleLobbyJoin} style={{ marginBottom: '20px', textAlign: 'left' }}>
                                            <label style={{ display: 'block', textAlign: 'left', marginBottom: '8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Join as Guest</label>
                                            <input
                                                autoFocus
                                                value={guestName}
                                                onChange={(e) => setGuestName(e.target.value)}
                                                style={modalInputStyle}
                                                placeholder="Enter Display Name"
                                                required
                                            />
                                        </form>
                                    )}
                                    <button onClick={handleLobbyJoin} style={modalButtonStyle}>Join Studio</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <WhiteboardModal
                    isOpen={showWhiteboard}
                    onClose={() => setShowWhiteboard(false)}
                    socketRef={socketRef}
                    roomId={projectId}
                    user={user || { name: socketRef.current?.userName || "Guest" }}
                />

            </div>

            {/* Minimal Studio Footer */}
            <footer style={studioFooterStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        boxShadow: '0 0 6px rgba(16, 185, 129, 0.4)'
                    }} />
                    <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)' }}>
                        {project?.type?.toUpperCase()} ENGINE
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '100%' }}>
                    {/* Always-on conferencing (no leave button) */}

                    <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

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
                            padding: '0 10px',
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

            {/* Video PiP Overlay — shown when minimized and user has joined */}
            {!showLobby && hasJoinedRef.current && isMeetingMinimized && (
                <VideoChat
                    socketRef={socketRef}
                    projectId={projectId}
                    user={user || { name: socketRef.current?.userName, isGuest: true }}
                    isMinimized={true}
                    onMinimizeToggle={(val) => {
                        setIsMeetingMinimized(val);
                        if (!val) {
                            if (isMobile) setActiveTab('video');
                            else setSidebarTab('video');
                        }
                    }}
                    externalInCall={isMeetingStarting}
                    onCallStateChange={setIsMeetingStarting}
                    clients={clients}
                    mediaStates={mediaStates}
                    initialAudioState={initialAudio}
                    initialVideoState={initialVideo}
                />
            )}

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
                        onClick={() => {
                            if (activeTab === 'video' && isMeetingStarting) setIsMeetingMinimized(true);
                            setActiveTab('code');
                        }}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', color: activeTab === 'code' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '8px', fontSize: '9px', fontWeight: '700', transition: 'all 0.2s' }}
                    >
                        <FileCode size={18} />
                        <span>Code</span>
                    </button>
                    <button
                        onClick={() => {
                            if (activeTab === 'video' && isMeetingStarting) setIsMeetingMinimized(true);
                            setActiveTab('files');
                        }}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', color: activeTab === 'files' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '8px', fontSize: '9px', fontWeight: '700', transition: 'all 0.2s' }}
                    >
                        <Folder size={18} />
                        <span>Files</span>
                    </button>
                    <button
                        onClick={() => {
                            if (activeTab === 'video' && isMeetingStarting) setIsMeetingMinimized(true);
                            setActiveTab('chat');
                        }}
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
                        onClick={() => {
                            setIsMeetingMinimized(false);
                            setActiveTab('video');
                        }}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', color: activeTab === 'video' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '8px', fontSize: '9px', fontWeight: '700', transition: 'all 0.2s' }}
                    >
                        <Video size={18} />
                        <span>Meet</span>
                    </button>
                    <button
                        onClick={() => setShowInviteModal(true)}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', fontSize: '9px', fontWeight: '700', transition: 'all 0.2s' }}
                    >
                        <Plus size={18} />
                        <span>Invite</span>
                    </button>
                    <button
                        onClick={handleCompile}
                        disabled={isExecuting}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', color: isExecuting ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '8px', fontSize: '9px', fontWeight: '700', transition: 'all 0.2s', opacity: isExecuting ? 0.5 : 1 }}
                    >
                        <Play size={18} />
                        <span>Run</span>
                    </button>
                </nav>
            )}
            {/* Team Invite Modal */}
            <InviteModal
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                projectId={projectId}
                projectName={project?.name || "this project"}
                inviterName={user?.name || socketRef.current?.userName}
            />

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

const statusBadgeStyle = {
    fontSize: '9px',
    fontWeight: '900',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    padding: '2px 8px',
    borderRadius: '4px',
    letterSpacing: '0.05em'
};

const shareButtonStyle = {
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
};





const sidebarHeaderStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-dark)',
    height: '40px'
};

const trayIconsStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '2px'
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

const collaboratorAvatarsStyle = {
    display: 'flex',
    alignItems: 'center'
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

const notifDotStyle = {
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    width: '8px',
    height: '8px',
    backgroundColor: '#ef4444',
    borderRadius: '50%',
    border: '2px solid var(--bg-card)'
};

const toolRunButtonStyle = {
    padding: '0 20px',
    height: '100%',
    backgroundColor: 'var(--primary)',
    border: 'none',
    color: 'white',
    fontSize: '11px',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    borderRadius: '0'
};

const outputPaneStyle = {
    flex: 0.4,
    backgroundColor: 'var(--bg-dark)',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
};

const outputHeaderStyle = {
    padding: '8px 16px',
    backgroundColor: 'rgba(255,255,255,0.02)',
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
    color: '#d1d5db',
    fontSize: '13px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    overflowY: 'auto',
    height: '100%'
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

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
};

const modalContentStyle = {
    backgroundColor: 'var(--bg-card)',
    padding: '40px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
};

const modalInputStyle = {
    width: '100%',
    padding: '14px 20px',
    backgroundColor: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'white',
    fontSize: '15px',
    outline: 'none',
    marginBottom: '20px',
    textAlign: 'center'
};

const modalButtonStyle = {
    width: '100%',
    padding: '14px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)'
};

export default ProjectPage;
