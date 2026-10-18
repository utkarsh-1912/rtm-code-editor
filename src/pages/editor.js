import React, { useState, useRef, useEffect } from "react";
import {
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
import toast from "react-hot-toast";
import {
  Download,
  Copy,
  LogOut,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Terminal,
  Code,
  Share2,
  Settings,
  Users,
  LayoutDashboard,
  Zap
} from "lucide-react";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import "react-reflex/styles.css";

import ACTIONS from "../Action";
import { initSocket } from "../socket";
import EditorComp, { roomFileName } from "../components/editorComp";
import ChatWindow from "../components/chatWindow";
import OutputWindow from "../components/outputWindow";
import SettingsModal from "../components/SettingsModal";
import GistModal from "../components/GistModal";
import { Github } from "lucide-react";
import Client from "../components/clients";
import { LANGUAGES, THEMES } from "../config";
import { useAuth } from "../context/AuthContext";
import { resolveTheme, setThemePref } from "../utils/theme";
import "../styles/app.css";
import LoadingScreen from "../components/LoadingScreen";
import SnippetModal from "../components/SnippetModal";
import { ImportIcon, PencilLine } from "lucide-react";
import WhiteboardModal from "../components/WhiteboardModal";
import AICopilotModal from "../components/AICopilotModal";
import DiffViewerModal from "../components/DiffViewerModal";
import AnalyticsDashboardModal from "../components/AnalyticsDashboardModal";
import FocusModeModal from "../components/FocusModeModal";
import { Bot, History, Activity, Video as VideoIcon } from "lucide-react";
import VideoChat from "../components/VideoChat";
import WorkspaceHeader from "../components/WorkspaceHeader";

function Editor() {
  const socketRef = useRef(null);
  const location = useLocation();
  const reactNavigator = useNavigate();
  const { roomId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [userName, setUserName] = useState(location.state?.userName || localStorage.getItem("guest-name") || "");
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestInput, setGuestInput] = useState("");

  const codeRef = useRef(localStorage.getItem(`code-${roomId}`) || "");

  const [clients, setClients] = useState([]);
  const [language, setLanguage] = useState(LANGUAGES[0].value);
  const languageRef = useRef(language);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const [theme] = useState(THEMES[0]);
  const [currentCode, setCurrentCode] = useState(codeRef.current);

  const [output, setOutput] = useState("");
  const [isError, setIsError] = useState(false);
  const [execTime, setExecTime] = useState(undefined);
  const [isExecuting, setIsExecuting] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isLightMode, setIsLightMode] = useState(() => resolveTheme() === "light");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState("code"); // "code" | "output" | "chat"

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(`chat-${roomId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const [stdin, setStdin] = useState("");

  const [role] = useState(location.state?.role || "editor");
  const isReadOnly = role === "viewer";

  // Editor Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [showGistModal, setShowGistModal] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("app-editor-settings");
      return saved ? JSON.parse(saved) : { fontSize: 16, tabSize: 4, wordWrap: false };
    } catch { return { fontSize: 16, tabSize: 4, wordWrap: false }; }
  });

  const [showSnippetModal, setShowSnippetModal] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [isMeetingMinimized, setIsMeetingMinimized] = useState(false);
  const [isMeetingStarting, setIsMeetingStarting] = useState(false);
  const [mediaStates, setMediaStates] = useState({});

  useEffect(() => {
    localStorage.setItem("app-editor-settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(`chat-${roomId}`, JSON.stringify(messages));
  }, [messages, roomId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowFocusModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (user && user.name) {
      setUserName(user.name);
    } else {
      const savedGuestName = localStorage.getItem("guest-name");
      if (savedGuestName) {
        setUserName(savedGuestName);
      } else if (!location.state?.userName) {
        setShowGuestModal(true);
      }
    }
  }, [authLoading, user, location.state]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleTheme = () => {
    setIsLightMode(setThemePref(isLightMode ? "dark" : "light"));
  };

  const downloadCode = () => {
    const content = codeRef.current;
    if (!content) {
      toast.error("No code to download!");
      return;
    }
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    a.download = roomFileName(language);
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Code downloaded successfully!");
  };

  const handleSnippetImport = (snippetCode, mode) => {
    let newCode = "";
    if (mode === 'replace') {
      newCode = snippetCode;
    } else {
      // For 'insert', we could try to find cursor position, but simpler for now is to append 
      // since the editor component handles its own internal cursor state.
      // We'll append with a newline if current code isn't empty.
      newCode = codeRef.current ? `${codeRef.current}\n\n${snippetCode}` : snippetCode;
    }

    codeRef.current = newCode;
    setCurrentCode(newCode);
    localStorage.setItem(`code-${roomId}`, newCode);

    // Emit to others
    socketRef.current?.emit(ACTIONS.CODE_CHANGE, {
      roomId,
      code: newCode,
    });

    toast.success(`Snippet ${mode === 'replace' ? 'imported' : 'inserted'}`);
    setShowSnippetModal(false);
  };

  const activeTabRef = useRef(activeTab);
  const isMobileRef = useRef(isMobile);
  const isChatCollapsedRef = useRef(isChatCollapsed);

  useEffect(() => {
    activeTabRef.current = activeTab;
    isMobileRef.current = isMobile;
    isChatCollapsedRef.current = isChatCollapsed;
  }, [activeTab, isMobile, isChatCollapsed]);

  useEffect(() => {
    if (authLoading || !userName) return;
    const init = async () => {
      // Helper to get sanitized backend URL
      const getBackendUrl = () => {
        let url = process.env.REACT_APP_BACKEND_URL || window.location.origin;
        if (url.endsWith("/")) url = url.slice(0, -1);
        // Ensure it doesn't just result in "https:" or similar malformed strings
        if (url === "https:" || url === "http:") url = window.location.origin;
        return url;
      };

      const backendUrl = getBackendUrl();

      // Wake up the server if it's sleeping (Render)
      const wakeServer = async () => {
        // Reduced timeout for better UX
        const loadingTimeout = setTimeout(() => setShowLoading(true), 800);

        try {
          const resp = await fetch(`${backendUrl}/api/ping`);
          if (resp.ok) {
            clearTimeout(loadingTimeout);
            setShowLoading(false);
            return true;
          }
        } catch (e) {
          // Fallback to retry loop if immediate ping fails
        }

        let retries = 0;
        const maxRetries = 15;
        while (retries < maxRetries) {
          try {
            const resp = await fetch(`${backendUrl}/api/ping`);
            if (resp.ok) {
              clearTimeout(loadingTimeout);
              setShowLoading(false);
              return true;
            }
          } catch (e) { }
          retries++;
          await new Promise(r => setTimeout(r, 800));
        }
        clearTimeout(loadingTimeout);
        return false;
      };

      const isAlive = await wakeServer();
      if (!isAlive) {
        toast.error("System unreachable. Please try again.");
        reactNavigator("/");
        return;
      }

      socketRef.current = await initSocket();
      if (!isMounted) {
        socketRef.current.disconnect();
        return;
      }
      setSocketConnected(true);
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      function handleErrors(err) {
        console.log("socket error", err);
        toast.error("Socket Connection failed. Try Again !!");
        reactNavigator("/");
      }

      socketRef.current.userName = userName;
      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        userName: userName,
        userProfile: user,
      });

      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, userName: joinedUser, socketId }) => {
          if (joinedUser !== userName) {
            toast.success(`${joinedUser} joined !`);
          }
          setClients(clients);

          if (socketRef.current.id !== socketId) {
            socketRef.current.emit(ACTIONS.SYNC_CODE, {
              socketId,
              code: codeRef.current,
            });
            // Also sync current language to the newly joined peer
            socketRef.current.emit(ACTIONS.SYNC_LANGUAGE, {
              roomId,
              language: languageRef.current,
            });
          }
        }
      );

      socketRef.current.on("media-state-update", ({ userId, state }) => {
        setMediaStates((prev) => ({ ...prev, [userId]: { ...prev[userId], ...state } }));
      });

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, userName }) => {
        toast.error(`${userName} left the room !`);
        setClients((prev) => prev.filter((client) => client.socketId !== socketId));
      });

      socketRef.current.on(ACTIONS.SYNC_EXECUTE, ({ isExecuting }) => {
        setIsExecuting(isExecuting);
      });

      socketRef.current.on(ACTIONS.SYNC_OUTPUT, ({ output, isError, time }) => {
        setOutput(output);
        setIsError(isError);
        setExecTime(time);
      });

      socketRef.current.on(ACTIONS.SYNC_LANGUAGE, ({ language }) => {
        setLanguage(language);
      });

      socketRef.current.on(ACTIONS.SYNC_CHAT, ({ messages: history }) => {
        setMessages(history);
      });

      socketRef.current.on(ACTIONS.RECEIVE_MESSAGE, (msg) => {
        setMessages((prev) => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Handle unread count using refs for current state
        if (activeTabRef.current !== "chat" && (isMobileRef.current || isChatCollapsedRef.current)) {
          setUnreadChatCount((prev) => prev + 1);
        }
      });

      socketRef.current.on(ACTIONS.EDIT_MESSAGE, ({ messageId, newText }) => {
        setMessages((prev) => prev.map(m => m.id === messageId ? { ...m, text: newText, isEdited: true } : m));
      });

      socketRef.current.on(ACTIONS.DELETE_MESSAGE, ({ messageId }) => {
        setMessages((prev) => prev.filter(m => m.id !== messageId));
      });
    };

    let isMounted = true;
    init();

    return () => {
      isMounted = false;
      const socket = socketRef.current;
      if (socket) {
        socket.disconnect();
        socket.off(ACTIONS.JOINED);
        socket.off(ACTIONS.DISCONNECTED);
        socket.off(ACTIONS.SYNC_EXECUTE);
        socket.off(ACTIONS.SYNC_OUTPUT);
        socket.off(ACTIONS.SYNC_LANGUAGE);
        socket.off(ACTIONS.SYNC_CHAT);
        socket.off(ACTIONS.RECEIVE_MESSAGE);
        socket.off(ACTIONS.EDIT_MESSAGE);
        socket.off(ACTIONS.DELETE_MESSAGE);
      }
    };
  }, [roomId, userName, reactNavigator, user, authLoading]);

  // Reset unread count when chat is viewed
  useEffect(() => {
    if ((activeTab === "chat" && isMobile) || (!isChatCollapsed && !isMobile)) {
      setUnreadChatCount(0);
    }
  }, [activeTab, isChatCollapsed, isMobile]);

  if (authLoading) {
    return (
      <div className="ws">
        <LoadingScreen message="Checking your session" />
      </div>
    );
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room Id copied to clipboard", {
        style: { fontFamily: "Arima", fontWeight: "bold" },
      });
    } catch (err) {
      toast.error("Unable to copy ROOM ID");
      console.log(err);
    }
  };

  const leaveRoom = () => {
    socketRef.current?.emit(ACTIONS.LEAVE, { roomId });
    reactNavigator("/");
  };

  const handleShare = async (shareRole = "editor") => {
    const roleParam = shareRole === "viewer" ? "&role=viewer" : "";
    const shareUrl = `${window.location.origin}/?room=${roomId}${roleParam}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(shareRole === "viewer" ? "Spectator link copied!" : "Editor link copied!");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleCompile = async () => {
    if (isReadOnly) {
      toast.error("Spectators cannot execute code.");
      return;
    }
    setIsExecuting(true);
    socketRef.current?.emit(ACTIONS.SYNC_EXECUTE, { roomId, isExecuting: true });

    const langObj = LANGUAGES.find((l) => l.value === language);
    const languageId = langObj ? langObj.id : 63;

    // Safe base64 encoding for Unicode/emoji characters
    const safeBase64 = (str) => {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch {
        return btoa(str);
      }
    };
    const formData = {
      language_id: languageId,
      source_code: safeBase64(codeRef.current),
      ...(stdin.trim() && { stdin: safeBase64(stdin) })
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
      const errMsg = "Something went wrong while attempting to run your code.\nPlease check API limits or connectivity.";
      setOutput(errMsg);
      setIsError(true);
      setIsExecuting(false);
      socketRef.current?.emit(ACTIONS.SYNC_OUTPUT, { roomId, output: errMsg, isError: true, time: undefined });
      socketRef.current?.emit(ACTIONS.SYNC_EXECUTE, { roomId, isExecuting: false });
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
        if ((pollExecutionResult._retries || 0) < 20) {
          pollExecutionResult._retries = (pollExecutionResult._retries || 0) + 1;
          setTimeout(() => pollExecutionResult(token), 2000);
        } else {
          pollExecutionResult._retries = 0;
          setIsExecuting(false);
          setOutput("Execution timed out. Please try again.");
          setIsError(true);
          socketRef.current?.emit(ACTIONS.SYNC_EXECUTE, { roomId, isExecuting: false });
        }
        return;
      } else {
        setIsExecuting(false);
        socketRef.current?.emit(ACTIONS.SYNC_EXECUTE, { roomId, isExecuting: false });

        const decodedOutput = data.stdout ? atob(data.stdout) : null;
        const decodedError = data.stderr ? atob(data.stderr) : null;
        const decodedCompileOutput = data.compile_output ? atob(data.compile_output) : null;

        if (data.status?.id === 3) {
          const finalOut = decodedOutput !== null ? decodedOutput : "Code Executed Successfully. No Output.";
          setOutput(finalOut);
          setIsError(false);
          socketRef.current?.emit(ACTIONS.SYNC_OUTPUT, { roomId, output: finalOut, isError: false, time: data.time });
        } else {
          const finalErr = decodedError || decodedCompileOutput || data.status?.description || "Unknown Error";
          setOutput(finalErr);
          setIsError(true);
          socketRef.current?.emit(ACTIONS.SYNC_OUTPUT, { roomId, output: finalErr, isError: true, time: data.time });
        }
        setExecTime(data.time);
      }
    } catch (err) {
      console.error(err);
      const errMsg = "Error retrieving execution output from Judge0.";
      setOutput(errMsg);
      setIsError(true);
      setIsExecuting(false);
      socketRef.current?.emit(ACTIONS.SYNC_OUTPUT, { roomId, output: errMsg, isError: true, time: undefined });
      socketRef.current?.emit(ACTIONS.SYNC_EXECUTE, { roomId, isExecuting: false });
    }
  };

  return (
    <div className="ws">

      <WorkspaceHeader
        isMobile={isMobile}
        isLightMode={isLightMode}
        onLogo={() => reactNavigator("/")}
        mode="Room"
        title={roomId.substring(0, 8)}
        onTitleClick={copyRoomId}
        clients={clients}
        currentUserName={userName}
        onRun={handleCompile}
        isExecuting={isExecuting}
        onToggleTheme={toggleTheme}
        actions={[
          { id: "call", label: isMeetingActive ? "Leave call" : "Start voice & video call", icon: <VideoIcon size={18} />, onClick: () => setIsMeetingActive((v) => !v), active: isMeetingActive, tone: "green" },
          { id: "board", label: "Whiteboard", icon: <PencilLine size={18} />, onClick: () => setShowWhiteboard(true) },
          { id: "ai", label: "AI Copilot", icon: <Bot size={18} />, onClick: () => setShowAICopilot(true) },
          { id: "share", label: "Copy editor link", icon: <Share2 size={18} />, onClick: () => handleShare("editor") },
          { id: "viewer", label: "Copy spectator link", icon: <Users size={18} />, onClick: () => handleShare("viewer"), section: "more" },
          { id: "history", label: "Version history", icon: <History size={18} />, onClick: () => setShowDiffViewer(true), section: "more" },
          { id: "analytics", label: "Analytics", icon: <Activity size={18} />, onClick: () => setShowAnalytics(true), section: "more" },
          ...(user ? [
            { id: "focus", label: "Focus mode (Alt+F)", icon: <Zap size={18} />, onClick: () => setShowFocusModal(true), section: "more" },
            { id: "snippet", label: "Import snippet", icon: <ImportIcon size={18} />, onClick: () => setShowSnippetModal(true), section: "more" },
          ] : []),
          { id: "gist", label: "Export to GitHub Gist", icon: <Github size={18} />, onClick: () => setShowGistModal(true), section: "more" },
          { id: "download", label: "Download code", icon: <Download size={18} />, onClick: downloadCode, section: "more" },
          { id: "copy", label: "Copy room ID", icon: <Copy size={18} />, onClick: copyRoomId, section: "more" },
          { id: "settings", label: "Editor settings", icon: <Settings size={18} />, onClick: () => setShowSettings(true), section: "more" },
          ...(user ? [{ id: "dash", label: "Back to dashboard", icon: <LayoutDashboard size={18} />, onClick: () => reactNavigator("/dashboard"), section: "more" }] : []),
          { id: "leave", label: "Leave room", icon: <LogOut size={18} />, onClick: leaveRoom, section: "more", tone: "red" },
        ]}
      />

      <div className="ws-body" style={{ flexDirection: "column" }}>
        {socketConnected ? (
          <>
            {isMobile ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {activeTab === "code" && (
                    <EditorComp
                      socketRef={socketRef}
                      roomId={roomId}
                      onCodeChange={(code) => {
                        codeRef.current = code;
                        setCurrentCode(code);
                      }}
                      language={language}
                      onLanguageChange={(newLang) => {
                        setLanguage(newLang);
                        socketRef.current?.emit(ACTIONS.SYNC_LANGUAGE, { roomId, language: newLang });
                      }}
                      theme={theme}
                      code={currentCode}
                      onRunCode={handleCompile}
                      isExecuting={isExecuting}
                      isLightMode={isLightMode}
                      isMobile={isMobile}
                      onDownload={downloadCode}
                      settings={settings}
                      isReadOnly={isReadOnly}
                      userName={userName}
                    />
                  )}
                  {activeTab === "output" && (
                    <OutputWindow output={output} isError={isError} time={execTime} isMobile={isMobile} stdin={stdin} setStdin={setStdin} isLightMode={isLightMode} />
                  )}
                  {activeTab === "chat" && (
                    <ChatWindow
                      socketRef={socketRef}
                      roomId={roomId}
                      userName={userName}
                      isLightMode={isLightMode}
                      isMobile={isMobile}
                      messages={messages}
                      setMessages={setMessages}
                    />
                  )}
                  {activeTab === "people" && (
                    <div style={{ height: "100%", overflowY: "auto" }}>
                      <div className="ws-pane-head"><span>People</span><b>{clients.length} online</b></div>
                      <div className="ws-people">
                        {clients.map((client) => (
                          <div key={client.socketId} className="ws-person">
                            <Client userName={client.userName} isCompact isCurrentUser={client.userName === userName} />
                            <b>{client.userName}</b>
                            {client.userName === userName && <em>you</em>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* MOBILE BOTTOM NAV */}
                <nav className="ws-tabbar" aria-label="Room">
                  {[
                    { id: "code", icon: <Code size={19} />, label: "Code" },
                    { id: "output", icon: <Terminal size={19} />, label: "I/O" },
                    { id: "chat", icon: <MessageSquare size={19} />, label: "Chat" },
                    { id: "people", icon: <Users size={19} />, label: "People" }
                  ].map((tab) => (
                    <button key={tab.id} className={activeTab === tab.id ? "on" : ""} onClick={() => setActiveTab(tab.id)}>
                      {tab.icon}<span>{tab.label}</span>
                      {tab.id === "chat" && unreadChatCount > 0 && <span className="u-count">{unreadChatCount}</span>}
                    </button>
                  ))}
                  <button onClick={() => setShowSettings(true)}>
                    <Settings size={19} /><span>Settings</span>
                  </button>
                </nav>
              </div>
            ) : (
              <div style={{ height: "100%", width: "100%", position: "relative" }}>
                {/* Toggle Notch for Chat Pane */}
                <button className="ws-notch" onClick={() => setIsChatCollapsed(!isChatCollapsed)} aria-label={isChatCollapsed ? "Show chat" : "Hide chat"} title={isChatCollapsed ? "Show chat" : "Hide chat"}>
                  {isChatCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                  {isChatCollapsed && unreadChatCount > 0 && <span className="u-count">{unreadChatCount}</span>}
                </button>

                <ReflexContainer orientation="vertical">
                  {!isChatCollapsed && (
                    <ReflexElement key="chat-pane" className="left-pane" flex={0.25} minSize={250}>
                      <div style={{ height: "100%", width: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                        <div className="ws-pane-head"><span>Room chat</span><b>{clients.length} online</b></div>
                        <div style={{ flex: 1, minHeight: 0 }}>
                          <ChatWindow
                            socketRef={socketRef}
                            roomId={roomId}
                            userName={userName}
                            isLightMode={isLightMode}
                            messages={messages}
                            setMessages={setMessages}
                          />
                        </div>
                      </div>
                    </ReflexElement>
                  )}

                  {!isChatCollapsed && (
                    <ReflexSplitter key="chat-splitter" />
                  )}

                  <ReflexElement key="main-pane" className="right-pane" flex={isChatCollapsed ? 1 : 0.75}>
                    <ReflexContainer orientation="horizontal">
                      <ReflexElement className="editor-pane" flex={0.65} minSize={200}>
                        <div style={{ height: "100%", width: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                          <div style={{ flex: 1, overflow: "hidden" }}>
                            <EditorComp
                            socketRef={socketRef}
                            roomId={roomId}
                            onCodeChange={(code) => {
                              codeRef.current = code;
                              setCurrentCode(code);
                            }}
                            language={language}
                            onLanguageChange={(newLang) => {
                              setLanguage(newLang);
                              socketRef.current?.emit(ACTIONS.SYNC_LANGUAGE, { roomId, language: newLang });
                            }}
                            theme={theme}
                            code={currentCode}
                            onRunCode={handleCompile}
                            isExecuting={isExecuting}
                            isLightMode={isLightMode}
                            settings={settings}
                            isReadOnly={isReadOnly}
                            userName={userName}
                          />
                          </div>
                        </div>
                      </ReflexElement>

                      <ReflexSplitter />

                      <ReflexElement className="terminal-pane" flex={0.35} minSize={100}>
                        <div style={{ height: "100%", width: "100%", overflow: "hidden" }}>
                          <OutputWindow
                            output={output}
                            isError={isError}
                            time={execTime}
                            isMobile={isMobile}
                            stdin={stdin}
                            setStdin={setStdin}
                            isLightMode={isLightMode}
                          />
                        </div>
                      </ReflexElement>
                    </ReflexContainer>
                  </ReflexElement>
                </ReflexContainer>
              </div>
            )}
          </>
        ) : (
          showLoading ? <LoadingScreen /> : (
            <div style={{ height: "100%", width: "100%" }} />
          )
        )}
      </div>

      {!isMobile && (
        <footer className="ws-status">
          <div>
            <span><span className={`u-dot${socketConnected ? "" : " u-dot--warn"}`} /> {socketConnected ? "connected" : "connecting…"}</span>
            <span>room/{roomId}</span>
            {isReadOnly && <span>spectator</span>}
          </div>
          <div>
            <span>{(LANGUAGES.find((l) => l.value === language)?.name || language).toLowerCase()}</span>
            <span>{clients.length} online</span>
            <button className={!isChatCollapsed ? "on" : ""} onClick={() => setIsChatCollapsed(!isChatCollapsed)}>
              <MessageSquare size={12} /> chat{isChatCollapsed && unreadChatCount > 0 ? ` (${unreadChatCount})` : ""}
            </button>
            <button onClick={() => handleShare("editor")}><Share2 size={12} /> invite</button>
          </div>
        </footer>
      )}

      {isMeetingActive && (
        <div style={isMobile ? { position: "fixed", inset: 0, zIndex: 9998, backgroundColor: "#000" } : undefined}>
          <VideoChat
            socketRef={socketRef}
            projectId={roomId}
            user={user || { name: userName || "Guest" }}
            isMinimized={isMobile ? false : isMeetingMinimized}
            onMinimizeToggle={(val) => setIsMeetingMinimized(val)}
            externalInCall={isMeetingStarting}
            onCallStateChange={(active) => {
              setIsMeetingStarting(active);
              if (!active) setIsMeetingActive(false);
            }}
            clients={clients}
            mediaStates={mediaStates}
            initialAudioState={true}
            initialVideoState={true}
            isMobile={isMobile}
          />
        </div>
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />

      <WhiteboardModal
        isOpen={showWhiteboard}
        onClose={() => setShowWhiteboard(false)}
        socketRef={socketRef}
        roomId={roomId}
        user={user}
      />
      {showGistModal && (
        <GistModal
          isOpen={showGistModal}
          onClose={() => setShowGistModal(false)}
          code={codeRef.current}
          language={language}
          fileName={roomFileName(language)}
        />
      )}

      {showSnippetModal && (
        <SnippetModal
          isOpen={showSnippetModal}
          onClose={() => setShowSnippetModal(false)}
          onImport={handleSnippetImport}
          userId={user?.uid}
          code={currentCode}
          language={language}
        />
      )}

      {showGuestModal && (
        <div className="u-modal-back">
          <form className="u-modal" style={{ maxWidth: 420 }} onSubmit={(e) => {
            e.preventDefault();
            if (guestInput.trim()) {
              localStorage.setItem("guest-name", guestInput.trim());
              setUserName(guestInput.trim());
              setShowGuestModal(false);
            }
          }}>
            <div className="u-modal-head">
              <div>
                <span className="u-label">room/{roomId}</span>
                <h3>Join the room</h3>
                <p>Pick a name so everyone knows who is typing.</p>
              </div>
            </div>
            <div className="u-modal-body">
              <div className="u-field">
                <label htmlFor="room-guest">Display name</label>
                <input id="room-guest" className="u-input" autoFocus placeholder="e.g. Ada Lovelace" value={guestInput} onChange={(e) => setGuestInput(e.target.value)} />
              </div>
              <button type="submit" className="u-btn u-btn--solid u-btn--lg u-btn--block" disabled={!guestInput.trim()}>Join room</button>
            </div>
          </form>
        </div>
      )}

      <AICopilotModal
        isOpen={showAICopilot}
        onClose={() => setShowAICopilot(false)}
        code={currentCode}
        language={language}
        roomId={roomId}
        userId={user?.uid}
        onApplyCode={(newCode) => {
          codeRef.current = newCode;
          setCurrentCode(newCode);
          socketRef.current?.emit(ACTIONS.CODE_CHANGE, { roomId, code: newCode });
        }}
      />

      <DiffViewerModal
        isOpen={showDiffViewer}
        onClose={() => setShowDiffViewer(false)}
        roomId={roomId}
        currentCode={currentCode}
        onRestoreSnapshot={(snap) => {
          if (snap.code) {
            codeRef.current = snap.code;
            setCurrentCode(snap.code);
            socketRef.current?.emit(ACTIONS.CODE_CHANGE, { roomId, code: snap.code });
          }
        }}
      />

      <AnalyticsDashboardModal
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        roomId={roomId}
      />

      <FocusModeModal
        isOpen={showFocusModal}
        onClose={() => setShowFocusModal(false)}
        code={currentCode}
        onCodeChange={(val) => {
          codeRef.current = val;
          setCurrentCode(val);
          socketRef.current?.emit(ACTIONS.CODE_CHANGE, { roomId, code: val });
        }}
        language={language}
        fileName={roomFileName(language)}
        isLightMode={isLightMode}
      />
    </div>
  );
}

export default Editor;
