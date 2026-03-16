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
    LogOut,
    Palette,
    Wifi,
    Video,
    Terminal,
    FileCode,
    Users,
    Play,
    Trash2
} from "lucide-react";
import toast from "react-hot-toast";
import EditorComp from "../components/editorComp";
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
    const [newMessage, setNewMessage] = useState("");
    const [showWhiteboard, setShowWhiteboard] = useState(false);
    const [settings] = useState({
        fontSize: 16,
        tabSize: 4,
        keybinding: "default",
        enableLinting: true,
        wordWrap: true
    });

    const [, setIsMobile] = useState(window.innerWidth < 768);
    const [clients, setClients] = useState([]);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [guestName, setGuestName] = useState("");

    const [sidebarTab, setSidebarTab] = useState('files');
    const [theme, setTheme] = useState(localStorage.getItem("app-theme") || "dark");
    const [showVideo, setShowVideo] = useState(true);
    const [isExecuting, setIsExecuting] = useState(false);
    const [output, setOutput] = useState("");
    const [isOutputVisible, setIsOutputVisible] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const socketRef = useRef(null);
    const hasJoinedRef = useRef(false);
    const filesRef = useRef([]);
    const openFilesRef = useRef([]);

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

                // Universal Project Listeners
                socketRef.current.on(ACTIONS.JOINED, ({ clients }) => {
                    setClients(clients);
                });

                socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId }) => {
                    setClients(prev => prev.filter(c => c.socketId !== socketId));
                });

                socketRef.current.on(ACTIONS.MOUSE_MOVE, ({ socketId, x, y, name }) => {
                    // Cursors handled in EditorComp
                });

                socketRef.current.on(ACTIONS.FILE_CHANGE, ({ fileId, content }) => {
                    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content } : f));
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
                    setMessages(prev => [...prev, message]);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, user, navigate]);

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
    };

    const handleSaveFile = async (content) => {
        if (!activeFile) return;
        setFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, content } : f));
        // Real-time broadcast
        socketRef.current.emit(ACTIONS.FILE_CHANGE, {
            roomId: `project-${projectId}`,
            fileId: activeFile.id,
            content
        });
    };

    const handleSendMessage = (e) => {
        if ((e.key === "Enter" || e.type === "click") && newMessage.trim()) {
            const msg = {
                id: Date.now(),
                text: newMessage,
                userName: user?.name || socketRef.current?.userName,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                avatar: user?.photoURL
            };
            setMessages(prev => [...prev, msg]);
            socketRef.current.emit(ACTIONS.SEND_MESSAGE, { roomId: `project-${projectId}`, message: msg });
            setNewMessage("");
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

            // Notify others
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

        // Protect core files
        const coreFiles = ['index.html', 'style.css', 'script.js', 'main.cpp', 'main.py', 'Main.java', 'utils.h'];
        if (coreFiles.includes(file.name)) {
            toast.error(`Cannot delete core file: ${file.name}`);
            return;
        }

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

            // Sync with others
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

            socketRef.current.emit(ACTIONS.CODE_CHANGE, { roomId: `project-${projectId}`, fileId: file.id, content: defaultContent });
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
        setOutput("Bundling and running...");

        const language = activeFile?.name.split('.').pop();
        let languageId = 63; // Default JS
        if (language === 'cpp' || language === 'h') languageId = 54;
        else if (language === 'py') languageId = 71;
        else if (language === 'java') languageId = 62;

        let sourceCode = activeFile.content;

        // Multi-file bundling logic
        if (language === 'cpp' || language === 'h') {
            // Simple C++ include resolver
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
            // Java Bundler: Combine all .java files, remove 'public' from secondary classes
            const otherJavaFiles = files.filter(f => f.name.endsWith('.java') && f.id !== activeFile.id);
            let bundled = sourceCode;
            otherJavaFiles.forEach(f => {
                const cleanContent = f.content.replace(/public\s+class/g, 'class');
                bundled += `\n\n// From ${f.name}\n${cleanContent}`;
            });
            sourceCode = bundled;
        } else if (language === 'py') {
            // Python Bundler: Append other .py files (risky but works for simple projects)
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
            {/* Premium Glassmorphism Header */}
            <header className="studio-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={logoWrapperStyle} onClick={() => navigate('/dashboard')}>
                        <img src="/utkristi-labs.png" alt="Logo" style={{ height: '20px', objectFit: 'contain' }} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '900', letterSpacing: '-0.02em', color: 'var(--text-main)', background: 'linear-gradient(135deg, #fff 0%, #aaa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                {project ? project.name : "UNTITLED PROJECT"}
                            </h2>
                            <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.1em' }}>RTM STUDIO</span>
                            <span style={statusBadgeStyle}>LIVE</span>
                        </div>
                        <p className="header-metadata" style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {project?.type || 'Web'} Project {project?.is_public ? '• Public' : '• Private'}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button style={themeToggleButtonStyle} onClick={toggleTheme}>
                        <Palette size={16} />
                    </button>

                    <div style={collaboratorAvatarsStyle}>
                        {clients.slice(0, 3).map((client, i) => (
                            <div key={i} style={{ ...miniAvatarStyle, marginLeft: i > 0 ? '-8px' : '0', border: '2px solid var(--bg-card)' }} title={client.userName}>
                                {client.userName[0]}
                            </div>
                        ))}
                        {clients.length > 3 && (
                            <div style={{ ...miniAvatarStyle, marginLeft: '-8px', backgroundColor: 'var(--bg-dark)', fontSize: '9px', border: '2px solid var(--bg-card)' }}>
                                +{clients.length - 3}
                            </div>
                        )}
                    </div>

                    <button className="share-button" style={shareButtonStyle} onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success("Invite link copied!");
                    }}>
                        <Users size={14} /> <span>Invite</span>
                    </button>

                    <div className="header-divider" style={headerDividerStyle} />

                    <button style={videoToggleStyle(showVideo)} onClick={() => setShowVideo(!showVideo)}>
                        <Video size={16} />
                    </button>
                </div>
            </header>

            <div className="workspace-container">
                {/* Control Bar (Thin vertical strip for tabs) */}
                <div className="control-bar" style={controlBarStyle}>
                    <button className="control-tab-btn" style={controlTabButtonStyle(sidebarTab === 'video')} onClick={() => setSidebarTab('video')} title="Stream">
                        <Video size={18} />
                    </button>
                    <button className="control-tab-btn" style={controlTabButtonStyle(sidebarTab === 'editor')} onClick={() => setSidebarTab('editor')} title="Editor">
                        <FileCode size={18} />
                    </button>
                    <button className="control-tab-btn" style={controlTabButtonStyle(sidebarTab === 'files')} onClick={() => setSidebarTab('files')} title="Files">
                        <Folder size={18} />
                    </button>
                    <button className="control-tab-btn" style={controlTabButtonStyle(sidebarTab === 'chat')} onClick={() => setSidebarTab('chat')} title="Chat">
                        <div style={{ position: 'relative' }}>
                            <MessageSquare size={18} />
                            {messages.length > 0 && <div style={notifDotStyle} />}
                        </div>
                    </button>
                    <button className="control-tab-btn" style={controlTabButtonStyle(sidebarTab === 'users')} onClick={() => setSidebarTab('users')} title="Participants">
                        <Users size={18} />
                    </button>
                    <div style={{ flex: 1 }} />
                    <button style={controlTabButtonStyle(false)} onClick={() => setShowWhiteboard(true)} title="Whiteboard">
                        <Palette size={18} />
                    </button>
                    <button style={controlTabButtonStyle(false)} onClick={() => navigate('/dashboard')} title="Exit">
                        <LogOut size={18} />
                    </button>
                </div>

                <div className="workspace-content" style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
                    {sidebarTab === 'video' ? (
                        <div style={{ flex: 1, backgroundColor: '#0d1117', position: 'relative' }}>
                            <VideoChat
                                socketRef={socketRef}
                                projectId={projectId}
                                user={user || { name: socketRef.current?.userName, isGuest: true }}
                            />
                        </div>
                    ) : (
                        <ReflexContainer orientation="vertical" style={{ flex: 1 }}>
                            {/* Left Sidebar: Contextual Content (Collapsed if not needed) */}
                            {['files', 'chat', 'users'].includes(sidebarTab) && (
                                <ReflexElement flex={0.2} minSize={250} style={{ backgroundColor: 'var(--bg-card)', borderRight: '1px solid var(--border-color)' }}>
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                                                            <Trash2
                                                                size={12}
                                                                className="delete-icon"
                                                                style={{ opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer' }}
                                                                onClick={(e) => handleDeleteFile(e, file)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {sidebarTab === 'chat' && (
                                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                                    <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                        {messages.map((msg, i) => (
                                                            <div key={i} style={messageBoxStyle(msg.userName === (user?.name || socketRef.current?.userName))}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                    <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--primary)' }}>{msg.userName}</span>
                                                                    <span style={{ fontSize: '9px', opacity: 0.4 }}>{msg.timestamp}</span>
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

                            {['files', 'chat', 'users'].includes(sidebarTab) && <ReflexSplitter style={splitterStyle} />}

                            {/* Middle Area: Editor & Runner */}
                            <ReflexElement flex={0.8} minSize={400}>
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0d1117' }}>
                                    <div style={studioTabContainerStyle}>
                                        {openFiles.map(file => (
                                            <div key={file.id} onClick={() => setActiveFile(file)} style={studioTabStyle(activeFile?.id === file.id)}>
                                                <FileText size={12} opacity={0.7} />
                                                <span>{file.name}</span>
                                                <button style={closeTabStyle} onClick={(e) => handleCloseTab(e, file.id)}><X size={10} /></button>
                                            </div>
                                        ))}
                                        {openFiles.length === 0 && <div style={{ height: '36px' }} />}
                                    </div>
                                    <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ flex: isOutputVisible ? 0.6 : 1, position: 'relative' }}>
                                            {activeFile ? (
                                                <EditorComp
                                                    socketRef={socketRef}
                                                    roomId={`project-${projectId}`}
                                                    fileId={activeFile.id}
                                                    onCodeChange={handleSaveFile}
                                                    code={activeFile.content}
                                                    filename={activeFile.name}
                                                    lockLanguage={true}
                                                    language={activeFile.name.split('.').pop()}
                                                    settings={settings}
                                                    userName={user?.name || socketRef.current?.userName}
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
                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                    {showPreview ? (
                                                        <iframe
                                                            title="Preview"
                                                            style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                                                            srcDoc={generatePreviewDoc()}
                                                        />
                                                    ) : (
                                                        <pre style={outputTextStyle}>{output}</pre>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <footer style={studioFooterStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <Wifi size={12} color="#10b981" />
                                            <span>{project?.type?.toUpperCase()} Engine</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button style={toolMiniButtonStyle} onClick={handleCompile} disabled={isExecuting}>
                                                <Play size={12} /> {isExecuting ? 'Running...' : 'Run'}
                                            </button>
                                        </div>
                                    </footer>
                                </div>
                            </ReflexElement>
                        </ReflexContainer>
                    )}
                </div>

                {/* Overlay for Guest Name */}
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
            </div>
        </div>
    );
};


const logoWrapperStyle = {
    width: '36px',
    height: '36px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '1px solid rgba(59, 130, 246, 0.2)',
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

const videoToggleStyle = (active) => ({
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: active ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.03)',
    color: active ? '#ef4444' : 'var(--text-muted)',
    border: active ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s'
});

const themeToggleButtonStyle = {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginRight: '12px'
};

const headerDividerStyle = {
    width: '1px',
    height: '24px',
    backgroundColor: 'var(--border-color)',
    margin: '0 4px'
};

const controlBarStyle = {
    width: '56px',
    backgroundColor: 'var(--bg-card)',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 0'
};

const controlTabButtonStyle = (active) => ({
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    borderRadius: '8px',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: active ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent'
});

const sidebarHeaderStyle = {
    padding: '16px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)'
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
    padding: '0 8px',
    overflowX: 'auto',
    gap: '4px'
};

const studioTabStyle = (active) => ({
    height: '34px',
    padding: '0 16px',
    backgroundColor: active ? '#0d1117' : 'transparent',
    border: '1px solid var(--border-color)',
    borderBottom: active ? '1px solid #0d1117' : '1px solid var(--border-color)',
    borderRadius: '6px 6px 0 0',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '12px',
    fontWeight: active ? '700' : '500',
    color: active ? 'var(--text-main)' : 'var(--text-muted)',
    cursor: 'pointer',
    minWidth: '120px',
    zIndex: active ? 2 : 1,
    marginBottom: '-1px'
});

const studioFooterStyle = {
    height: '28px',
    backgroundColor: 'var(--bg-card)',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
};

const messageBoxStyle = (own) => ({
    padding: '12px',
    backgroundColor: own ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
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
    borderRadius: '10px',
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

const toolMiniButtonStyle = {
    padding: '6px 12px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '6px',
    color: 'var(--primary)',
    fontSize: '11px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const outputPaneStyle = {
    flex: 0.4,
    backgroundColor: '#0d1117',
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
    borderRadius: '20px',
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
    borderRadius: '12px',
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
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)'
};

export default ProjectPage;
