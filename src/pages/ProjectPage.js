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
    PhoneOff,
    Edit2
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
    const [terminalTab, setTerminalTab] = useState('output');
    const [newMessage, setNewMessage] = useState("");
    const [showWhiteboard, setShowWhiteboard] = useState(false);
    const [settings] = useState({
        fontSize: 16,
        tabSize: 4,
        keybinding: "default",
        enableLinting: true,
        wordWrap: true
    });

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [clients, setClients] = useState([]);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [guestName, setGuestName] = useState("");

    const [sidebarTab, setSidebarTab] = useState('files');
    const [theme, setTheme] = useState(localStorage.getItem("app-theme") || "dark");
    const [isExecuting, setIsExecuting] = useState(false);
    const [output, setOutput] = useState("");
    const [isOutputVisible, setIsOutputVisible] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [activeTab, setActiveTab] = useState('code'); // 'code', 'files', 'chat', 'users', 'video'
    const [userInput, setUserInput] = useState("");
    const [isMeetingMinimized, setIsMeetingMinimized] = useState(false);
    const [isMeetingStarting, setIsMeetingStarting] = useState(false);
    // const [showInputPanel, setShowInputPanel] = useState(false);

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

    const joinProject = React.useCallback((name) => {
        if (!socketRef.current || hasJoinedRef.current) return;

        socketRef.current.userName = name;
        socketRef.current.emit(ACTIONS.PROJECT_JOIN, {
            projectId,
            userName: name,
        });

        hasJoinedRef.current = true;
        setShowNamePrompt(false);
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

                socketRef.current.on(ACTIONS.JOINED, ({ clients }) => {
                    setClients(clients);
                });

                socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId }) => {
                    setClients(prev => prev.filter(c => c.socketId !== socketId));
                });

                socketRef.current.on(ACTIONS.FILE_CHANGE, ({ fileId, content, socketId }) => {
                    if (socketRef.current.id === socketId) return;
                    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content } : f));
                    setActiveFile(prev => prev?.id === fileId ? { ...prev, content } : prev);
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

                if (!user) {
                    setShowNamePrompt(true);
                } else {
                    joinProject(user.name);
                }

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

    const handleGuestJoin = (e) => {
        e.preventDefault();
        if (!guestName.trim()) {
            toast.error("Please enter a name");
            return;
        }
        joinProject(guestName.trim());
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
        setActiveFile(prev => (prev && prev.id === activeFile.id) ? { ...prev, content } : prev);

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

    const handleSendMessage = (e) => {
        if ((e.key === "Enter" || e.type === "click") && newMessage.trim()) {
            const msg = {
                id: Date.now() + Math.random(),
                text: newMessage,
                userName: user?.name || socketRef.current?.userName,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                avatar: user?.photoURL
            };
            setMessages(prev => {
                const updated = [...prev, msg];
                localStorage.setItem(`project-chat-${projectId}`, JSON.stringify(updated));
                return updated;
            });
            socketRef.current.emit(ACTIONS.SEND_MESSAGE, { roomId: `project-${projectId}`, message: msg });
            setNewMessage("");
        }
    };

    const handleEditMessage = (messageId, oldText) => {
        const newText = prompt("Edit message:", oldText);
        if (newText !== null && newText.trim() && newText !== oldText) {
            socketRef.current.emit(ACTIONS.EDIT_MESSAGE, { roomId: `project-${projectId}`, messageId, newText });
            setMessages(prev => {
                const updated = prev.map(m => m.id === messageId ? { ...m, text: newText, isEdited: true } : m);
                localStorage.setItem(`project-chat-${projectId}`, JSON.stringify(updated));
                return updated;
            });
        }
    };

    const handleDeleteMessage = (messageId) => {
        if (window.confirm("Delete this message?")) {
            socketRef.current.emit(ACTIONS.DELETE_MESSAGE, { roomId: `project-${projectId}`, messageId });
            setMessages(prev => {
                const updated = prev.filter(m => m.id !== messageId);
                localStorage.setItem(`project-chat-${projectId}`, JSON.stringify(updated));
                return updated;
            });
        }
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
            const otherJavaFiles = files.filter(f => f.name.endsWith('.java') && f.id !== activeFile.id);
            let bundled = sourceCode;
            otherJavaFiles.forEach(f => {
                const cleanContent = f.content.replace(/public\s+class/g, 'class');
                bundled += `\n\n// From ${f.name}\n${cleanContent}`;
            });
            sourceCode = bundled;
        } else if (language === 'py') {
            const otherPyFiles = files.filter(f => f.name.endsWith('.py') && f.id !== activeFile.id);
            let bundled = sourceCode;
            otherPyFiles.forEach(f => {
                bundled += `\n\n# From ${f.name}\n${f.content}`;
            });
            sourceCode = bundled;
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
        const html = files.find(f => f.name === 'index.html')?.content || '';
        const css = files.find(f => f.name === 'style.css')?.content || '';
        const js = files.find(f => f.name === 'script.js')?.content || '';

        return `
            <!DOCTYPE html>
            <html>
                <head>
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
                    <div style={{ width: '1px', height: '28px', backgroundColor: 'var(--border-color)', margin: '0 2px' }} />
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
                    <div style={{ ...collaboratorAvatarsStyle, marginRight: '4px' }}>
                        {clients.slice(0, 3).map((client, i) => (
                            <div key={i} style={{ ...miniAvatarStyle, marginLeft: i > 0 ? '-8px' : '0' }} title={client.userName}>
                                {client.userName[0]}
                            </div>
                        ))}
                        {clients.length > 3 && (
                            <div style={{ ...miniAvatarStyle, marginLeft: '-8px', backgroundColor: 'var(--bg-dark)', fontSize: '8px' }}>
                                +{clients.length - 3}
                            </div>
                        )}
                    </div>

                    {!isMobile && (
                        <div className="icon-tray">
                            <button
                                className={`tray-btn ${sidebarTab === 'video' ? 'active' : ''}`}
                                onClick={() => setSidebarTab('video')}
                                title="Streaming View"
                            >
                                <Video size={16} />
                            </button>
                            <button
                                className={`tray-btn ${sidebarTab === 'files' ? 'active' : ''}`}
                                onClick={() => setSidebarTab('files')}
                                title="File Explorer"
                            >
                                <Folder size={16} />
                            </button>
                            <button
                                className={`tray-btn ${sidebarTab === 'chat' ? 'active' : ''}`}
                                onClick={() => {
                                    setSidebarTab('chat');
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
                                onClick={() => setSidebarTab('users')}
                                title="Participants"
                            >
                                <Users size={16} />
                            </button>
                            <button className="tray-btn" onClick={() => setShowWhiteboard(true)} title="Whiteboard">
                                <Palette size={16} />
                            </button>
                            <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 2px' }} />
                            <button className="tray-btn" onClick={toggleTheme} title="Toggle Theme">
                                {isLightMode ? <Sun size={16} /> : <Moon size={16} />}
                            </button>
                        </div>
                    )}

                    {isMobile && activeTab === 'code' && (
                        <button
                            onClick={handleCompile}
                            disabled={isExecuting}
                            style={{
                                ...toolRunButtonStyle,
                                height: '32px',
                                padding: '0 12px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                background: 'var(--primary)',
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                                border: 'none'
                            }}
                        >
                            <Play size={14} fill="white" />
                            <span>{isExecuting ? 'Running...' : 'Run'}</span>
                        </button>
                    )}

                    <button className="share-button" style={{
                        ...shareButtonStyle,
                        padding: isMobile ? '8px' : '8px 16px',
                        borderRadius: '8px'
                    }} onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success("Invite link copied!");
                    }}>
                        <Users size={14} /> {!isMobile && <span>Invite</span>}
                    </button>
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
                                        {files.map(file => (
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
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'chat' && (
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            {messages.map((msg, i) => (
                                                <div key={i} style={messageBoxStyle(msg.userName === (user?.name || socketRef.current?.userName))}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--primary)' }}>{msg.userName}</span>
                                                        <span style={{ fontSize: '10px', opacity: 0.4 }}>{msg.timestamp}</span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-main)' }}>{msg.text}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', paddingBottom: isMobile ? '64px' : '16px' }}>
                                            <input
                                                style={{ ...chatInputStyle, height: '44px', borderRadius: '22px', padding: '0 20px', backgroundColor: 'var(--bg-dark)' }}
                                                placeholder="Message workspace..."
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                onKeyPress={handleSendMessage}
                                            />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'users' && (
                                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {clients.map((client, i) => (
                                            <div key={i} style={{ ...participantRowStyle, padding: '12px', backgroundColor: 'var(--bg-card)' }}>
                                                <div style={avatarCircleStyle}>{client.userName[0]}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>{client.userName}</div>
                                                    <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '900', textTransform: 'uppercase' }}>{i === 0 ? 'Admin' : 'Member'}</div>
                                                </div>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'video' && (
                                    <div style={{ flex: 1, backgroundColor: '#000', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                                            <Video size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                                            <p style={{ fontSize: '14px', fontWeight: '600' }}>Call is active in the background.</p>
                                            <button
                                                style={{ ...modalButtonStyle, width: 'auto', padding: '10px 20px', marginTop: '20px' }}
                                                onClick={() => setIsMeetingMinimized(false)}
                                            >
                                                Return to Meeting
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Standard IDE Desktop Layout
                        sidebarTab === 'video' ? (
                            <div style={{ flex: 1, backgroundColor: '#0d1117', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                                    <Video size={64} style={{ opacity: 0.1, marginBottom: '24px' }} />
                                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'white' }}>Meeting Active</h3>
                                    <p style={{ opacity: 0.5, marginBottom: '24px' }}>The conference is running in persistent mode.</p>
                                    <button
                                        style={{ ...modalButtonStyle, width: 'auto', padding: '12px 24px' }}
                                        onClick={() => setIsMeetingMinimized(false)}
                                    >
                                        Maximize Video
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <ReflexContainer orientation="vertical" style={{ flex: 1, height: '100%', minHeight: 0 }}>
                                {!isMobile && ['files', 'chat', 'users'].includes(sidebarTab) && (
                                    <ReflexElement flex={0.2} minSize={250} style={{ height: '100%', minHeight: 0, backgroundColor: 'var(--bg-card)', borderRight: '1px solid var(--border-color)' }}>
                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                            <div style={sidebarHeaderStyle}>
                                                <span style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                    {sidebarTab}
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

                                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                                {sidebarTab === 'files' && (
                                                    <div style={{ padding: '8px' }}>
                                                        {files.map(file => (
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
                                                        ))}
                                                    </div>
                                                )}

                                                {sidebarTab === 'chat' && (
                                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                                        <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                            {messages.map((msg, i) => (
                                                                <div key={i} style={messageBoxStyle(msg.userName === (user?.name || socketRef.current?.userName))} className="chat-msg">
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--primary)' }}>{msg.userName}</span>
                                                                            {msg.isEdited && <span style={{ fontSize: '8px', opacity: 0.3, fontStyle: 'italic' }}>(edited)</span>}
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <span style={{ fontSize: '9px', opacity: 0.4 }}>{msg.timestamp}</span>
                                                                            {msg.userName === (user?.name || socketRef.current?.userName) && (
                                                                                <div style={{ display: 'flex', gap: '6px' }} className="msg-actions">
                                                                                    <Edit2 size={10} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={() => handleEditMessage(msg.id, msg.text)} />
                                                                                    <Trash2 size={10} style={{ cursor: 'pointer', color: '#f87171', opacity: 0.5 }} onClick={() => handleDeleteMessage(msg.id)} />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.5', color: 'var(--text-main)' }}>{msg.text}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                                            <input
                                                                style={chatInputStyle}
                                                                placeholder="Type message..."
                                                                value={newMessage}
                                                                onChange={(e) => setNewMessage(e.target.value)}
                                                                onKeyPress={handleSendMessage}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {sidebarTab === 'users' && (
                                                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {clients.map((client, i) => (
                                                            <div key={i} style={participantRowStyle}>
                                                                <div style={avatarCircleStyle}>{client.userName[0]}</div>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>{client.userName}</div>
                                                                    <div style={{ fontSize: '9px', color: 'var(--primary)', fontWeight: '800', textTransform: 'uppercase' }}>{i === 0 ? 'Admin' : 'Member'}</div>
                                                                </div>
                                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </ReflexElement>
                                )}

                                {!isMobile && ['files', 'chat', 'users'].includes(sidebarTab) && <ReflexSplitter style={splitterStyle} />}

                                <ReflexElement flex={0.8} minSize={400} style={{ height: '100%' }}>
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0d1117' }}>
                                        <div style={studioTabContainerStyle}>
                                            {openFiles.map(file => (
                                                <div key={file.id} onClick={() => setActiveFile(file)} style={studioTabStyle(activeFile?.id === file.id, isLightMode)}>
                                                    <FileText size={12} opacity={0.7} />
                                                    <span>{file.name}</span>
                                                    <button style={closeTabStyle} onClick={(e) => handleCloseTab(e, file.id)}><X size={10} /></button>
                                                </div>
                                            ))}
                                            {openFiles.length === 0 && <div style={{ height: '36px' }} />}
                                        </div>
                                        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                                            <div style={{ flex: isOutputVisible ? 0.6 : 1, position: 'relative' }}>
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
                                                        userName={user?.name || socketRef.current?.userName}
                                                        isLightMode={isLightMode}
                                                        userInput={userInput}
                                                        setUserInput={setUserInput}
                                                    />
                                                ) : (
                                                    <div style={emptyEditorStyle}>
                                                        <Terminal size={48} style={{ opacity: 0.05, marginBottom: '20px' }} />
                                                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', letterSpacing: '0.1em' }}>SELECT A MODULE TO BEGIN</p>
                                                    </div>
                                                )}
                                            </div>

                                            {isOutputVisible && (
                                                <div style={outputPaneStyle}>
                                                    <div style={outputHeaderStyle}>
                                                        <span>{showPreview ? 'Live Preview' : 'Terminal Output'}</span>
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
                                            )}
                                        </div>
                                    </div>
                                </ReflexElement>
                            </ReflexContainer>
                        )
                    )}
                </div>

                {showNamePrompt && (
                    <div style={modalOverlayStyle}>
                        <div style={modalContentStyle}>
                            <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>Studio Access</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Enter your name to join the workspace.</p>
                            <form onSubmit={handleGuestJoin}>
                                <input
                                    autoFocus
                                    value={guestName}
                                    onChange={(e) => setGuestName(e.target.value)}
                                    style={modalInputStyle}
                                    placeholder="Display Name"
                                    required
                                />
                                <button type="submit" style={modalButtonStyle}>Enter Studio</button>
                            </form>
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

                {/* Bottom navigation for mobile */}
                {isMobile && (
                    <div className="mobile-bottom-bar">
                        <button
                            className={`bottom-bar-item ${activeTab === 'code' ? 'active' : ''}`}
                            onClick={() => setActiveTab('code')}
                        >
                            <FileCode size={20} />
                            <span>Code</span>
                        </button>
                        <button
                            className={`bottom-bar-item ${activeTab === 'files' ? 'active' : ''}`}
                            onClick={() => setActiveTab('files')}
                        >
                            <Folder size={20} />
                            <span>Explorer</span>
                        </button>
                        <button
                            className={`bottom-bar-item ${activeTab === 'chat' ? 'active' : ''}`}
                            onClick={() => setActiveTab('chat')}
                        >
                            <div style={{ position: 'relative' }}>
                                <MessageSquare size={20} />
                                {messages.length > 0 && <div style={{ ...notifDotStyle, width: '10px', height: '10px' }} />}
                            </div>
                            <span>Chat</span>
                        </button>
                        <button
                            className={`bottom-bar-item ${activeTab === 'video' ? 'active' : ''}`}
                            onClick={() => setActiveTab('video')}
                        >
                            <Video size={20} />
                            <span>Meeting</span>
                        </button>
                        <button
                            className={`bottom-bar-item ${activeTab === 'users' ? 'active' : ''}`}
                            onClick={() => setActiveTab('users')}
                        >
                            <Users size={20} />
                            <span>People</span>
                        </button>
                    </div>
                )}
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
                    {/* Compact Meeting Toggle */}
                    <button
                        onClick={() => setIsMeetingStarting(!isMeetingStarting)}
                        title={isMeetingStarting ? "Leave Call" : "Join Conference"}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: isMeetingStarting ? '#ef4444' : 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isMeetingStarting ? <PhoneOff size={14} /> : <Video size={14} />}
                    </button>

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

            {/* Persistent Video Overlay */}
            <VideoChat
                socketRef={socketRef}
                projectId={projectId}
                user={user || { name: socketRef.current?.userName, isGuest: true }}
                isMinimized={isMeetingMinimized || (sidebarTab !== 'video' && activeTab !== 'video')}
                externalInCall={isMeetingStarting}
                onCallStateChange={setIsMeetingStarting}
                onMinimizeToggle={(val) => {
                    setIsMeetingMinimized(val);
                    if (!val) {
                        if (isMobile) setActiveTab('video');
                        else setSidebarTab('video');
                    }
                }}
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

const messageBoxStyle = (own) => ({
    padding: '12px',
    backgroundColor: own ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    border: own ? '1px solid rgba(59, 130, 246, 0.1)' : '1px solid var(--border-color)'
});

const chatInputStyle = {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    color: 'white',
    fontSize: '13px',
    outline: 'none',
    transition: 'border 0.2s'
};

const participantRowStyle = {
    padding: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid transparent',
    transition: 'all 0.2s'
};

const avatarCircleStyle = {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '800',
    fontSize: '12px'
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
