import React, { useState, useRef, useEffect } from "react";
import {
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
import toast from "react-hot-toast";
import "react-reflex/styles.css";

import ACTIONS from "../Action";
import { initSocket } from "../socket";
import EditorComp, { roomFileName } from "../components/editorComp";
import ChatWindow from "../components/chatWindow";
import OutputWindow from "../components/outputWindow";
import SettingsModal from "../components/SettingsModal";
import GitHubModal from "../components/GitHubModal";
import Client from "../components/clients";
import { LANGUAGES, THEMES } from "../config";
import { useAuth } from "../context/AuthContext";
import { runCode, formatRun } from "../utils/runner";
import { buildSqlPrelude } from "../utils/sqlData";
import { track } from "../utils/track";
import { isTemplate } from "../utils/languages";
import { CLIENT_ID } from "../utils/clientId";
import { resolveTheme, setThemePref } from "../utils/theme";
import "../styles/app.css";
import LoadingScreen from "../components/LoadingScreen";
import SnippetModal from "../components/SnippetModal";
import WhiteboardModal from "../components/WhiteboardModal";
import AICopilotModal from "../components/AICopilotModal";
import DiffViewerModal from "../components/DiffViewerModal";
import AnalyticsDashboardModal from "../components/AnalyticsDashboardModal";
import FocusModeModal from "../components/FocusModeModal";
import RoomLayout, { useRoomLayout, LayoutMenu, CardHandle, useDockSlot } from "../components/RoomLayout";
import ProblemPane from "../components/ProblemPane";
import { rememberRoom } from "../utils/recentRooms";
import Icon from "../components/icons/Icon";
import VideoChat from "../components/VideoChat";
import useCallStartedAlert from "../components/useCallStartedAlert";
import useRoomMeeting from "../components/useRoomMeeting";
import { EndMeetingModal } from "../components/MeetingOrganiser";
import { useCallCarry } from "../context/CallCarry";
import { getCallPrefs } from "../utils/callPrefs";
import WorkspaceHeader from "../components/WorkspaceHeader";
import CommandPalette from "../components/CommandPalette";
import ShareModal from "../components/ShareModal";
import { AccessScreen, KnockList } from "../components/RoomAccess";
import { ScheduleModal } from "../components/Meetings";
import { auth } from "../firebase";
import { getBackendUrl, publicOrigin } from "../utils/api";

function Editor() {
  const socketRef = useRef(null);
  const location = useLocation();
  const reactNavigator = useNavigate();

  // Desktop app with no internet: rooms need the server, so open the offline editor right
  // away (before asking for a name or waiting on a server that can't answer).
  useEffect(() => {
    if (window.colabsDesktop && navigator.onLine === false) {
      toast("You're offline, so rooms are unavailable. Keep coding in the offline editor.", { icon: "📴", duration: 6000, id: "offline-room" });
      reactNavigator("/offline", { replace: true });
    }
  }, [reactNavigator]);
  const { roomId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
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
  const [statusEl, setStatusEl] = useState(null); // status-bar slot for the editor's cursor info
  const [roomName, setRoomName] = useState(null); // display name; roomId is the link and never changes
  const [isExecuting, setIsExecuting] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  // Desktop workspace layout (cards). Chat is one of its panels.
  const roomLayout = useRoomLayout();
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const isChatCollapsed = !roomLayout.has("chat");
  const setIsChatCollapsed = (collapsed) => { if (collapsed === roomLayout.has("chat")) roomLayout.toggle("chat"); };
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
  const [sqlTables, setSqlTables] = useState([]); // imported CSV/JSON tables for SQL rooms

  // Role comes from in-app navigation or a shared link (?role=viewer).
  const [role] = useState(location.state?.role || new URLSearchParams(location.search).get("role") || "editor");
  const isReadOnly = role === "viewer";

  // Editor Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
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
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShare, setShowShare] = useState(false);
  // Room access: { status: in|waiting|denied|granted, reason }, the room's settings, and (for
  // the owner) people asking to join.
  const [accessState, setAccessState] = useState(null);
  const [roomMeta, setRoomMeta] = useState(null);
  const [knocks, setKnocks] = useState([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const runShortcutRef = useRef(null);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [isMeetingMinimized, setIsMeetingMinimized] = useState(false);
  const [isMeetingStarting, setIsMeetingStarting] = useState(false);
  // Call card in the layout: the card holds an empty slot and the (single) call window sits
  // exactly over it, so moving between docked and floating never restarts the call.
  const [setCallSlot, callRect] = useDockSlot();
  const [mediaStates, setMediaStates] = useState({});

  // "Keep calls on other pages": hand a running call to the app as this page closes, and
  // take it back if it is still going when this room opens again.
  const { carry: carryCall, claim: claimCall } = useCallCarry();
  const leavingRef = useRef(false);
  const carryRef = useRef(null);
  carryRef.current = isMeetingActive ? { id: roomId, title: `room/${roomId}`, path: `/editor/${roomId}`, user: user || { name: userName || "Guest" } } : null;
  useEffect(() => {
    if (claimCall(roomId)) { setIsMeetingMinimized(false); setIsMeetingActive(true); }
    return () => {
      if (carryRef.current && !leavingRef.current && getCallPrefs().keepOnNavigate) carryCall(carryRef.current);
    };
  }, [roomId, carryCall, claimCall]);

  // Someone else opened a call here: offer to join it.
  useCallStartedAlert(socketRef, { inCall: isMeetingActive, onJoin: () => { setIsMeetingMinimized(false); setIsMeetingActive(true); } });
  // A scheduled meeting you organise here: snapshot, notes, end it. When an organiser ends it,
  // everyone else is shown out to the meeting page.
  const [endMeetingOpen, setEndMeetingOpen] = useState(false);
  const roomMeetingState = useRoomMeeting({
    roomId, user, socketRef,
    onShownOut: (meetingId) => {
      leavingRef.current = true;
      setIsMeetingActive(false);
      reactNavigator(meetingId ? `/meet/${meetingId}` : "/", { replace: true });
    },
  });
  const orgMeeting = roomMeetingState.meeting;
  // Arrived from a meeting page (camera and mic already checked there): open the call now.
  useEffect(() => {
    if (location.state?.startCall) { setIsMeetingMinimized(false); setIsMeetingActive(true); }
  }, [location.state]);

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation(); // CodeMirror's Mod-Enter would insert a blank line
        runShortcutRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
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

  // Switch language. Nothing is inserted automatically: an untouched starter from the old
  // language is cleared (real work is never touched) and the editor's notch offers the new one.
  const changeLanguage = (newLang) => {
    setLanguage(newLang);
    socketRef.current?.emit(ACTIONS.SYNC_LANGUAGE, { roomId, language: newLang });
    const code = codeRef.current || "";
    if (!isReadOnly && code.trim() && isTemplate(code)) {
      codeRef.current = "";
      setCurrentCode("");
      socketRef.current?.emit(ACTIONS.CODE_CHANGE, { roomId, code: "" });
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

        // Free hosting can take up to a minute to wake; keep trying for ~90s.
        let retries = 0;
        const maxRetries = 110;
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

      // Desktop app with no internet: rooms need the server, so go straight to the offline
      // editor instead of waiting for a server that can't answer.
      const isDesktop = !!window.colabsDesktop;
      const isAlive = isDesktop && navigator.onLine === false ? false : await wakeServer();
      if (!isAlive) {
        if (isDesktop) {
          toast("Can't reach the server, so rooms are unavailable. You can keep coding in the offline editor.", { icon: "📴", duration: 6000 });
          reactNavigator("/offline");
          return;
        }
        toast.error("System unreachable. Please try again.");
        reactNavigator("/");
        return;
      }

      // Only the live run may own the socket; a stale run (effect re-ran while we were
      // waiting for the server) must not overwrite the ref with a socket it then closes.
      const fresh = await initSocket();
      if (!isMounted) {
        fresh.disconnect();
        return;
      }
      ownSocket = fresh;
      socketRef.current = fresh;
      setSocketConnected(true);
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      // Connection trouble (server restart, network blip): stay in the room and let
      // socket.io keep retrying; "connect" re-joins. Never navigate away on a retry error.
      function handleErrors(err) {
        console.log("socket error", err?.message || err);
        setSocketConnected(false);
        toast.loading("Connection lost. Reconnecting…", { id: "socket-reconnect" });
      }
      fresh.on("connect", () => toast.dismiss("socket-reconnect"));

      socketRef.current.userName = userName;
      // Join on every (re)connect: after a network drop or server restart the socket gets a
      // new id in no rooms, so without this the person vanishes for everyone else (and stops
      // seeing joins/leaves) until they refresh.
      // The sign-in token lets the server check who you are (private rooms, ownership).
      const join = async () => {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        fresh.emit(ACTIONS.JOIN, {
          roomId,
          userName: userName,
          userProfile: userRef.current,
          clientId: CLIENT_ID,
          idToken: idToken || undefined,
        });
      };
      fresh.on("room-access", (state) => {
        setAccessState(state);
        if (state?.status === "granted") join(); // the owner let us in: join for real
      });
      fresh.on("room-knock", (k) => setKnocks((prev) => [...prev.filter((x) => x.socketId !== k.socketId), k]));
      fresh.on("room-knock-gone", ({ socketId }) => setKnocks((prev) => prev.filter((x) => x.socketId !== socketId)));
      fresh.on("connect", () => { setSocketConnected(true); join(); });
      fresh.on("disconnect", () => setSocketConnected(false));
      if (fresh.connected) join();
      rememberRoom(roomId, languageRef.current);

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

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, userName, replaced }) => {
        // "replaced" = an older connection from the same page; not a real departure.
        if (!replaced) toast(`${userName} left the room`);
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

      socketRef.current.on("room-meta", (meta = {}) => {
        if ("name" in meta) setRoomName(meta.name || null);
        if ("visibility" in meta) setRoomMeta((prev) => ({ ...prev, ...meta }));
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
    let ownSocket = null;
    init();

    // Closing the tab: leave right away instead of waiting for the heartbeat to time out.
    const onPageHide = () => ownSocket?.disconnect();
    window.addEventListener("pagehide", onPageHide);

    return () => {
      isMounted = false;
      window.removeEventListener("pagehide", onPageHide);
      const socket = ownSocket;
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
    // Reconnect only when the identity changes, not on every profile refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userName, reactNavigator, user?.uid, authLoading]);

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
    leavingRef.current = true; // leaving the room ends its call too
    socketRef.current?.emit(ACTIONS.LEAVE, { roomId });
    reactNavigator("/");
  };

  const handleShare = async (shareRole = "editor") => {
    const shareUrl = `${publicOrigin()}/editor/${encodeURIComponent(roomId)}${shareRole === "viewer" ? "?role=viewer" : ""}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(shareRole === "viewer" ? "Spectator link copied!" : "Editor link copied!");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  // eslint-disable-next-line no-use-before-define
  runShortcutRef.current = () => handleCompile();

  const handleCompile = async () => {
    if (isReadOnly) {
      toast.error("Spectators cannot execute code.");
      return;
    }
    if (isExecuting) return;
    setIsExecuting(true);
    socketRef.current?.emit(ACTIONS.SYNC_EXECUTE, { roomId, isExecuting: true, by: userName });
    if (isMobile) setActiveTab("output");

    let text;
    let failed;
    let time;
    let meta = { by: userName, at: Date.now() };
    try {
      const source = language === "sql" ? buildSqlPrelude(sqlTables) + codeRef.current : codeRef.current;
      // Others can edit this room unless it's yours and you're alone: ask before running locally.
      const shared = clients.length > 1 || !roomMeta?.isOwner;
      const result = await runCode({ language, source, stdin, sharedScope: shared ? `room:${roomId}` : null });
      text = formatRun(result);
      failed = !result.ok;
      time = result.timeMs != null ? (result.timeMs / 1000).toFixed(3) : undefined;
      track("CODE_RUN", { userId: user?.uid, roomId, language, ok: !failed, engine: result.engine });
      meta = { ...meta, status: result.status, engine: result.engine, exitCode: result.exitCode ?? null };
    } catch (error) {
      text = `Could not run the code: ${error.message}`;
      failed = true;
      meta = { ...meta, status: "Runner unavailable" };
    }
    setOutput(text);
    setIsError(failed);
    setExecTime(time);
    setIsExecuting(false);
    socketRef.current?.emit(ACTIONS.SYNC_OUTPUT, { roomId, output: text, isError: failed, time, meta });
    socketRef.current?.emit(ACTIONS.SYNC_EXECUTE, { roomId, isExecuting: false });
  };

  // One card of the desktop layout. `handle` is the drag grip for cards that show it inline.
  const renderRoomPanel = (id, handle) => {
    if (id === "problem") return <ProblemPane socketRef={socketRef} roomId={roomId} userName={userName} isReadOnly={isReadOnly} />;
    if (id === "code") {
      return (
          <EditorComp
            dragHandle={handle}
                      statusTarget={statusEl}
                            socketRef={socketRef}
                            roomId={roomId}
                            onCodeChange={(code) => {
                              codeRef.current = code;
                              setCurrentCode(code);
                            }}
                            language={language}
                            onLanguageChange={changeLanguage}
                            theme={theme}
                            code={currentCode}
                            onRunCode={handleCompile}
                            isExecuting={isExecuting}
                            isLightMode={isLightMode}
                            settings={settings}
                            isReadOnly={isReadOnly}
                            userName={userName}
                          />
      );
    }
    if (id === "io") {
      return (
          <OutputWindow
                            output={output}
                            isError={isError}
                            time={execTime}
                            isMobile={isMobile}
                            stdin={stdin}
                            setStdin={setStdin}
                            isLightMode={isLightMode}
                            language={language}
                            tables={sqlTables}
                            setTables={setSqlTables}
                          />
      );
    }
    if (id === "call") {
      if (isMeetingActive) return <div ref={setCallSlot} className="rl-call-slot" />;
      return (
        <div className="rl-call-empty">
          <span className="rl-call-icon"><Icon name="call" size={20} /></span>
          <strong>No call running</strong>
          <span>Start a call and it plays here, next to your code.</span>
          <button onClick={() => setIsMeetingActive(true)}><Icon name="call" size={14} /> Start call</button>
        </div>
      );
    }
    if (id === "chat") {
      return (
        <ChatWindow
          socketRef={socketRef}
          roomId={roomId}
          userName={userName}
          isLightMode={isLightMode}
          messages={messages}
          setMessages={setMessages}
        />
      );
    }
    return null;
  };

  return (
    <div className="ws">

      <WorkspaceHeader
        isMobile={isMobile}
        isLightMode={isLightMode}
        onLogo={() => reactNavigator("/")}
        mode="Room"
        title={roomName || roomId.substring(0, 8)}
        onTitleClick={copyRoomId}
        clients={clients}
        currentUserName={userName}
        onRun={handleCompile}
        isExecuting={isExecuting}
        onToggleTheme={toggleTheme}
        actions={[
          { id: "call", label: isMeetingActive ? "Leave call" : "Start voice & video call", icon: <Icon name="call" size={20} filled={isMeetingActive} />, onClick: () => setIsMeetingActive((v) => !v), active: isMeetingActive, tone: "green" },
          ...(orgMeeting ? [
            { id: "snapshot", label: `Snapshot the code (${orgMeeting.title})`, icon: <Icon name="snapshot" size={20} />, onClick: () => roomMeetingState.snapshot({ code: codeRef.current, language, takenBy: user?.name || userName }) },
            { id: "meet-notes", label: "Meeting notes & snapshots", icon: <Icon name="meeting-notes" size={20} />, onClick: () => window.open(`/meet/${orgMeeting.id}`, "_blank", "noopener"), section: "more" },
            { id: "meet-end", label: "End meeting for everyone", icon: <Icon name="meeting-end" size={20} />, onClick: () => setEndMeetingOpen(true), section: "more", tone: "red" },
          ] : []),
          ...(user?.uid ? [{ id: "schedule", label: "Schedule a call in this room", icon: <Icon name="calendar-add" size={20} />, onClick: () => setScheduleOpen(true), section: "more" }] : []),
          { id: "board", label: "Whiteboard", icon: <Icon name="whiteboard" size={20} />, onClick: () => setShowWhiteboard(true) },
          { id: "ai", label: "AI Copilot", icon: <Icon name="ai" size={20} />, onClick: () => setShowAICopilot(true) },
          { id: "share", label: "Invite people", icon: <Icon name="invite" size={20} />, onClick: () => setShowShare(true) },
          { id: "history", label: "Version history", icon: <Icon name="history" size={20} />, onClick: () => setShowDiffViewer(true), section: "more" },
          { id: "analytics", label: "Analytics", icon: <Icon name="analytics" size={20} />, onClick: () => setShowAnalytics(true), section: "more" },
          ...(user ? [
            { id: "focus", label: "Focus mode", icon: <Icon name="focus" size={20} />, onClick: () => setShowFocusModal(true), section: "more" },
            { id: "snippet", label: "Import snippet", icon: <Icon name="snippet" size={20} />, onClick: () => setShowSnippetModal(true), section: "more" },
          ] : []),
          { id: "github", label: "GitHub", icon: <Icon name="github" size={20} />, onClick: () => setShowGitHub(true), section: "more" },
          { id: "download", label: "Download code", icon: <Icon name="download" size={20} />, onClick: downloadCode, section: "more" },
          { id: "copy", label: "Copy room ID", icon: <Icon name="copy" size={20} />, onClick: copyRoomId, section: "more" },
          { id: "viewer", label: "Copy spectator link", icon: <Icon name="spectator" size={20} />, onClick: () => handleShare("viewer"), section: "more" },
          { id: "palette", label: "Command palette", icon: <Icon name="palette" size={20} />, onClick: () => setShowCommandPalette(true), section: "more", desktopOnly: true },
          { id: "settings", label: "Editor settings", icon: <Icon name="settings" size={20} />, onClick: () => setShowSettings(true), section: "more" },
          ...(user ? [{ id: "dash", label: "Back to dashboard", icon: <Icon name="dashboard" size={20} />, onClick: () => reactNavigator("/dashboard"), section: "more" }] : []),
          { id: "leave", label: "Leave room", icon: <Icon name="leave-room" size={20} />, onClick: leaveRoom, section: "more", tone: "red" },
        ]}
      />

      <div className="ws-body" style={{ flexDirection: "column" }}>
        {socketConnected ? (
          <>
            {isMobile ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {activeTab === "problem" && (
                    <ProblemPane socketRef={socketRef} roomId={roomId} userName={userName} isReadOnly={isReadOnly} />
                  )}
                  {activeTab === "code" && (
                    <EditorComp
                      statusTarget={statusEl}
                      socketRef={socketRef}
                      roomId={roomId}
                      onCodeChange={(code) => {
                        codeRef.current = code;
                        setCurrentCode(code);
                      }}
                      language={language}
                      onLanguageChange={changeLanguage}
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
                    <OutputWindow output={output} isError={isError} time={execTime} isMobile={isMobile} stdin={stdin} setStdin={setStdin} isLightMode={isLightMode} language={language} tables={sqlTables} setTables={setSqlTables} />
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
                          <Client key={client.socketId} userName={client.userName} photoURL={client.photoURL} isCurrentUser={client.socketId === socketRef.current?.id} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* MOBILE BOTTOM NAV */}
                <nav className="ws-tabbar" aria-label="Room">
                  {[
                    { id: "problem", icon: "problem", label: "Problem" },
                    { id: "code", icon: "code", label: "Code" },
                    { id: "output", icon: "terminal", label: "I/O" },
                    { id: "chat", icon: "chat", label: "Chat" },
                    { id: "people", icon: "people", label: "People" }
                  ].map((tab) => (
                    <button key={tab.id} className={activeTab === tab.id ? "on" : ""} onClick={() => setActiveTab(tab.id)}>
                      <Icon name={tab.icon} size={20} filled={activeTab === tab.id} /><span>{tab.label}</span>
                      {tab.id === "chat" && unreadChatCount > 0 && <span className="u-count">{unreadChatCount}</span>}
                    </button>
                  ))}
                  <button onClick={() => setShowSettings(true)}>
                    <Icon name="settings" size={20} /><span>Settings</span>
                  </button>
                </nav>
              </div>
            ) : (
              <div style={{ height: "100%", width: "100%", position: "relative" }}>
                <RoomLayout state={roomLayout} renderPanel={renderRoomPanel} inlineHandles={isMeetingActive ? ["call"] : []} />
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
            <span className="ws-status-ed" ref={setStatusEl} />
            <span>{(LANGUAGES.find((l) => l.value === language)?.name || language).toLowerCase()}</span>
            <span>{clients.length} online</span>
            <span className="rl-anchor">
              <button className={showLayoutMenu ? "on" : ""} onClick={() => setShowLayoutMenu((v) => !v)} aria-expanded={showLayoutMenu}>
                <Icon name="layout" size={12} filled={showLayoutMenu} /> layout
              </button>
              {showLayoutMenu && <LayoutMenu state={roomLayout} onClose={() => setShowLayoutMenu(false)} />}
            </span>
            <button className={roomLayout.has("problem") ? "on" : ""} onClick={() => roomLayout.toggle("problem")}>
              <Icon name="problem" size={12} filled={roomLayout.has("problem")} /> problem
            </button>
            <button className={!isChatCollapsed ? "on" : ""} onClick={() => setIsChatCollapsed(!isChatCollapsed)}>
              <Icon name="chat" size={12} filled={!isChatCollapsed} /> chat{isChatCollapsed && unreadChatCount > 0 ? ` (${unreadChatCount})` : ""}
            </button>
            <button onClick={() => setShowShare(true)}><Icon name="invite" size={12} /> invite</button>
          </div>
        </footer>
      )}

      {isMeetingActive && (
        <div style={isMobile && !isMeetingMinimized ? { position: "fixed", inset: 0, zIndex: 9998, backgroundColor: "#000" } : undefined}>
          <VideoChat
            socketRef={socketRef}
            projectId={roomId}
            user={user || { name: userName || "Guest" }}
            isMinimized={isMeetingMinimized}
            dock={!isMobile && roomLayout.has("call") ? callRect : null}
            onDockToggle={() => roomLayout.toggle("call")}
            dockHandle={<CardHandle id="call" state={roomLayout} />}
            onMinimizeToggle={(val) => setIsMeetingMinimized(val)}
            externalInCall={isMeetingStarting}
            onCallStateChange={(active) => {
              setIsMeetingStarting(active);
              if (!active) setIsMeetingActive(false);
            }}
            clients={clients}
            mediaStates={mediaStates}
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
      {showGitHub && (
        <GitHubModal
          isOpen={showGitHub}
          onClose={() => setShowGitHub(false)}
          source="room"
          projectName={`room-${roomId}`}
          currentFile={{ path: roomFileName(language), content: codeRef.current }}
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

      <ShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        roomId={roomId}
        peopleOnline={clients.length}
        access={roomMeta}
        onAccessChange={(visibility, allowed) => socketRef.current?.emit("room-access-update", { roomId, visibility, allowed })}
      />

      <ScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} roomId={roomId} hostName={user?.name || userName} />
      {orgMeeting && (
        <EndMeetingModal open={endMeetingOpen} meeting={orgMeeting} onClose={() => setEndMeetingOpen(false)}
          code={codeRef.current} language={language} takenBy={user?.name || userName}
          onEnded={() => roomMeetingState.setMeeting(null)} />
      )}

      <KnockList
        knocks={knocks}
        onAnswer={(k, allow, always) => {
          socketRef.current?.emit("room-knock-answer", { roomId, socketId: k.socketId, allow, always });
          setKnocks((prev) => prev.filter((x) => x.socketId !== k.socketId));
        }}
      />
      <AccessScreen
        access={accessState}
        signedInAs={user?.email}
        onSignIn={() => reactNavigator("/login", { state: { from: `/editor/${roomId}` } })}
        onHome={() => reactNavigator("/")}
      />

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        isLightMode={isLightMode}
        actions={[
          { id: "run", label: "Run code", category: "Actions", shortcut: "Ctrl Enter", icon: <Icon name="run" size={16} />, run: handleCompile },
          { id: "share", label: "Invite people", category: "Collaboration", icon: <Icon name="invite" size={16} />, run: () => setShowShare(true) },
          { id: "viewer", label: "Copy spectator link", category: "Collaboration", icon: <Icon name="spectator" size={16} />, run: () => handleShare("viewer") },
          { id: "call", label: isMeetingActive ? "Leave call" : "Start voice & video call", category: "Collaboration", icon: <Icon name="call" size={16} />, run: () => setIsMeetingActive((v) => !v) },
          { id: "board", label: "Open whiteboard", category: "Collaboration", icon: <Icon name="whiteboard" size={16} />, run: () => setShowWhiteboard(true) },
          { id: "ai", label: "Ask AI copilot", category: "Actions", icon: <Icon name="ai" size={16} />, run: () => setShowAICopilot(true) },
          { id: "history", label: "Version history & snapshots", category: "Actions", icon: <Icon name="history" size={16} />, run: () => setShowDiffViewer(true) },
          { id: "focus", label: "Focus mode", category: "Actions", shortcut: "Alt F", icon: <Icon name="focus" size={16} />, run: () => setShowFocusModal(true) },
          { id: "download", label: "Download code", category: "Actions", icon: <Icon name="download" size={16} />, run: downloadCode },
          { id: "github", label: "GitHub: push, import or share as gist", category: "Actions", icon: <Icon name="github" size={16} />, run: () => setShowGitHub(true) },
          { id: "settings", label: "Editor settings", category: "Settings", icon: <Icon name="settings" size={16} />, run: () => setShowSettings(true) },
          { id: "theme", label: isLightMode ? "Switch to dark theme" : "Switch to light theme", category: "Settings", icon: <Icon name={isLightMode ? "theme-dark" : "theme-light"} size={16} />, run: toggleTheme },
          { id: "leave", label: "Leave room", category: "Actions", icon: <Icon name="leave-room" size={16} />, run: leaveRoom },
        ]}
      />

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
        createdBy={userName}
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
