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
  Code
} from "lucide-react";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import "react-reflex/styles.css";

import ACTIONS from "../Action";
import { initSocket } from "../socket";
import EditorComp from "../components/editorComp";
import ChatWindow from "../components/chatWindow";
import OutputWindow from "../components/outputWindow";
import Client from "../components/clients";
import { LANGUAGES, THEMES } from "../config";

function Editor() {
  const socketRef = useRef(null);
  const location = useLocation();
  const reactNavigator = useNavigate();
  const { roomId } = useParams();

  const codeRef = useRef(localStorage.getItem(`code-${roomId}`) || "");

  const [clients, setClients] = useState([]);
  const [language, setLanguage] = useState(LANGUAGES[0].value);
  const [theme] = useState(THEMES[0]);
  const [currentCode, setCurrentCode] = useState(codeRef.current);

  const [output, setOutput] = useState("");
  const [isError, setIsError] = useState(false);
  const [execTime, setExecTime] = useState(undefined);
  const [isExecuting, setIsExecuting] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem("app-theme") === "light";
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState("code"); // "code" | "output" | "chat"

  // Chat Persistent State
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(`chat-${roomId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [unreadChatCount, setUnreadChatCount] = useState(0);

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

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add("light-theme");
      localStorage.setItem("app-theme", "light");
    } else {
      document.documentElement.classList.remove("light-theme");
      localStorage.setItem("app-theme", "dark");
    }
  }, [isLightMode]);

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
  }, [roomId, location.state?.userName, reactNavigator]);

  // Reset unread count when chat is viewed
  useEffect(() => {
    if ((activeTab === "chat" && isMobile) || (!isChatCollapsed && !isMobile)) {
      setUnreadChatCount(0);
    }
  }, [activeTab, isChatCollapsed, isMobile]);

  if (!location.state) {
    return <Navigate to="/" />;
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
    reactNavigator("/");
  };

  const handleCompile = async () => {
    setIsExecuting(true);
    socketRef.current?.emit(ACTIONS.SYNC_EXECUTE, { roomId, isExecuting: true });

    const langObj = LANGUAGES.find((l) => l.value === language);
    const languageId = langObj ? langObj.id : 63;

    const formData = {
      language_id: languageId,
      source_code: btoa(codeRef.current),
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
          <img src="/utkristi-colabs.png" alt="Logo" style={{ height: isMobile ? "24px" : "32px", objectFit: "contain" }} />
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
              onClick={() => setIsLightMode(!isLightMode)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", color: isLightMode ? "#fbbf24" : "var(--text-muted)", backgroundColor: "transparent", borderRadius: "6px", border: "none", cursor: "pointer", transition: "all 0.2s" }}
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
                  onClick={downloadCode}
                  style={{ width: "32px", height: "32px", color: "var(--text-muted)", background: "transparent", border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  title="Download"
                >
                  <Download size={18} />
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
                    />
                  )}
                  {activeTab === "output" && (
                    <OutputWindow output={output} isError={isError} time={execTime} isMobile={isMobile} />
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
                    { id: "output", icon: <Terminal size={20} />, label: "Output" },
                    { id: "chat", icon: <MessageSquare size={20} />, label: "Chat" }
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "16px" }}>
            Connecting to Room...
          </div>
        )}
      </div>

    </div>
  );
}

export default Editor;
