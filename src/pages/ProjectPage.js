import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import "react-reflex/styles.css";
import {
    FileText,
    Folder,
    Plus,
    X,
    MessageSquare,
    LogOut,
    Palette,
    Wifi,
    Pencil,
    Video,
    Terminal,
    FileCode,
    Users,
    Play
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

    const [sidebarTab, setSidebarTab] = useState('files'); // files, chat, users, settings
    const hasJoinedRef = useRef(false);
    const [showVideo, setShowVideo] = useState(true);

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
        const fileName = prompt("Enter file name (e.g. style.css):");
        if (!fileName) return;

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
            {/* Premium Glassmorphism Header */}
            <header style={studioHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={logoWrapperStyle} onClick={() => navigate('/dashboard')}>
                        <img src="/utkristi-labs.png" alt="Logo" style={{ height: '20px', objectFit: 'contain' }} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '800', letterSpacing: '-0.01em', color: 'var(--text-main)' }}>
                                {project ? `${project.name}....studio` : "Loading....studio"}
                            </h2>
                            <span style={statusBadgeStyle}>LIVE</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collaboration Hub</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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

                    <button style={shareButtonStyle} onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success("Invite link copied!");
                    }}>
                        <Users size={14} /> <span>Invite</span>
                    </button>

                    <div style={headerDividerStyle} />

                    <button style={videoToggleStyle(showVideo)} onClick={() => setShowVideo(!showVideo)}>
                        <Video size={16} />
                    </button>
                </div>
            </header>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                {/* Control Bar (Thin vertical strip for tabs) */}
                <div style={controlBarStyle}>
                    <button style={controlTabButtonStyle(sidebarTab === 'files')} onClick={() => setSidebarTab('files')} title="Files">
                        <Folder size={18} />
                    </button>
                    <button style={controlTabButtonStyle(sidebarTab === 'chat')} onClick={() => setSidebarTab('chat')} title="Chat">
                        <div style={{ position: 'relative' }}>
                            <MessageSquare size={18} />
                            {messages.length > 0 && <div style={notifDotStyle} />}
                        </div>
                    </button>
                    <button style={controlTabButtonStyle(sidebarTab === 'users')} onClick={() => setSidebarTab('users')} title="Participants">
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

                <ReflexContainer orientation="vertical" style={{ flex: 1 }}>
                    {/* Left Sidebar: Contextual Content */}
                    <ReflexElement flex={0.15} minSize={200} style={{ backgroundColor: 'var(--bg-card)', borderRight: '1px solid var(--border-color)' }}>
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div style={sidebarHeaderStyle}>
                                <span style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    {sidebarTab}
                                </span>
                                {sidebarTab === 'files' && (
                                    <Plus size={14} style={{ cursor: 'pointer', opacity: 0.6 }} onClick={handleAddFile} />
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
                                            >
                                                <FileCode size={13} opacity={0.6} color={activeFile?.id === file.id ? 'var(--primary)' : 'inherit'} />
                                                <span style={{ fontSize: '12px', fontWeight: activeFile?.id === file.id ? '700' : '500' }}>{file.name}</span>
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

                    <ReflexSplitter style={splitterStyle} />

                    {/* Middle: Editor */}
                    <ReflexElement flex={0.7} minSize={400}>
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
                            <div style={{ flex: 1, position: 'relative' }}>
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
                            <footer style={studioFooterStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Wifi size={12} color="#10b981" />
                                    <span>Cloud Integrated</span>
                                </div>
                                <div>{activeFile ? `${activeFile.name.split('.').pop().toUpperCase()} Environment` : 'Ready'}</div>
                            </footer>
                        </div>
                    </ReflexElement>

                    <ReflexSplitter style={splitterStyle} />

                    {/* Right Sidebar: Video & Tools */}
                    {showVideo && (
                        <ReflexElement flex={0.15} minSize={240} style={{ backgroundColor: 'var(--bg-card)', borderLeft: '1px solid var(--border-color)' }}>
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <div style={sidebarHeaderStyle}>
                                    <span style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>SESSION STREAM</span>
                                </div>
                                <div style={{ flex: 1, backgroundColor: '#000', position: 'relative' }}>
                                    <VideoChat
                                        socketRef={socketRef}
                                        projectId={projectId}
                                        user={user || { name: socketRef.current?.userName, isGuest: true }}
                                    />
                                </div>
                                <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)' }}>ACTIVE TOOLS</span>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <button style={toolMiniButtonStyle} onClick={() => setShowWhiteboard(true)}><Pencil size={12} /> Board</button>
                                        <button style={toolMiniButtonStyle}><Play size={12} /> Run</button>
                                    </div>
                                </div>
                            </div>
                        </ReflexElement>
                    )}
                </ReflexContainer>
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
    );
};

const studioHeaderStyle = {
    height: '60px',
    backgroundColor: 'rgba(13, 17, 23, 0.8)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    zIndex: 1000,
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
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
    padding: '6px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-muted)',
    fontSize: '11px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer'
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
