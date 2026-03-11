import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import "react-reflex/styles.css";
import {
    FileText,
    Folder,
    Plus,
    Code,
    Layout,
    User,
    Home,
    PencilLine,
    Send
} from "lucide-react";
import toast from "react-hot-toast";
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
    const [activeSidebarTab, setActiveSidebarTab] = useState("chat"); // "chat", "participants"
    const [layoutMode, setLayoutMode] = useState("default"); // "cinema", "default", "focus"

    const [guestName, setGuestName] = useState("");
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [hasJoined, setHasJoined] = useState(false);

    const socketRef = useRef(null);
    const filesRef = useRef([]);
    const openFilesRef = useRef([]);

    useEffect(() => {
        filesRef.current = files;
    }, [files]);

    useEffect(() => {
        openFilesRef.current = openFiles;
    }, [openFiles]);

    const joinProject = React.useCallback((name) => {
        if (!socketRef.current || hasJoined) return;

        socketRef.current.userName = name;
        socketRef.current.emit(ACTIONS.PROJECT_JOIN, {
            projectId,
            userName: name,
        });

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

        setHasJoined(true);
        setShowNamePrompt(false);
    }, [hasJoined, projectId]);

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
    }, [projectId, user, navigate, joinProject]);

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
            roomId: `project-${projectId}-${activeFile.id}`,
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
            socketRef.current.emit(ACTIONS.SEND_MESSAGE, { roomId: projectId, message: msg });
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

    if (loading) {
        return (
            <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-dark)", color: "white" }}>
                <div style={{ textAlign: "center" }}>
                    <div className="loading-spinner" style={{ marginBottom: "20px" }}></div>
                    <p style={{ fontSize: "18px", fontWeight: "600" }}>Initialising Project Workspace...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ height: "100vh", width: "100vw", overflow: "hidden", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-dark)" }}>
            {/* Header */}
            <div style={streamingHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                    <div onClick={() => navigate("/dashboard")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "32px", height: "32px", backgroundColor: "var(--primary)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Code color="white" size={18} />
                        </div>
                        <span style={{ fontSize: "16px", fontWeight: "800", letterSpacing: "-0.5px", color: "var(--text-main)" }}>RTM Edit</span>
                    </div>

                    <div style={{ height: "24px", width: "1px", backgroundColor: "var(--border-color)" }}></div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-main)" }}>{project?.title}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(239, 68, 68, 0.1)", padding: "4px 10px", borderRadius: "20px" }}>
                            <div style={{ width: "6px", height: "6px", backgroundColor: "#ef4444", borderRadius: "50%" }}></div>
                            <span style={{ fontSize: "11px", fontWeight: "800", color: "#ef4444", textTransform: "uppercase" }}>Live</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "20px", marginLeft: "auto" }}>
                    <div style={{ display: "flex", backgroundColor: "rgba(255,255,255,0.03)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                        <button onClick={() => setLayoutMode("focus")} style={{ ...modeButtonStyle, backgroundColor: layoutMode === "focus" ? "rgba(255,255,255,0.05)" : "transparent" }} title="Focus Mode">
                            <Code size={18} color={layoutMode === "focus" ? "var(--primary)" : "var(--text-muted)"} />
                        </button>
                        <button onClick={() => setLayoutMode("default")} style={{ ...modeButtonStyle, backgroundColor: layoutMode === "default" ? "rgba(255,255,255,0.05)" : "transparent" }} title="Default Mode">
                            <Layout size={18} color={layoutMode === "default" ? "var(--primary)" : "var(--text-muted)"} />
                        </button>
                    </div>

                    <button onClick={() => setShowWhiteboard(true)} style={streamingActionButtonStyle} title="Whiteboard">
                        <PencilLine size={18} />
                    </button>

                    <button onClick={() => navigate("/dashboard")} style={streamingPrimaryButtonStyle} title="Leave Project">
                        <Home size={18} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
                <ReflexContainer orientation="vertical">
                    {/* 1. File Tree */}
                    <ReflexElement size={260} minSize={200}>
                        <div style={fileTreeContainerStyle}>
                            <div style={treeHeaderStyle}>
                                <span style={{ fontSize: "14px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                                    <Folder size={16} /> Files
                                </span>
                                <Plus size={16} style={{ cursor: "pointer", color: "var(--text-muted)" }} />
                            </div>
                            <div style={{ padding: "12px" }}>
                                {files.map(file => (
                                    <div key={file.id} onClick={() => handleFileClick(file)} style={fileItemStyle(activeFile?.id === file.id)}>
                                        <FileText size={16} color={activeFile?.id === file.id ? "var(--primary)" : "var(--text-muted)"} />
                                        <span style={{ fontSize: "13px", fontWeight: "600" }}>{file.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ReflexElement>

                    <ReflexSplitter style={splitterStyle} />

                    {/* 2. Main Area (Editor) */}
                    <ReflexElement flex={1} minSize={400}>
                        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                            <div style={tabContainerStyle}>
                                {openFiles.map(file => (
                                    <div key={file.id} onClick={() => setActiveFile(file)} style={tabStyle(activeFile?.id === file.id)}>
                                        <FileText size={14} />
                                        <span>{file.name}</span>
                                        <button style={closeTabStyle} onClick={(e) => handleCloseTab(e, file.id)}>&times;</button>
                                    </div>
                                ))}
                            </div>
                            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                                {activeFile ? (
                                    <EditorComp
                                        socketRef={socketRef}
                                        roomId={`project-${projectId}-${activeFile.id}`}
                                        onCodeChange={handleSaveFile}
                                        code={activeFile.content}
                                        filename={activeFile.name}
                                        lockLanguage={true}
                                        language={activeFile.name.split('.').pop()}
                                        settings={settings}
                                        userName={user?.name || socketRef.current?.userName}
                                    />
                                ) : (
                                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                                        <div style={{ textAlign: "center" }}>
                                            <Code size={48} style={{ marginBottom: "16px", opacity: 0.2 }} />
                                            <p>Select a file to start coding</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={footerStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <div style={{ width: "8px", height: "8px", backgroundColor: "#10b981", borderRadius: "50%" }}></div>
                                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Connected to Cloud Sync</span>
                                </div>
                            </div>
                        </div>
                    </ReflexElement>

                    <ReflexSplitter style={splitterStyle} />

                    {/* 3. Sidebar (Video + Chat) */}
                    <ReflexElement size={340} minSize={280}>
                        <div style={streamingSidebarStyle}>
                            <VideoChat socketRef={socketRef} projectId={projectId} user={user || { name: socketRef.current?.userName || "Guest", isGuest: !user }} />

                            <div style={sidebarTabsStyle}>
                                <button onClick={() => setActiveSidebarTab("chat")} style={sidebarTabButtonStyle(activeSidebarTab === "chat")}>Live Chat</button>
                                <button onClick={() => setActiveSidebarTab("participants")} style={sidebarTabButtonStyle(activeSidebarTab === "participants")}>Participants</button>
                            </div>

                            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                                {activeSidebarTab === "chat" ? (
                                    <>
                                        <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                                            {messages.map(msg => (
                                                <div key={msg.id} style={{ display: "flex", gap: "12px" }}>
                                                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "var(--primary)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "12px", fontWeight: "700" }}>
                                                        {msg.avatar ? <img src={msg.avatar} alt="avatar" style={{ width: "100%", height: "100%", borderRadius: "50%" }} /> : msg.userName[0]}
                                                    </div>
                                                    <div>
                                                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
                                                            <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-main)" }}>{msg.userName}</span>
                                                            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{msg.timestamp}</span>
                                                        </div>
                                                        <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>{msg.text}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ padding: "16px", borderTop: "1px solid var(--border-color)" }}>
                                            <div style={{ position: "relative" }}>
                                                <input
                                                    type="text"
                                                    placeholder="Send a message..."
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    onKeyDown={handleSendMessage}
                                                    style={sidebarInputStyle}
                                                />
                                                <button onClick={handleSendMessage} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "var(--primary)", color: "white", border: "none", width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Send Message">
                                                    <Send size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ padding: "20px" }}>
                                        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Active Users</span>
                                        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                            {Object.entries(remoteCursors).map(([id, cursor]) => (
                                                <div key={id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                    <div style={{ width: "8px", height: "8px", backgroundColor: "#10b981", borderRadius: "50%" }}></div>
                                                    <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-main)" }}>{cursor.name}</span>
                                                </div>
                                            ))}
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <div style={{ width: "8px", height: "8px", backgroundColor: "#10b981", borderRadius: "50%" }}></div>
                                                <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-main)" }}>{user?.name || socketRef.current?.userName} (You)</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ReflexElement>
                </ReflexContainer>
            </div>

            {/* Guest Name Prompt Overlay */}
            {showNamePrompt && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <div style={{ width: "64px", height: "64px", backgroundColor: "rgba(59, 130, 246, 0.1)", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                            <User size={32} color="var(--primary)" />
                        </div>
                        <h2 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "8px", color: "white" }}>Welcome Guest!</h2>
                        <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "24px" }}>
                            Please provide a display name to join the community and start coding.
                        </p>
                        <form onSubmit={handleGuestJoin}>
                            <input
                                autoFocus
                                type="text"
                                placeholder="E.g. CodeMaster99"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                style={modalInputStyle}
                                maxLength={20}
                            />
                            <button type="submit" style={modalButtonStyle}>
                                Enter Workspace
                            </button>
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
    justifyContent: "center",
    width: "40px",
    height: "40px",
    backgroundColor: "rgba(255,255,255,0.03)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.2s"
};

const streamingPrimaryButtonStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.2s"
};

const modeButtonStyle = {
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s"
};

const streamingSidebarStyle = {
    height: "100%",
    backgroundColor: "var(--bg-card)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
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
    fontSize: "13px",
    fontWeight: active ? "700" : "600",
    cursor: "pointer",
    paddingBottom: "4px",
    borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
    transition: "all 0.2s"
});

const sidebarInputStyle = {
    width: "100%",
    padding: "12px 16px",
    paddingRight: "60px",
    backgroundColor: "rgba(255,255,255,0.03)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    color: "var(--text-main)",
    fontSize: "13px",
    outline: "none",
    transition: "border-color 0.2s"
};

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
    backgroundColor: active ? "var(--bg-dark)" : "transparent",
    borderRight: "1px solid var(--border-color)",
    color: active ? "var(--primary)" : "var(--text-muted)",
    cursor: "pointer",
    fontSize: "13px",
    minWidth: "140px",
    fontWeight: active ? "700" : "500"
});

const closeTabStyle = {
    marginLeft: "auto",
    background: "transparent",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    padding: "2px",
    fontSize: "16px"
};

const footerStyle = {
    height: "32px",
    padding: "0 16px",
    backgroundColor: "var(--bg-card)",
    borderTop: "1px solid var(--border-color)",
    display: "flex",
    alignItems: "center"
};

const splitterStyle = {
    backgroundColor: "var(--border-color)",
    width: "3px",
    transition: "all 0.2s"
};

const modalOverlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000
};

const modalContentStyle = {
    backgroundColor: "var(--bg-card)",
    padding: "40px",
    borderRadius: "24px",
    width: "100%",
    maxWidth: "400px",
    border: "1px solid var(--border-color)",
    textAlign: "center",
    boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
};

const modalInputStyle = {
    width: "100%",
    padding: "16px",
    backgroundColor: "rgba(255,255,255,0.03)",
    border: "1px solid var(--border-color)",
    borderRadius: "16px",
    color: "var(--text-main)",
    fontSize: "15px",
    marginBottom: "20px",
    outline: "none",
    textAlign: "center",
    fontWeight: "600"
};

const modalButtonStyle = {
    width: "100%",
    padding: "14px",
    backgroundColor: "var(--primary)",
    color: "white",
    border: "none",
    borderRadius: "16px",
    fontWeight: "800",
    cursor: "pointer",
    fontSize: "15px",
    transition: "transform 0.2s"
};

export default ProjectPage;
