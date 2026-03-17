import React, { useEffect } from "react";
import { Download } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript, esLint } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { EditorView, Decoration, ViewPlugin, WidgetType } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { emacs } from "@replit/codemirror-emacs";
import { linter, lintGutter } from "@codemirror/lint";
import ACTIONS from "../Action";
import { LANGUAGES } from "../config";

// Remote cursor widget
class CursorWidget extends WidgetType {
  constructor(name, color) {
    super();
    this.name = name;
    this.color = color;
  }
  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "remote-cursor";
    wrap.style.borderLeft = `2px solid ${this.color}`;
    wrap.style.position = "relative";
    wrap.style.height = "1.2em";
    wrap.style.display = "inline-block";
    wrap.style.verticalAlign = "middle";
    wrap.style.marginLeft = "-1px";
    wrap.style.marginRight = "-1px";
    wrap.style.pointerEvents = "none";

    const label = document.createElement("div");
    label.className = "remote-cursor-label";
    label.textContent = this.name;
    label.style.position = "absolute";
    label.style.bottom = "100%";
    label.style.left = "0";
    label.style.whiteSpace = "nowrap";
    label.style.backgroundColor = this.color;
    label.style.color = "white";
    label.style.fontSize = "10px";
    label.style.padding = "1px 4px";
    label.style.borderRadius = "2px";
    label.style.pointerEvents = "none";
    label.style.zIndex = "10";
    label.style.marginBottom = "2px";

    wrap.appendChild(label);
    return wrap;
  }
}

const cursorPlugin = (remoteCursors) => ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.getDecorations(view);
  }
  update(update) {
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = this.getDecorations(update.view);
    }
  }
  getDecorations(view) {
    const widgets = [];
    for (const [, data] of Object.entries(remoteCursors)) {
      if (data.pos !== undefined && data.pos <= view.state.doc.length) {
        widgets.push(Decoration.widget({
          widget: new CursorWidget(data.userName, data.color),
          side: 1
        }).range(data.pos));
      }
    }
    return Decoration.set(widgets.sort((a, b) => a.from - b.from));
  }
}, {
  decorations: v => v.decorations
});

