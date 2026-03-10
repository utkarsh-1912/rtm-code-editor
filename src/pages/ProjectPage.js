import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import "react-reflex/styles.css";
import {
    FileText,
    Folder,
    Plus,
    Trash2,
    Play,
    Code,
    Layout,
    MousePointer2,
    Users,
    Home,
    Search,
    Video,
    PencilLine
} from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "../components/AppLayout";
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
    const [showPreview, setShowPreview] = useState(true);
    const [remoteCursors, setRemoteCursors] = useState({}); // { socketId: { x, y, name } }
    const [isPresenter, setIsPresenter] = useState(false);
    const [showVideoPane, setShowVideoPane] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [showWhiteboard, setShowWhiteboard] = useState(false);
    const [settings, setSettings] = useState({
        fontSize: 16,
        tabSize: 4,
        keybinding: "default",
        enableLinting: true,
        wordWrap: true
    });

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [mobileView, setMobileView] = useState("editor"); // "files", "editor", "preview", "collab"

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

                // Initialize Socket
                socketRef.current = await initSocket();
                socketRef.current.on('connect_error', (err) => handleErrors(err));
                socketRef.current.on('connect_failed', (err) => handleErrors(err));

                function handleErrors(e) {
                    console.log('socket error', e);
                    toast.error('Socket connection failed, try again later.');
                    navigate('/dashboard');
                }

                socketRef.current.userName = user?.name || 'Guest';
                socketRef.current.emit(ACTIONS.PROJECT_JOIN, {
                    projectId,
                    userName: user?.name || 'Guest',
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

        if (user) init();

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
                userName: user?.name || "Guest",
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

    const handleDeleteFile = async (e, file) => {
        e.stopPropagation();
        if (!window.confirm(`Delete ${file.name}?`)) return;

        try {
            const backendUrl = getBackendUrl();
            await fetch(`${backendUrl}/api/projects/${projectId}/files?path=${file.path}`, {
                method: 'DELETE'
            });
            setFiles(prev => prev.filter(f => f.id !== file.id));
            setOpenFiles(prev => prev.filter(f => f.id !== file.id));
            if (activeFile?.id === file.id) setActiveFile(null);
            toast.success("File deleted");
        } catch (err) {
            toast.error("Failed to delete file");
        }
    };

    const handleMouseMove = (e) => {
        if (!socketRef.current) return;
        const { clientX: x, clientY: y } = e;
        socketRef.current.emit(ACTIONS.MOUSE_MOVE, {
            roomId: projectId,
            mouse: { x, y },
            userName: user?.name
        });
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

    const generatePreviewDoc = () => {
        const htmlFile = files.find(f => f.name.endsWith('.html')) || { content: "<h1>No index.html found</h1>" };
        const cssFiles = files.filter(f => f.name.endsWith('.css'));
        const jsFiles = files.filter(f => f.name.endsWith('.js'));

        let combinedDoc = htmlFile.content;

        // Inject Styles
        const styles = cssFiles.map(f => `<style data-name="${f.name}">${f.content}</style>`).join('\n');
        combinedDoc = combinedDoc.replace('</head>', `${styles}\n</head>`);
        if (!combinedDoc.includes('</head>')) combinedDoc = styles + combinedDoc;

        // Inject Scripts
        const scripts = jsFiles.map(f => `<script data-name="${f.name}">${f.content}</script>`).join('\n');
        combinedDoc = combinedDoc.replace('</body>', `${scripts}\n</body>`);
        if (!combinedDoc.includes('</body>')) combinedDoc = combinedDoc + scripts;

        return combinedDoc;
    };

    if (loading) return (
        <AppLayout>
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="loader"></div>
            </div>
        </AppLayout>
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
        <AppLayout hideSidebar={isMobile}>
            <div
                onMouseMove={handleMouseMove}
                style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-dark)", position: "relative" }}
            >
                {/* Remote Cursors (Desktop only for performance) */}
                {!isMobile && Object.entries(remoteCursors).map(([id, cursor]) => (
                    id !== socketRef.current?.id && (
                        <div key={id} style={{
                            position: "fixed",
                            left: cursor.x,
                            top: cursor.y,
                            zIndex: 9999,
                            pointerEvents: "none",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center"
                        }}>
                            <MousePointer2 size={16} fill="var(--primary)" color="white" />
                            <span style={{
                                backgroundColor: "var(--primary)",
                                color: "white",
                                fontSize: "10px",
                                padding: "2px 4px",
                                borderRadius: "4px",
                                fontWeight: "bold",
                                whiteSpace: "nowrap"
                            }}>{cursor.name}</span>
                        </div>
                    )
                ))}

                {/* Project Header */}
                <div style={isMobile ? mobileHeaderStyle : headerStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <Home size={18} style={{ cursor: "pointer", color: "var(--text-muted)" }} onClick={() => navigate("/dashboard")} />
                        <span style={{ color: "var(--text-muted)" }}>/</span>
                        <h1 style={{ fontSize: "14px", fontWeight: "700", margin: 0 }}>{project?.name}</h1>
                    </div>

                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
                        <button onClick={() => setShowWhiteboard(true)} style={actionButtonStyle}>
                            <PencilLine size={18} />
                            {!isMobile && <span>Whiteboard</span>}
                        </button>
                        {!isMobile && (
                            <>
                                <select
                                    value={settings.keybinding}
                                    onChange={(e) => setSettings(prev => ({ ...prev, keybinding: e.target.value }))}
                                    style={selectStyle}
                                >
                                    <option value="default">Standard</option>
                                    <option value="vim">Vim Mode</option>
                                    <option value="emacs">Emacs Mode</option>
                                </select>
                                <button
                                    onClick={toggleFollowMe}
                                    style={{
                                        ...actionButtonStyle,
                                        backgroundColor: isPresenter ? "rgba(239, 68, 68, 0.1)" : "var(--bg-dark)",
                                        color: isPresenter ? "#ef4444" : "var(--text-main)",
                                        borderColor: isPresenter ? "#ef4444" : "var(--border-color)"
                                    }}
                                >
                                    <Users size={18} />
                                    <span>{isPresenter ? "Stop Presenting" : "Follow Me"}</span>
                                </button>
                                <button onClick={() => setShowPreview(!showPreview)} style={actionButtonStyle}>
                                    <Layout size={18} />
                                    <span>{showPreview ? "Hide Preview" : "Show Preview"}</span>
                                </button>
                                <button onClick={() => setShowVideoPane(!showVideoPane)} style={{
                                    ...actionButtonStyle,
                                    backgroundColor: showVideoPane ? "rgba(59, 130, 246, 0.1)" : "var(--bg-dark)",
                                    color: showVideoPane ? "var(--primary)" : "var(--text-main)",
                                    borderColor: showVideoPane ? "var(--primary)" : "var(--border-color)"
                                }}>
                                    <Video size={18} />
                                    <span>Voice/Video</span>
                                </button>
                            </>
                        )}
                        <button style={primaryButtonStyle}>
                            <Play size={16} />
                            {!isMobile && <span>Deploy</span>}
                        </button>
                    </div>
                </div>

                {/* Workspace Container */}
                <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    {!isMobile ? (
                        <ReflexContainer orientation="vertical">
                            {/* File Tree Sidebar */}
                            <ReflexElement size={240} minSize={150}>
                                <div style={fileTreeContainerStyle}>
                                    <div style={treeHeaderStyle}>
                                        <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase" }}>Files</span>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <Plus size={14} style={{ cursor: "pointer" }} onClick={handleCreateFile} />
                                            <Search size={14} style={{ cursor: "pointer" }} />
                                        </div>
                                    </div>
                                    <div style={{ padding: "10px" }}>
                                        {files.map(file => (
                                            <div
                                                key={file.id}
                                                onClick={() => handleFileClick(file)}
                                                style={fileItemStyle(activeFile?.id === file.id)}
                                                className="file-item"
                                            >
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                                                    <FileText size={14} />
                                                    <span style={{ fontSize: "13px" }}>{file.name}</span>
                                                </div>
                                                <Trash2
                                                    size={12}
                                                    className="delete-icon"
                                                    style={{ opacity: 0, cursor: "pointer" }}
                                                    onClick={(e) => handleDeleteFile(e, file)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </ReflexElement>

                            <ReflexSplitter style={splitterStyle} />

                            {/* Editor Area */}
                            <ReflexElement flex={1}>
                                <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                                    {/* Tabs */}
                                    <div style={tabContainerStyle}>
                                        {openFiles.map(file => (
                                            <div
                                                key={file.id}
                                                onClick={() => setActiveFile(file)}
                                                style={tabStyle(activeFile?.id === file.id)}
                                            >
                                                <FileText size={12} />
                                                <span>{file.name}</span>
                                                <button
                                                    style={closeTabStyle}
                                                    onClick={(e) => handleCloseTab(e, file.id)}
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Editor */}
                                    <div style={{ flex: 1, overflow: "hidden" }}>
                                        {activeFile && (
                                            <EditorComp
                                                socketRef={socketRef}
                                                roomId={`project-${projectId}-${activeFile.id}`}
                                                onCodeChange={(code) => {
                                                    handleSaveFile(code);
                                                }}
                                                initialCode={activeFile.content}
                                                language={activeFile.name.split('.').pop() === 'js' ? 'javascript' : activeFile.name.split('.').pop() === 'html' ? 'html' : 'css'}
                                                settings={settings}
                                            />
                                        )}
                                    </div>
                                </div>
                            </ReflexElement>

                            {showPreview && (
                                <>
                                    <ReflexSplitter style={splitterStyle} />
                                    <ReflexElement size={400} minSize={200}>
                                        <div style={previewContainerStyle}>
                                            <div style={previewHeaderStyle}>
                                                <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--text-muted)" }}>LIVE PREVIEW</span>
                                                <button style={refreshButtonStyle}>Refresh</button>
                                            </div>
                                            <iframe
                                                title="preview"
                                                style={{ width: "100%", height: "100%", border: "none", backgroundColor: "white" }}
                                                srcDoc={generatePreviewDoc()}
                                            />
                                        </div>
                                    </ReflexElement>
                                </>
                            )}

                            {showVideoPane && (
                                <>
                                    <ReflexSplitter style={splitterStyle} />
                                    <ReflexElement size={300} minSize={200}>
                                        <div style={{ height: "100%", backgroundColor: "var(--bg-card)", borderLeft: "1px solid var(--border-color)", padding: "16px" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                                                <h3 style={{ fontSize: "14px", fontWeight: "700", margin: 0 }}>Collaboration</h3>
                                                <button onClick={() => setShowVideoPane(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>&times;</button>
                                            </div>
                                            <VideoChat socketRef={socketRef} projectId={projectId} user={user} />

                                            <div style={{ flex: 1, display: "flex", flexDirection: "column", marginTop: "20px", overflow: "hidden" }}>
                                                <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "10px" }}>Discussion</span>
                                                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "10px" }}>
                                                    {messages.map(msg => (
                                                        <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary)" }}>{msg.userName}</span>
                                                                <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>{msg.time}</span>
                                                            </div>
                                                            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-main)", backgroundColor: "rgba(255,255,255,0.05)", padding: "10px", borderRadius: "8px" }}>{msg.text}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Write a message..."
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    onKeyDown={handleSendMessage}
                                                    style={{
                                                        width: "100%",
                                                        padding: "10px",
                                                        backgroundColor: "var(--bg-dark)",
                                                        border: "1px solid var(--border-color)",
                                                        borderRadius: "8px",
                                                        color: "var(--text-main)",
                                                        fontSize: "13px",
                                                        outline: "none"
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </ReflexElement>
                                </>
                            )}
                        </ReflexContainer>
                    ) : (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                            {mobileView === "files" && (
                                <div style={{ ...fileTreeContainerStyle, width: "100%" }}>
                                    <div style={treeHeaderStyle}>
                                        <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase" }}>Files</span>
                                        <Plus size={16} onClick={handleCreateFile} />
                                    </div>
                                    <div style={{ padding: "12px" }}>
                                        {files.map(file => (
                                            <div
                                                key={file.id}
                                                onClick={() => { handleFileClick(file); setMobileView("editor"); }}
                                                style={fileItemStyle(activeFile?.id === file.id)}
                                            >
                                                <FileText size={16} />
                                                <span>{file.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {mobileView === "editor" && (
                                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                                    {/* Tabs */}
                                    <div style={{ ...tabContainerStyle, overflowX: "auto", overflowY: "hidden", whiteSpace: "nowrap" }}>
                                        {openFiles.map(file => (
                                            <div
                                                key={file.id}
                                                onClick={() => setActiveFile(file)}
                                                style={{ ...tabStyle(activeFile?.id === file.id), minWidth: "120px" }}
                                            >
                                                <FileText size={12} />
                                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</span>
                                                <button style={closeTabStyle} onClick={(e) => handleCloseTab(e, file.id)}>&times;</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        {activeFile && (
                                            <EditorComp
                                                socketRef={socketRef}
                                                roomId={`project-${projectId}-${activeFile.id}`}
                                                onCodeChange={(code) => handleSaveFile(code)}
                                                initialCode={activeFile.content}
                                                language={activeFile.name.split('.').pop() === 'js' ? 'javascript' : activeFile.name.split('.').pop() === 'html' ? 'html' : 'css'}
                                                settings={settings}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            {mobileView === "preview" && (
                                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                                    <iframe
                                        title="preview"
                                        style={{ width: "100%", height: "100%", border: "none", backgroundColor: "white" }}
                                        srcDoc={generatePreviewDoc()}
                                    />
                                </div>
                            )}

                            {mobileView === "collab" && (
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px", backgroundColor: "var(--bg-card)" }}>
                                    <VideoChat socketRef={socketRef} projectId={projectId} user={user} />
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", marginTop: "20px", overflow: "hidden" }}>
                                        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                                            {messages.map(msg => (
                                                <div key={msg.id} style={{ display: "flex", flexDirection: "column" }}>
                                                    <span style={{ fontSize: "11px", color: "var(--primary)" }}>{msg.userName}</span>
                                                    <p style={{ margin: 0, fontSize: "13px", backgroundColor: "rgba(255,255,255,0.05)", padding: "10px", borderRadius: "8px" }}>{msg.text}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Write a message..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={handleSendMessage}
                                            style={{ width: "100%", padding: "12px", backgroundColor: "var(--bg-dark)", border: "1px solid var(--border-color)", borderRadius: "10px", color: "var(--text-main)", marginTop: "10px" }}
                                        />
                                    </div>
                                </div>
                            )}

                            {renderMobileTabs()}
                        </div>
                    )}
                </div>
            </div>
            <WhiteboardModal
                isOpen={showWhiteboard}
                onClose={() => setShowWhiteboard(false)}
                socketRef={socketRef}
                roomId={projectId}
                user={user}
            />
        </AppLayout>
    );
};

// Styles
const headerStyle = {
    height: "56px",
    padding: "0 24px",
    backgroundColor: "var(--bg-card)",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    alignItems: "center",
    flexShrink: 0
};

const mobileHeaderStyle = {
    ...headerStyle,
    padding: "0 16px",
    height: "48px"
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

const actionButtonStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "var(--bg-dark)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
    padding: "6px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
};

const primaryButtonStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "var(--primary)",
    color: "white",
    border: "none",
    padding: "6px 16px",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
};

const selectStyle = {
    backgroundColor: "var(--bg-dark)",
    border: "1px solid var(--border-color)",
    color: "var(--text-main)",
    padding: "6px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    outline: "none",
    cursor: "pointer",
    fontWeight: "600"
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
    backgroundColor: active ? "transparent" : "var(--bg-dark)",
    borderRight: "1px solid var(--border-color)",
    borderTop: active ? "2px solid var(--primary)" : "2px solid transparent",
    color: active ? "white" : "var(--text-muted)",
    cursor: "pointer",
    fontSize: "13px",
    minWidth: "120px"
});

const closeTabStyle = {
    marginLeft: "10px",
    background: "transparent",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    padding: "2px"
};

const previewContainerStyle = {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "white"
};

const previewHeaderStyle = {
    height: "40px",
    padding: "0 16px",
    backgroundColor: "var(--bg-card)",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
};

const refreshButtonStyle = {
    fontSize: "10px",
    fontWeight: "700",
    textTransform: "uppercase",
    backgroundColor: "var(--bg-dark)",
    color: "var(--primary)",
    border: "1px solid var(--border-color)",
    padding: "4px 8px",
    borderRadius: "4px",
    cursor: "pointer"
};

const splitterStyle = {
    backgroundColor: "var(--border-color)",
    width: "2px",
    transition: "all 0.2s"
};

export default ProjectPage;
