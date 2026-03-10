import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import "react-reflex/styles.css";
import {
    FileText,
    Folder,
    Plus,
    Play,
    Code,
    Layout,
    Video,
    Users,
    Home,
    PencilLine
} from "lucide-react";
import toast from "react-hot-toast";
// import AppLayout from "../components/AppLayout";
import EditorComp from "../components/editorComp";
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
    const [remoteCursors, setRemoteCursors] = useState({}); // { socketId: { x, y, name } }
    const [isPresenter, setIsPresenter] = useState(false);
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

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [mobileView, setMobileView] = useState("editor"); // "files", "editor", "preview", "collab"
    const [activeSidebarTab, setActiveSidebarTab] = useState("chat"); // "chat", "participants", "files"
    const [layoutMode, setLayoutMode] = useState("default"); // "cinema", "default", "focus"

    const socketRef = useRef(null);
    const filesRef = useRef([]);
    const openFilesRef = useRef([]);

    useEffect(() => {
        filesRef.current = files;
    }, [files]);

    useEffect(() => {
        openFilesRef.current = openFiles;
    }, [openFiles]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener("resize", handleResize);

        const init = async () => {
            try {
                const backendUrl = getBackendUrl();
                // Fetch project metadata
                const projRes = await fetch(`${backendUrl}/api/projects/${projectId}`);
                const projData = await projRes.json();
                setProject(projData);

                // Fetch files
                const filesRes = await fetch(`${backendUrl}/api/projects/${projectId}/files`);
                const filesData = await filesRes.json();
                setFiles(filesData);

                if (filesData.length > 0) {
                    setActiveFile(filesData[0]);
                    setOpenFiles([filesData[0]]);
                }

                // TODO: Task List
                // - [x] Phase 56: Build & Linting Final Polish
                //     - [x] Resolve remaining unused variable warnings in `ProjectPage.js`
                //     - [x] Run final production build verification
                // - [/] Phase 57: Draggable Layout & UI Modernization
                //     - [/] Replace fixed flex dimensions with `ReflexContainer` for main panels
                //     - [ ] Update UI style to match modern education app aesthetics (Unacademy/PW)
                //     - [ ] Remove text underlines from navigation and headers
                // - [ ] Phase 58: Video/Audio Streaming Fix & Modes
                //     - [ ] Debug and fix WebRTC signaling/VideoChat functionality
                //     - [ ] Implement layout modes (Video-dominant, Editor-dominant, Zoom-style Split)

                // Initialize Socket
                socketRef.current = await initSocket();
                socketRef.current.on('connect_error', (err) => handleErrors(err));
                socketRef.current.on('connect_failed', (err) => handleErrors(err));

                function handleErrors(e) {
                    console.log('socket error', e);
                    toast.error('Socket connection failed, try again later.');
                    navigate('/dashboard');
                }

                const guestName = `Guest_${Math.floor(Math.random() * 1000)}`;
                const currentUserName = user?.name || guestName;

                socketRef.current.userName = currentUserName;
                socketRef.current.emit(ACTIONS.PROJECT_JOIN, {
                    projectId,
                    userName: currentUserName,
                });

                // Handle Remote Events
                socketRef.current.on(ACTIONS.MOUSE_MOVE, ({ socketId, x, y, name }) => {
                    setRemoteCursors(prev => ({ ...prev, [socketId]: { x, y, name } }));
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

                setLoading(false);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load project");
                navigate("/dashboard");
            }
        };

        if (user || !user) init(); // Allow both auth and guest

        return () => {
            window.removeEventListener("resize", handleResize);
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.off(ACTIONS.PROJECT_JOIN);
            }
        };
    }, [projectId, user, navigate]);

    useEffect(() => {
        if (isPresenter && activeFile && socketRef.current) {
            socketRef.current.emit(ACTIONS.FOLLOW_MODE, {
                roomId: projectId,
                viewState: {
                    fileId: activeFile.id
                },
                userName: user?.name
            });
        }
    }, [activeFile, isPresenter, projectId, user?.name]);

    const handleFileClick = (file) => {
        setActiveFile(file);
        if (!openFiles.find(f => f.id === file.id)) {
            setOpenFiles([...openFiles, file]);
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

    const handleSendMessage = (e) => {
        if (e.key === "Enter" && newMessage.trim()) {
            const msg = {
                id: Date.now(),
                text: newMessage,
                userName: user?.name || socketRef.current?.userName || "Guest",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            socketRef.current?.emit(ACTIONS.SEND_MESSAGE, {
                roomId: projectId,
                message: msg
            });
            setMessages(prev => [...prev, msg]);
            setNewMessage("");
        }
    };

    const handleSaveFile = async (content) => {
        if (!activeFile) return;
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/projects/${projectId}/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...activeFile,
                    content
                })
            });
            const updatedFile = await response.json();
            setFiles(prev => prev.map(f => f.id === updatedFile.id ? updatedFile : f));
            if (activeFile.id === updatedFile.id) setActiveFile(updatedFile);

            // Sync with other users
            socketRef.current?.emit(ACTIONS.FILE_CHANGE, {
                roomId: `project-${projectId}`,
                fileId: updatedFile.id,
                path: updatedFile.path,
                content: updatedFile.content
            });
        } catch (err) {
            console.error("Save failed", err);
        }
    };

    const handleCreateFile = async () => {
        const name = prompt("Enter file name (e.g. style.css):");
        if (!name) return;

        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/projects/${projectId}/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    path: name,
                    content: "",
                    isDirectory: false
                })
            });
            const newFile = await response.json();
            setFiles(prev => [...prev, newFile]);
            handleFileClick(newFile);
            toast.success("File created");
        } catch (err) {
            toast.error("Failed to create file");
        }
    };



    const toggleFollowMe = () => {
        const newState = !isPresenter;
        setIsPresenter(newState);
        socketRef.current.emit(ACTIONS.FOLLOW_MODE, {
            projectId,
            isEnabled: newState
        });
        toast(newState ? "Presenter mode: ON" : "Presenter mode: OFF");
    };


    if (loading) return (
        <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-dark)" }}>
            <div className="loader"></div>
        </div>
    );

    const renderMobileTabs = () => (
        <div style={mobileTabsStyle}>
            <button onClick={() => setMobileView("files")} style={mobileTabButtonStyle(mobileView === "files")}>
                <Folder size={20} />
                <span>Files</span>
            </button>
            <button onClick={() => setMobileView("editor")} style={mobileTabButtonStyle(mobileView === "editor")}>
                <Code size={20} />
                <span>Code</span>
            </button>
            <button onClick={() => setMobileView("preview")} style={mobileTabButtonStyle(mobileView === "preview")}>
                <Layout size={20} />
                <span>Preview</span>
            </button>
            <button onClick={() => setMobileView("collab")} style={mobileTabButtonStyle(mobileView === "collab")}>
                <Users size={20} />
                <span>Collab</span>
            </button>
        </div>
    );

    return (
        <div style={{
            height: "100vh",
            width: "100vw",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--bg-dark)",
            position: "relative",
            overflow: "hidden"
        }}>
            {/* Project Header (Streaming Style) */}
            <div style={streamingHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div
                        onClick={() => navigate("/dashboard")}
                        style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            backgroundColor: "rgba(255,255,255,0.05)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer"
                        }}
                    >
                        <Home size={18} color="var(--text-muted)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: "15px", fontWeight: "800", margin: 0, color: "var(--text-main)" }}>
                            {project?.name}
                        </h1>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                            <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" }} />
                            LIVE • {Object.keys(remoteCursors).length + 1} watching
                        </div>
                    </div>
                </div>

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
                    <button onClick={() => setShowWhiteboard(true)} style={streamingActionButtonStyle}>
                        <PencilLine size={16} />
                        <span>Whiteboard</span>
                    </button>
                    <button
                        onClick={toggleFollowMe}
                        style={{
                            ...streamingActionButtonStyle,
                            color: isPresenter ? "var(--primary)" : "var(--text-main)",
                            borderColor: isPresenter ? "var(--primary)" : "transparent"
                        }}
                    >
                        <Users size={16} />
                        <span>{isPresenter ? "Stop Presenting" : "Follow Me"}</span>
                    </button>
                    <div style={{ display: "flex", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "4px" }}>
                        <button
                            onClick={() => setLayoutMode("cinema")}
                            style={{
                                ...modeButtonStyle,
                                backgroundColor: layoutMode === "cinema" ? "rgba(255,255,255,0.1)" : "transparent",
                                color: layoutMode === "cinema" ? "var(--primary)" : "var(--text-muted)"
                            }}
                            title="Cinema Mode"
                        >
                            <Video size={16} />
                        </button>
                        <button
                            onClick={() => setLayoutMode("default")}
                            style={{
                                ...modeButtonStyle,
                                backgroundColor: layoutMode === "default" ? "rgba(255,255,255,0.1)" : "transparent",
                                color: layoutMode === "default" ? "var(--primary)" : "var(--text-muted)"
                            }}
                            title="Default Mode"
                        >
                            <Layout size={16} />
                        </button>
                        <button
                            onClick={() => setLayoutMode("focus")}
                            style={{
                                ...modeButtonStyle,
                                backgroundColor: layoutMode === "focus" ? "rgba(255,255,255,0.1)" : "transparent",
                                color: layoutMode === "focus" ? "var(--primary)" : "var(--text-muted)"
                            }}
                            title="Focus Mode"
                        >
                            <Code size={16} />
                        </button>
                    </div>

                    <button style={streamingPrimaryButtonStyle}>
                        <Play size={14} />
                        <span>Go Live</span>
                    </button>
                </div>
            </div>

            {/* Main Reflex Layout */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                {!isMobile ? (
                    <ReflexContainer orientation="vertical">
                        {/* 1. File Tree Pane */}
                        <ReflexElement size={240} minSize={150}>
                            <div style={fileTreeContainerStyle}>
                                <div style={treeHeaderStyle}>
                                    <span style={{ fontSize: "10px", fontWeight: "900", color: "var(--text-muted)", letterSpacing: "0.05em" }}>PROJECT FILES</span>
                                    <Plus size={14} style={{ cursor: "pointer" }} onClick={handleCreateFile} />
                                </div>
                                <div style={{ padding: "8px" }}>
                                    {files.map(file => (
                                        <div key={file.id} onClick={() => handleFileClick(file)} style={fileItemStyle(activeFile?.id === file.id)}>
                                            <FileText size={14} />
                                            <span style={{ fontSize: "13px" }}>{file.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </ReflexElement>

                        <ReflexSplitter style={splitterStyle} />

                        {/* 2. Main Content Area (Editor Only) */}
                        <ReflexElement flex={1} minSize={300}>
                            <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-dark)" }}>
                                <div style={tabContainerStyle}>
                                    {openFiles.map(file => (
                                        <div key={file.id} onClick={() => setActiveFile(file)} style={tabStyle(activeFile?.id === file.id)}>
                                            <FileText size={12} />
                                            <span>{file.name}</span>
                                            <button style={closeTabStyle} onClick={(e) => handleCloseTab(e, file.id)}>&times;</button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ flex: 1, overflow: "hidden" }}>
                                    {activeFile && (
                                        <EditorComp
                                            socketRef={socketRef}
                                            roomId={`project-${projectId}-${activeFile.id}`}
                                            onCodeChange={handleSaveFile}
                                            initialCode={activeFile.content}
                                            filename={activeFile.name}
                                            lockLanguage={true}
                                            language={activeFile.name.split('.').pop() === 'js' ? 'javascript' : activeFile.name.split('.').pop() === 'html' ? 'html' : 'css'}
                                            settings={settings}
                                        />
                                    )}
                                </div>
                            </div>
                        </ReflexElement>

                        <ReflexSplitter style={splitterStyle} />

                        {/* 3. Sidebar Pane (Video + Chat/Users) */}
                        <ReflexElement size={320} minSize={200}>
                            <div style={streamingSidebarStyle}>
                                <VideoChat socketRef={socketRef} projectId={projectId} user={user || { name: socketRef.current?.userName || "Guest" }} />
                                <div style={sidebarTabsStyle}>
                                    <button
                                        onClick={() => setActiveSidebarTab("chat")}
                                        style={sidebarTabButtonStyle(activeSidebarTab === "chat")}
                                    >
                                        Live Chat
                                    </button>
                                    <button
                                        onClick={() => setActiveSidebarTab("participants")}
                                        style={sidebarTabButtonStyle(activeSidebarTab === "participants")}
                                    >
                                        Participants
                                    </button>
                                </div>

                                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "16px" }}>
                                    {activeSidebarTab === "chat" ? (
                                        <>
                                            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                                                {messages.map(msg => (
                                                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                            <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary)" }}>{msg.userName}</span>
                                                            <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>{msg.time}</span>
                                                        </div>
                                                        <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "var(--text-main)" }}>{msg.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ position: "relative" }}>
                                                <input
                                                    type="text"
                                                    placeholder="Say something nice..."
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    onKeyDown={handleSendMessage}
                                                    style={sidebarInputStyle}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "10px" }}>
                                                <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "var(--primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700" }}>{user?.name?.[0] || "G"}</div>
                                                <span style={{ fontSize: "13px", fontWeight: "600" }}>{user?.name || "You (Guest)"}</span>
                                                <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--primary)", fontWeight: "700" }}>HOST</span>
                                            </div>
                                            {Object.entries(remoteCursors).map(([id, cursor]) => (
                                                <div key={id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px" }}>
                                                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "var(--bg-dark)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700" }}>{cursor.name?.[0] || "U"}</div>
                                                    <span style={{ fontSize: "13px" }}>{cursor.name || "Viewer"}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ReflexElement>
                    </ReflexContainer>
                ) : (
                    /* Mobile Layout (Existing) */
                    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                        <div style={{ flex: 1, overflow: "hidden" }}>
                            {/* ... existing mobile tab logic ... */}
                            {mobileView === "editor" && (
                                <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                                    <div style={{ height: "200px", backgroundColor: "#000" }}>
                                        <VideoChat socketRef={socketRef} projectId={projectId} user={user || { name: socketRef.current?.userName || "Guest" }} />
                                    </div>
                                    <div style={{ flex: 1, overflow: "hidden" }}>
                                        {activeFile && (
                                            <EditorComp
                                                socketRef={socketRef}
                                                roomId={`project-${projectId}-${activeFile.id}`}
                                                onCodeChange={handleSaveFile}
                                                initialCode={activeFile.content}
                                                filename={activeFile.name}
                                                lockLanguage={true}
                                                language={activeFile.name.split('.').pop() === 'js' ? 'javascript' : activeFile.name.split('.').pop() === 'html' ? 'html' : 'css'}
                                                settings={settings}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                            {/* ... other mobile views simplified for refactor ... */}
                        </div>
                        {renderMobileTabs()}
                    </div>
                )}
            </div>

            <WhiteboardModal
                isOpen={showWhiteboard}
                onClose={() => setShowWhiteboard(false)}
                socketRef={socketRef}
                roomId={projectId}
                user={user || { name: socketRef.current?.userName || "Guest" }}
            />
        </div >
    );
};

// Styles
const streamingHeaderStyle = {
    height: "64px",
    padding: "0 24px",
    backgroundColor: "var(--bg-card)",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    zIndex: 100
};

const streamingActionButtonStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "transparent",
    color: "var(--text-main)",
    border: "1px solid transparent",
    padding: "8px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
    textDecoration: "none"
};

const streamingPrimaryButtonStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "var(--primary)",
    color: "white",
    border: "none",
    padding: "8px 20px",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
    textDecoration: "none"
};

const modeButtonStyle = {
    padding: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s"
};

const streamingSidebarStyle = {
    width: "320px",
    backgroundColor: "var(--bg-card)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0
};

const sidebarTabsStyle = {
    display: "flex",
    padding: "0 16px",
    gap: "24px",
    borderBottom: "1px solid var(--border-color)",
    height: "48px",
    alignItems: "center"
};

const sidebarTabButtonStyle = (active) => ({
    background: "transparent",
    border: "none",
    color: active ? "var(--text-main)" : "var(--text-muted)",
    fontSize: "14px",
    fontWeight: active ? "700" : "600",
    cursor: "pointer",
    paddingBottom: "4px",
    borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
    transition: "all 0.2s",
    textDecoration: "none"
});

const sidebarInputStyle = {
    width: "100%",
    padding: "12px 16px",
    backgroundColor: "rgba(255,255,255,0.03)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    color: "var(--text-main)",
    fontSize: "13px",
    outline: "none",
    transition: "border-color 0.2s"
};


const mobileTabsStyle = {
    height: "60px",
    backgroundColor: "var(--bg-card)",
    borderTop: "1px solid var(--border-color)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    flexShrink: 0
};

const mobileTabButtonStyle = (active) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    background: "transparent",
    border: "none",
    color: active ? "var(--primary)" : "var(--text-muted)",
    fontSize: "10px",
    fontWeight: "700",
    transition: "all 0.2s"
});