function EditorComp({
  socketRef,
  roomId,
  onCodeChange,
  userName, // Added userName prop
  language,
  onLanguageChange,
  theme,
  code,
  onRunCode,
  isExecuting,
  isLightMode,
  isMobile,
  onDownload,
  settings,
  isReadOnly,
  filename,
  lockLanguage,
  fileId // Added fileId prop
}) {
  const [editorCode, setEditorCode] = React.useState(code || "");
  const [remoteCursors, setRemoteCursors] = React.useState({});

  useEffect(() => {
    const socket = socketRef.current;
    if (socket) {
      // Note: FILE_CHANGE is now handled by the parent ProjectPage component
      // to maintain a single source of truth for the file list and content.

      socket.on(ACTIONS.CODE_CHANGE, ({ code: incomingCode, fileId: incomingFileId }) => {
        // Compatibility: !incomingFileId means it's a standard room
        // incomingFileId === fileId means it's the correct file in a multi-file project
        if (incomingCode !== null && (!incomingFileId || incomingFileId === fileId)) {
          setEditorCode(incomingCode);
          onCodeChange(incomingCode);
        }
      });

      socket.on(ACTIONS.CURSOR_MOVE, ({ cursor, userName: remoteUser, socketId, color, fileId: incomingFileId }) => {
        if (incomingFileId === fileId) {
          setRemoteCursors((prev) => ({
            ...prev,
            [socketId]: { pos: cursor, userName: remoteUser, color: color || "#3b82f6" }
          }));
        } else {
          // If they moved to another file, remove their cursor from this view
          setRemoteCursors((prev) => {
            const next = { ...prev };
            delete next[socketId];
            return next;
          });
        }
      });

      socket.on(ACTIONS.JOINED, ({ clients }) => {
        // Cleanup cursors for anyone NOT in the clients list
        setRemoteCursors((prev) => {
          const next = { ...prev };
          const socketIds = clients.map(c => c.socketId);
          Object.keys(next).forEach(sid => {
            if (!socketIds.includes(sid)) delete next[sid];
          });
          return next;
        });
      });

      socket.on(ACTIONS.DISCONNECTED, ({ socketId }) => {
        setRemoteCursors((prev) => {
          const next = { ...prev };
          delete next[socketId];
          return next;
        });
      });
      socket.on(ACTIONS.SYNC_SCROLL, ({ scrollPos, userName: remoteUser, fileId: incomingFileId }) => {
        if (incomingFileId === fileId && settings?.keybinding !== "vim" && settings?.keybinding !== "emacs") {
          // Find the editor view and scroll it
          const editor = document.querySelector('.cm-content');
          if (editor) {
            const wrap = editor.closest('.cm-scroller');
            if (wrap) wrap.scrollTop = scrollPos;
          }
        }
      });
    }
    return () => {
      socket?.off(ACTIONS.CODE_CHANGE);
      socket?.off(ACTIONS.CURSOR_MOVE);
      socket?.off(ACTIONS.JOINED);
      socket?.off(ACTIONS.DISCONNECTED);
      socket?.off(ACTIONS.SYNC_SCROLL);
    };
  }, [socketRef, onCodeChange, settings?.keybinding, fileId]);

  useEffect(() => {
    if (code !== undefined && code !== editorCode) {
      setEditorCode(code);
    }
  }, [code, editorCode]);

  const handleEditorChange = (value, viewUpdate) => {
    setEditorCode(value);
    onCodeChange(value);
    localStorage.setItem(`code-${roomId}`, value);

    // Sync code change
    // For standard Rooms (editor.js), we use CODE_CHANGE for real-time sync.
    // For Pro Projects (ProjectPage.js), we skip CODE_CHANGE to avoid echo loops
    // because ProjectPage handles sync via FILE_CHANGE on onCodeChange.
    if (!fileId && (viewUpdate.transactions[0]?.isUserEvent("input") || viewUpdate.transactions[0]?.isUserEvent("delete"))) {
      socketRef.current?.emit(ACTIONS.CODE_CHANGE, {
        roomId,
        code: value,
      });
    }

    // Sync cursor movement
    const cursor = viewUpdate.state.selection.main.head;
    socketRef.current?.emit(ACTIONS.CURSOR_MOVE, {
      roomId,
      fileId,
      cursor,
      userName,
      color: "#3b82f6", // Default color, could be dynamic per user
    });

    // Sync scroll if presenter
    if (viewUpdate.transactions[0]?.isUserEvent("scroll") || viewUpdate.docChanged) {
      const scroller = viewUpdate.view.scrollDOM;
      if (scroller) {
        socketRef.current?.emit(ACTIONS.SYNC_SCROLL, {
          roomId,
          fileId,
          scrollPos: scroller.scrollTop,
          userName
        });
      }
    }
  };

  const getLanguageExtension = (lang) => {
    switch (lang) {
      case "javascript": return javascript({ jsx: true });
      case "python": return python();
      case "cpp": return cpp();
      case "java": return cpp();
      case "html":
      case "htmlmixed": return html();
      case "css": return html(); // cm-lang-html often handles css well enough or has its own, but sticking to basics
      default: return javascript();
    }
  };


  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "var(--bg-dark)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-main)", opacity: 0.9 }}>
            {filename || `main.${language === "javascript" ? "js" : language === "python" ? "py" : language === "cpp" ? "cpp" : "java"}`}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isMobile && (
            <button
              onClick={onDownload}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "24px",
                height: "24px",
                color: "var(--text-muted)",
                backgroundColor: "var(--secondary)",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
              onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--border-color)"}
              title="Download Code"
            >
              <Download size={12} />
            </button>
          )}

          {!lockLanguage && (
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              style={{
                backgroundColor: "var(--secondary)",
                border: "1px solid var(--border-color)",
                color: "var(--text-muted)",
                fontSize: "12px",
                fontWeight: "500",
                outline: "none",
                cursor: "pointer",
                padding: "4px 10px",
                borderRadius: "6px",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => e.target.style.borderColor = "var(--primary)"}
              onMouseOut={(e) => e.target.style.borderColor = "var(--border-color)"}
            >
              {LANGUAGES.map(l => (
                <option key={l.value} value={l.value} style={{ backgroundColor: "var(--bg-card)", color: "var(--text-main)" }}>{l.name}</option>
              ))}
            </select>
          )}
        </div>

      </div>

      <div style={{ flex: 1, overflow: "auto", fontSize: settings?.fontSize ? `${settings.fontSize}px` : "16px" }}>
        <CodeMirror
          value={editorCode}
          height="100%"
          theme={isLightMode ? "light" : dracula}
          readOnly={isReadOnly}
          editable={!isReadOnly}
          onChange={handleEditorChange}
          basicSetup={{
            lineNumbers: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            tabSize: settings?.tabSize || 4,
          }}
          style={{ height: "100%" }}
          extensions={[
            getLanguageExtension(language),
            ...(settings?.wordWrap ? [EditorView.lineWrapping] : []),
            ...(settings?.keybinding === "vim" ? [vim()] : []),
            ...(settings?.keybinding === "emacs" ? [emacs()] : []),
            ...(settings?.enableLinting && language === "javascript" ? [lintGutter(), linter(esLint(new (require("eslint-linter-browserify").Linter)()))] : []),
            cursorPlugin(remoteCursors),
          ]}
        />
      </div>
    </div>
  );
}

export default EditorComp;
