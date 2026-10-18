import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Copy, Check, Sparkles, X } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { esLint } from "@codemirror/lang-javascript";
import { EditorView, Decoration, ViewPlugin, WidgetType } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { emacs } from "@replit/codemirror-emacs";
import { linter, lintGutter } from "@codemirror/lint";
import { editorLanguage, fileNameFor, templateFor, LANG_BY_ID } from "../utils/languages";
import { colabsDark, colabsLight, editorChrome } from "../utils/editorTheme";
import LangPicker from "./LangPicker";
import ACTIONS from "../Action";

export const roomFileName = (language) => fileNameFor(language);

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
  statusTarget, // element in the page's status bar that shows cursor info
  dragHandle, // layout grip, shown at the start of the file bar
  fileId // Added fileId prop
}) {
  const [editorCode, setEditorCode] = React.useState(code || "");
  const [remoteCursors, setRemoteCursors] = React.useState({});

  // Latest callback without re-subscribing on every render (the parent passes an inline fn).
  const onCodeChangeRef = React.useRef(onCodeChange);
  onCodeChangeRef.current = onCodeChange;
  const keybindingRef = React.useRef(settings?.keybinding);
  keybindingRef.current = settings?.keybinding;

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return undefined;

    // Named handlers: cleanup must remove only ours. A bare socket.off(EVENT) would also
    // remove the page's listeners (joins, leaves), which broke presence and avatars.
    const onRemoteCode = ({ code: incomingCode, fileId: incomingFileId }) => {
      // !incomingFileId = standard room; matching fileId = this file in a project
      if (incomingCode !== null && (!incomingFileId || incomingFileId === fileId)) {
        setEditorCode(incomingCode);
        onCodeChangeRef.current?.(incomingCode);
      }
    };
    const onCursor = ({ cursor, userName: remoteUser, socketId, color, fileId: incomingFileId }) => {
      if (incomingFileId === fileId) {
        setRemoteCursors((prev) => ({ ...prev, [socketId]: { pos: cursor, userName: remoteUser, color: color || "#3b82f6" } }));
      } else {
        setRemoteCursors((prev) => { const next = { ...prev }; delete next[socketId]; return next; });
      }
    };
    const onJoined = ({ clients }) => {
      const ids = new Set(clients.map((c) => c.socketId));
      setRemoteCursors((prev) => Object.fromEntries(Object.entries(prev).filter(([sid]) => ids.has(sid))));
    };
    const onLeft = ({ socketId }) => {
      setRemoteCursors((prev) => { const next = { ...prev }; delete next[socketId]; return next; });
    };
    const onScroll = ({ scrollPos, fileId: incomingFileId }) => {
      if (incomingFileId !== fileId || keybindingRef.current === "vim" || keybindingRef.current === "emacs") return;
      const wrap = document.querySelector('.cm-content')?.closest('.cm-scroller');
      if (wrap) wrap.scrollTop = scrollPos;
    };

    socket.on(ACTIONS.CODE_CHANGE, onRemoteCode);
    socket.on(ACTIONS.CURSOR_MOVE, onCursor);
    socket.on(ACTIONS.JOINED, onJoined);
    socket.on(ACTIONS.DISCONNECTED, onLeft);
    socket.on(ACTIONS.SYNC_SCROLL, onScroll);
    return () => {
      socket.off(ACTIONS.CODE_CHANGE, onRemoteCode);
      socket.off(ACTIONS.CURSOR_MOVE, onCursor);
      socket.off(ACTIONS.JOINED, onJoined);
      socket.off(ACTIONS.DISCONNECTED, onLeft);
      socket.off(ACTIONS.SYNC_SCROLL, onScroll);
    };
  }, [socketRef, fileId]);

  useEffect(() => {
    if (code !== undefined && code !== editorCode) {
      setEditorCode(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleEditorChange = (value, viewUpdate) => {
    setEditorCode(value);
    onCodeChange(value);
    localStorage.setItem(`code-${roomId}`, value);

    // Sync code change
    // For standard Rooms (editor.js), we use CODE_CHANGE for real-time sync.
    // For Pro Projects (ProjectPage.js), we skip CODE_CHANGE to avoid echo loops
    // because ProjectPage handles sync via FILE_CHANGE on onCodeChange.
    if (!fileId && viewUpdate.docChanged) {
      // Only emit if change was not from incoming socket (avoids echo)
      const hasUserTransaction = viewUpdate.transactions.some(tr => tr.isUserEvent("input") || tr.isUserEvent("delete") || tr.isUserEvent("undo") || tr.isUserEvent("redo") || tr.annotation);
      if (hasUserTransaction || viewUpdate.transactions.length > 0) {
        socketRef.current?.emit(ACTIONS.CODE_CHANGE, {
          roomId,
          code: value,
        });
      }
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

  const getLanguageExtension = (lang) => editorLanguage(String(lang || "").toLowerCase());

  // Memoize cursor plugin — only rebuild when cursor positions change
  const memoizedCursorPlugin = useMemo(() => cursorPlugin(remoteCursors), [remoteCursors]);

  // Memoize ESLint linter so it's not rebuilt on every render
  const esLintLinter = useMemo(() => {
    if (settings?.enableLinting && language === "javascript") {
      try {
        // eslint-disable-next-line
        const { Linter } = require("eslint-linter-browserify");
        return [lintGutter(), linter(esLint(new Linter()))];
      } catch { return []; }
    }
    return [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.enableLinting, language]);

  // Cursor position / selection for the footer (only re-renders when they change).
  const [pos, setPos] = useState({ line: 1, col: 1, sel: 0, lines: 1 });
  const positionListener = useMemo(() => EditorView.updateListener.of((u) => {
    if (!u.selectionSet && !u.docChanged) return;
    const { state } = u;
    const sel = state.selection.main;
    const line = state.doc.lineAt(sel.head);
    const next = { line: line.number, col: sel.head - line.from + 1, sel: Math.abs(sel.to - sel.from), lines: state.doc.lines };
    setPos((p) => (p.line === next.line && p.col === next.col && p.sel === next.sel && p.lines === next.lines ? p : next));
  }), []);

  // Empty file: offer the language's starter template (synced like a normal edit).
  const insertTemplate = () => {
    const tpl = templateFor(language);
    if (!tpl) return;
    setEditorCode(tpl);
    onCodeChange(tpl);
    try { localStorage.setItem(`code-${roomId}`, tpl); } catch { /* storage blocked */ }
    if (!fileId) socketRef.current?.emit(ACTIONS.CODE_CHANGE, { roomId, code: tpl });
  };

  const [notchOff, setNotchOff] = useState(null); // language whose starter notch was dismissed
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(editorCode || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard blocked */ }
  };

  // Memoize the entire extensions array to prevent CodeMirror reconfiguration on every keystroke
  const editorExtensions = useMemo(() => [
    getLanguageExtension(language),
    editorChrome,
    positionListener,
    ...(settings?.wordWrap ? [EditorView.lineWrapping] : []),
    ...(settings?.keybinding === "vim" ? [vim()] : []),
    ...(settings?.keybinding === "emacs" ? [emacs()] : []),
    ...esLintLinter,
    memoizedCursorPlugin,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [language, settings?.wordWrap, settings?.keybinding, esLintLinter, memoizedCursorPlugin]);


  const fileName = filename || roomFileName(language);

  const lang = LANG_BY_ID[language];
  const editing = Object.values(remoteCursors).map((c) => c.userName).filter(Boolean);
  const isEmpty = !String(editorCode || "").trim();

  return (
    <div className="ec">
      {/* File bar: the tab name always follows the chosen language. */}
      <div className="ec-bar">
        {dragHandle}
        <div className="ec-file" title={fileName}>
          <span className="lp-badge">{lang?.short || language}</span>
          <span className="ec-name">{fileName}</span>
          {isReadOnly && <em className="ec-ro">read only</em>}
        </div>
        <div className="ec-tools">
          <button className="ec-icon" onClick={copyCode} title="Copy code" aria-label="Copy code" disabled={isEmpty}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
          {onDownload && (
            <button className="ec-icon" onClick={onDownload} title={`Download ${fileName}`} aria-label="Download code"><Download size={15} /></button>
          )}
          {!lockLanguage && <LangPicker value={language} onChange={onLanguageChange} disabled={isReadOnly} />}
        </div>
      </div>

      <div className="ec-body" style={{ fontSize: settings?.fontSize ? `${settings.fontSize}px` : "15px" }}>
        <CodeMirror
          value={editorCode}
          height="100%"
          theme={isLightMode ? colabsLight : colabsDark}
          readOnly={isReadOnly}
          editable={!isReadOnly}
          onChange={handleEditorChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            highlightSelectionMatches: true,
            tabSize: settings?.tabSize || 4,
          }}
          style={{ height: "100%" }}
          extensions={editorExtensions}
        />
        {isEmpty && !isReadOnly && templateFor(language) && notchOff !== language && (
          <div className="ec-notch" role="note">
            <button className="ec-notch-main" onClick={insertTemplate} title={`Insert a ${lang?.label || language} starter into ${fileName}`}>
              <Sparkles size={12} /> Insert {lang?.label || language} starter
            </button>
            <button className="ec-notch-x" onClick={() => setNotchOff(language)} aria-label="Hide" title="Hide"><X size={12} /></button>
          </div>
        )}
      </div>

      {statusTarget && createPortal(
        <>
          <span>Ln {pos.line}, Col {pos.col}</span>
          {pos.sel > 0 && <span>{pos.sel} selected</span>}
          <span>{pos.lines} {pos.lines === 1 ? "line" : "lines"}</span>
          <span>Spaces: {settings?.tabSize || 4}</span>
          {editing.length > 0 && (
            <span className="ec-typing"><i />{editing.length === 1 ? `${editing[0]} is here` : `${editing.length} others here`}</span>
          )}
        </>,
        statusTarget
      )}
    </div>
  );
}

export default EditorComp;
