import React, { useState, useRef, useEffect } from "react";
import {
  useNavigate,
  useLocation,
  Navigate,
  useParams,
} from "react-router-dom";
import toast from "react-hot-toast";
import {
  Sun,
  Moon,
  Download,
  Copy,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  MessageSquare,
  Terminal,
  Code,
  Share2,
  Settings,
  Users,
  LayoutDashboard
} from "lucide-react";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import "react-reflex/styles.css";

import ACTIONS from "../Action";
import { initSocket } from "../socket";
import EditorComp from "../components/editorComp";
import ChatWindow from "../components/chatWindow";
import OutputWindow from "../components/outputWindow";
import SettingsModal from "../components/SettingsModal";
import GistModal from "../components/GistModal";
import { Github } from "lucide-react";
import Client from "../components/clients";
import { LANGUAGES, THEMES } from "../config";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "../components/LoadingScreen";
import SnippetModal from "../components/SnippetModal";
import { ImportIcon } from "lucide-react";

function Editor() {
  const socketRef = useRef(null);
  const location = useLocation();
  const reactNavigator = useNavigate();
  const { roomId } = useParams();
  const { user } = useAuth();

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
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem("app-theme") === "light";
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState("code"); // "code" | "output" | "chat"

  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(`chat-${roomId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const [stdin, setStdin] = useState("");

  const [role] = useState(location.state?.role || "editor");
  const isReadOnly = role === "viewer";

  // Editor Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [showGistModal, setShowGistModal] = useState(false);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("app-editor-settings");
    return saved ? JSON.parse(saved) : { fontSize: 16, tabSize: 4, wordWrap: false };
  });

  const [showSnippetModal, setShowSnippetModal] = useState(false);

  useEffect(() => {
    localStorage.setItem("app-editor-settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(`chat-${roomId}`, JSON.stringify(messages));
  }, [messages, roomId]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleTheme = () => {
    const newMode = !isLightMode;
    setIsLightMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("light-theme");
      localStorage.setItem("app-theme", "light");
    } else {
      document.documentElement.classList.remove("light-theme");
      localStorage.setItem("app-theme", "dark");
    }
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

    let ext = "txt";
    if (language === "javascript") ext = "js";
    else if (language === "python") ext = "py";
    else if (language === "cpp") ext = "cpp";
    else if (language === "java") ext = "java";

    a.download = `script.${ext}`;
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
      setSocketConnected(true);
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      function handleErrors(err) {
        console.log("socket error", err);
        toast.error("Socket Connection failed. Try Again !!");
        reactNavigator("/");
      }

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        userName: location.state?.userName,
        userProfile: user,
      });

      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, userName, socketId }) => {
          if (userName !== location.state?.userName) {
            toast.success(`${userName} joined !`);
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

    init();

    return () => {
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
  }, [roomId, location.state?.userName, reactNavigator, user]);

  // Reset unread count when chat is viewed
  useEffect(() => {
    if ((activeTab === "chat" && isMobile) || (!isChatCollapsed && !isMobile)) {
      setUnreadChatCount(0);
    }
  }, [activeTab, isChatCollapsed, isMobile]);

  if (!location.state) {
    return <Navigate to={`/?room=${roomId}`} />;
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

    const formData = {
      language_id: languageId,
      source_code: btoa(codeRef.current),
      ...(stdin.trim() && { stdin: btoa(stdin) })
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
        setTimeout(() => pollExecutionResult(token), 2000);
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
    <div style={{ height: "100vh", width: "100vw", backgroundColor: "var(--bg-dark)", color: "var(--text-main)", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      {/* GLOBAL NAVBAR */}
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
          <img
            src={isMobile ? "/utkristi-labs.png" : "/utkristi-colabs.png"}
            alt="Utkristi Colabs"
            onClick={() => reactNavigator("/")}
            style={{ height: isMobile ? "24px" : "32px", cursor: "pointer", objectFit: "contain" }}
          />

          {user && !isMobile && (
            <button
              onClick={() => reactNavigator("/dashboard")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px",
                backgroundColor: "transparent",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-muted)",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <LayoutDashboard size={14} />
              Dashboard
            </button>
          )}

          {!isMobile && <div style={{ height: "20px", width: "1px", backgroundColor: "var(--border-color)" }} />}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-muted)" }}>Room</span>
              <span style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text-main)", backgroundColor: "var(--secondary)", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
                {roomId.substring(0, 8)}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "8px" : "12px" }}>
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center" }}>
              {clients.slice(0, 5).map((client, idx) => (
                <div key={client.socketId} style={{ marginLeft: idx === 0 ? 0 : "-8px", zIndex: 5 - idx }}>
                  <Client userName={client.userName} isCompact={true} isCurrentUser={client.userName === location.state?.userName} />
                </div>
              ))}
              {clients.length > 5 && (
                <div style={{ marginLeft: "-8px", width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", border: "2px solid var(--bg-card)" }}>
                  +{clients.length - 5}
                </div>
              )}
            </div>
          )}

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            backgroundColor: "var(--secondary)",
            padding: "4px",
            borderRadius: "10px",
            border: "1px solid var(--border-color)"
          }}>
            <button
              onClick={handleCompile}
              disabled={isExecuting}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", color: isExecuting ? "#4ade80" : "#22c55e", backgroundColor: "transparent", borderRadius: "6px", border: "none", cursor: isExecuting ? "default" : "pointer", transition: "all 0.2s" }}
              onMouseOver={(e) => !isExecuting && (e.currentTarget.style.backgroundColor = "rgba(34, 197, 94, 0.1)")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              title="Run Code"
            >
              {isExecuting ? <Pause size={18} fill="#4ade80" /> : <Play size={18} fill="#22c55e" />}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              style={{ display: isMobile ? "none" : "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", color: "var(--text-muted)", backgroundColor: "transparent", borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s" }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              title="Settings"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={toggleTheme}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", color: isLightMode ? "#fbbf24" : "var(--text-muted)", backgroundColor: "transparent", borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s" }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              title="Toggle Theme"
            >
              {isLightMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {!isMobile && <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-color)", margin: "0 2px" }} />}
            <button
              onClick={() => handleShare("editor")}
              style={{ width: "32px", height: "32px", color: "var(--primary)", background: "transparent", border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s" }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.1)")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              title="Share Editor Link"
            >
              <Share2 size={18} />
            </button>
            <button
              onClick={() => handleShare("viewer")}
              style={{ width: "32px", height: "32px", color: "#a855f7", background: "transparent", border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s" }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(168, 85, 247, 0.1)")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              title="Share Spectator Link"
            >
              <Users size={18} />
            </button>
            {!isMobile && (
              <>
                <button
                  onClick={() => setShowGistModal(true)}
                  style={{ width: "32px", height: "32px", color: "var(--text-main)", background: "transparent", border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  title="Export to GitHub Gist"
                >
                  <Github size={18} />
                </button>
                <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-color)", margin: "0 2px" }} />
                <button
                  onClick={downloadCode}
                  style={{ width: "32px", height: "32px", color: "var(--text-muted)", background: "transparent", border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  title="Download"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={() => setShowSnippetModal(true)}
                  style={{ width: "32px", height: "32px", color: "var(--text-muted)", background: "transparent", border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  title="Import Snippet"
                >
                  <ImportIcon size={18} />
                </button>
                <button
                  onClick={copyRoomId}
                  style={{ width: "32px", height: "32px", color: "var(--text-muted)", background: "transparent", border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  title="Copy ID"
                >
                  <Copy size={18} />
                </button>
                <button
                  onClick={leaveRoom}
                  style={{ width: "32px", height: "32px", color: "#f87171", background: "transparent", border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(248, 113, 113, 0.1)")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  title="Leave"
                >
                  <LogOut size={18} />
                </button>
              </>
            )}
            {isMobile && (
              <button
                onClick={leaveRoom}
                style={{ width: "32px", height: "32px", color: "#f87171", background: "transparent", border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s" }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(248, 113, 113, 0.1)")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                title="Leave"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
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
                      userName={location.state?.userName}
                    />
                  )}
                  {activeTab === "output" && (
                    <OutputWindow output={output} isError={isError} time={execTime} isMobile={isMobile} stdin={stdin} setStdin={setStdin} />
                  )}
                  {activeTab === "chat" && (
                    <ChatWindow
                      socketRef={socketRef}
                      roomId={roomId}
                      userName={location.state?.userName}
                      isLightMode={isLightMode}
                      isMobile={isMobile}
                      messages={messages}
                      setMessages={setMessages}
                    />
                  )}
                  {activeTab === "people" && (
                    <div style={{ height: "100%", width: "100%", backgroundColor: "var(--bg-dark)", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-main)" }}>Collaborators</h3>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", backgroundColor: "rgba(59, 130, 246, 0.1)", padding: "2px 8px", borderRadius: "100px" }}>{clients.length} online</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        {clients.map((client) => (
                          <div key={client.socketId} style={{
                            backgroundColor: "var(--bg-card)",
                            borderRadius: "12px",
                            border: "1px solid var(--border-color)",
                            transition: "all 0.2s"
                          }}>
                            <Client
                              userName={client.userName}
                              isCompact={false}
                              isCurrentUser={client.userName === location.state?.userName}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* MOBILE BOTTOM NAV */}
                <div style={{
                  height: "60px",
                  backgroundColor: "var(--bg-card)",
                  borderTop: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-around",
                  paddingBottom: "env(safe-area-inset-bottom)"
                }}>
                  {[
                    { id: "code", icon: <Code size={20} />, label: "Code" },
                    { id: "output", icon: <Terminal size={20} />, label: "I/O" },
                    { id: "chat", icon: <MessageSquare size={20} />, label: "Chat" },
                    { id: "people", icon: <Users size={20} />, label: "People" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                        background: "transparent",
                        border: "none",
                        color: activeTab === tab.id ? "var(--primary)" : "var(--text-muted)",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{ position: "relative" }}>
                        {tab.icon}
                        {tab.id === "chat" && unreadChatCount > 0 && (
                          <span style={{
                            position: "absolute",
                            top: "-6px",
                            right: "-8px",
                            backgroundColor: "#f87171",
                            color: "white",
                            fontSize: "10px",
                            padding: "1px 5px",
                            borderRadius: "100px",
                            border: "2px solid var(--bg-card)",
                            fontWeight: "bold"
                          }}>
                            {unreadChatCount}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "10px", fontWeight: "600" }}>{tab.label}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setShowSettings(true)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    <Settings size={20} />
                    <span style={{ fontSize: "10px", fontWeight: "600" }}>Settings</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ height: "100%", width: "100%", position: "relative" }}>
                {/* Toggle Notch for Chat Pane */}
                <button
                  onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 100,
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderLeft: "none",
                    padding: "16px 4px",
                    borderTopRightRadius: "8px",
                    borderBottomRightRadius: "8px",
                    cursor: "pointer",
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "2px 0 8px rgba(0,0,0,0.3)",
                  }}
                >
                  {isChatCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                  {isChatCollapsed && unreadChatCount > 0 && (
                    <span style={{
                      position: "absolute",
                      top: "-8px",
                      left: "-8px",
                      backgroundColor: "#f87171",
                      color: "white",
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "100px",
                      border: "2px solid var(--bg-dark)",
                      fontWeight: "bold",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                    }}>
                      {unreadChatCount}
                    </span>
                  )}
                </button>

                <ReflexContainer orientation="vertical">
                  {!isChatCollapsed && (
                    <ReflexElement key="chat-pane" className="left-pane" flex={0.25} minSize={250}>
                      <div style={{ height: "100%", width: "100%", overflow: "hidden" }}>
                        <ChatWindow
                          socketRef={socketRef}
                          roomId={roomId}
                          userName={location.state?.userName}
                          isLightMode={isLightMode}
                          messages={messages}
                          setMessages={setMessages}
                        />
                      </div>
                    </ReflexElement>
                  )}

                  {!isChatCollapsed && (
                    <ReflexSplitter key="chat-splitter" style={{ border: "none", width: "4px", backgroundColor: "var(--border-color)", cursor: "col-resize" }} />
                  )}

                  <ReflexElement key="main-pane" className="right-pane" flex={isChatCollapsed ? 1 : 0.75}>
                    <ReflexContainer orientation="horizontal">
                      <ReflexElement className="editor-pane" flex={0.65} minSize={200}>
                        <div style={{ height: "100%", width: "100%", overflow: "hidden" }}>
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
                            userName={location.state?.userName}
                          />
                        </div>
                      </ReflexElement>

                      <ReflexSplitter style={{ border: "none", height: "4px", backgroundColor: "var(--border-color)", cursor: "row-resize" }} />

                      <ReflexElement className="terminal-pane" flex={0.35} minSize={100}>
                        <div style={{ height: "100%", width: "100%", overflow: "hidden" }}>
                          <OutputWindow
                            output={output}
                            isError={isError}
                            time={execTime}
                            isMobile={isMobile}
                            stdin={stdin}
                            setStdin={setStdin}
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
          showLoading ? <LoadingScreen isLightMode={isLightMode} /> : (
            <div style={{ height: "100%", width: "100%", backgroundColor: "var(--bg-dark)" }} />
          )
        )}
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
      {showGistModal && (
        <GistModal
          isOpen={showGistModal}
          onClose={() => setShowGistModal(false)}
          code={codeRef.current}
          language={language}
          fileName={`${roomId}.${language === 'javascript' ? 'js' : language === 'python' ? 'py' : 'txt'}`}
        />
      )}

      {showSnippetModal && (
        <SnippetModal
          isOpen={showSnippetModal}
          onClose={() => setShowSnippetModal(false)}
          onImport={handleSnippetImport}
          userId={user?.uid}
        />
      )}
    </div>
  );
}

export default Editor;