const fileTreeContainerStyle = {
    height: "100%",
    backgroundColor: "var(--bg-dark)",
    borderRight: "1px solid var(--border-color)",
};

const treeHeaderStyle = {
    padding: "16px",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
};

const fileItemStyle = (active) => ({
    padding: "8px 12px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: active ? "white" : "var(--text-muted)",
    backgroundColor: active ? "rgba(59, 130, 246, 0.1)" : "transparent",
    cursor: "pointer",
    marginBottom: "2px",
    transition: "all 0.2s"
});

const tabContainerStyle = {
    height: "40px",
    backgroundColor: "var(--bg-card)",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    overflowX: "auto"
};

const tabStyle = (active) => ({
    padding: "0 16px",
    height: "100%",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: active ? "transparent" : "var(--bg-dark)",
    borderRight: "1px solid var(--border-color)",
    borderTop: active ? "2px solid var(--primary)" : "2px solid transparent",
    color: active ? "white" : "var(--text-muted)",
    cursor: "pointer",
    fontSize: "13px",
    minWidth: "120px",
    textDecoration: "none"
});

const closeTabStyle = {
    marginLeft: "10px",
    background: "transparent",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    padding: "2px"
};



const splitterStyle = {
    backgroundColor: "var(--border-color)",
    width: "2px",
    transition: "all 0.2s"
};

export default ProjectPage;
