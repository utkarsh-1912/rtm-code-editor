import React, { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { EditorView, Decoration, ViewPlugin, WidgetType } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { emacs } from "@replit/codemirror-emacs";
import ACTIONS from "../Action";
import { Terminal, X } from "lucide-react";

// --- Remote Cursor Branding ---
class CursorWidget extends WidgetType {
    constructor(name, color) { super(); this.name = name; this.color = color; }
    toDOM() {
        const wrap = document.createElement("span");
        wrap.className = "remote-cursor";
        wrap.style.cssText = `border-left: 2px solid ${this.color}; position: relative; height: 1.2em; display: inline-block; vertical-align: middle; margin: 0 -1px; pointer-events: none;`;
        const label = document.createElement("div");
        label.textContent = this.name;
        label.style.cssText = `position: absolute; bottom: 100%; left: 0; white-space: nowrap; background-color: ${this.color}; color: white; font-size: 10px; padding: 1px 4px; border-radius: 2px; z-index: 10; margin-bottom: 2px;`;
        wrap.appendChild(label);
        return wrap;
    }
}

const cursorPlugin = (remoteCursors) => ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = this.getDecorations(view); }
    update(update) { if (update.docChanged || update.selectionSet || update.viewportChanged) this.decorations = this.getDecorations(update.view); }
    getDecorations(view) {
        const widgets = [];
        for (const [, data] of Object.entries(remoteCursors)) {
            if (data.pos !== undefined && data.pos <= view.state.doc.length) {
                widgets.push(Decoration.widget({ widget: new CursorWidget(data.userName, data.color), side: 1 }).range(data.pos));
            }
        }
        return Decoration.set(widgets.sort((a, b) => a.from - b.from));
    }
}, { decorations: v => v.decorations });

// --- Project Specific Editor ---
function ProjectEditor({
    socketRef,
    roomId,
    fileId,
    filename,
    code,
    userName,
    onCodeChange,
    settings,
    isLightMode,
    language,
    userInput,
    setUserInput
}) {
    const [editorCode, setEditorCode] = useState(code || "");
    const [remoteCursors, setRemoteCursors] = useState({});
    const [showInputModal, setShowInputModal] = useState(false);
    const bypassRef = useRef(false); // To prevent echo feedback loops

    // 1. Sync Remote Code Changes
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const handleCodeChange = ({ content: incomingCode, fileId: incomingFileId, socketId }) => {
            if (socketId === socket.id) return; // Ignore own changes
            if (incomingFileId === fileId && incomingCode !== null) {
                bypassRef.current = true;
                setEditorCode(incomingCode);
                // Important: Notify parent so it updates global files state
                onCodeChange(incomingCode, true); // true = isRemote
            }
        };

        const handleCursorMove = ({ cursor, userName: remoteUser, socketId, color, fileId: incomingFileId }) => {
            if (incomingFileId === fileId) {
                setRemoteCursors(prev => ({ ...prev, [socketId]: { pos: cursor, userName: remoteUser, color: color || "#3b82f6" } }));
            } else {
                setRemoteCursors(prev => { const next = { ...prev }; delete next[socketId]; return next; });
            }
        };

        socket.on(ACTIONS.FILE_CHANGE, handleCodeChange);
        socket.on(ACTIONS.CURSOR_MOVE, handleCursorMove);
        socket.on(ACTIONS.DISCONNECTED, ({ socketId }) => {
            setRemoteCursors(prev => { const next = { ...prev }; delete next[socketId]; return next; });
        });

        return () => {
            socket.off(ACTIONS.FILE_CHANGE, handleCodeChange);
            socket.off(ACTIONS.CURSOR_MOVE, handleCursorMove);
            socket.off(ACTIONS.DISCONNECTED);
        };
    }, [socketRef, fileId, onCodeChange]);

    // 2. Local Update when props change (important for file switching)
    useEffect(() => {
        if (code !== undefined && code !== editorCode) {
            setEditorCode(code);
        }
    }, [code, fileId, editorCode]); // Added fileId and editorCode to dependencies

    // 3. User Input Handler
    const handleEditorChange = (value, viewUpdate) => {
        if (bypassRef.current) {
            bypassRef.current = false;
            return;
        }

        setEditorCode(value);
        onCodeChange(value, false); // false = isNotRemote

        // Real-time broadcast
        if (viewUpdate.docChanged && socketRef.current) {
            socketRef.current.emit(ACTIONS.FILE_CHANGE, {
                roomId,
                fileId,
                content: value,
                socketId: socketRef.current.id
            });
        }

        // Sync cursor movement
        const cursor = viewUpdate.state.selection.main.head;
        socketRef.current?.emit(ACTIONS.CURSOR_MOVE, {
            roomId,
            fileId,
            cursor,
            userName,
            color: "#3b82f6",
        });
    };

    const getLanguageExtension = (lang) => {
        switch (lang) {
            case "javascript": return javascript({ jsx: true });
            case "python": return python();
            case "cpp": return cpp();
            case "html": return html();
            default: return javascript();
        }
    };

    return (
        <div style={{ height: "100%", backgroundColor: "#0d1117", overflow: "hidden", position: 'relative' }}>
            <CodeMirror
                value={editorCode}
                height="100%"
                theme={isLightMode ? "light" : dracula}
                onChange={handleEditorChange}
                basicSetup={{
                    lineNumbers: true,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    tabSize: settings?.tabSize || 4,
                }}
                extensions={[
                    getLanguageExtension(language),
                    ...(settings?.wordWrap ? [EditorView.lineWrapping] : []),
                    ...(settings?.keybinding === "vim" ? [vim()] : []),
                    ...(settings?.keybinding === "emacs" ? [emacs()] : []),
                    cursorPlugin(remoteCursors),
                ]}
                style={{ height: "100%" }}
            />

            {/* Floating Input Trigger */}
            <button
                onClick={() => setShowInputModal(true)}
                title="Program Input (STDIN)"
                style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 50,
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--primary)';
                    e.currentTarget.style.color = 'white';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                    e.currentTarget.style.color = 'var(--primary)';
                }}
            >
                <Terminal size={18} />
            </button>

            {/* Input Overlay Modal */}
            {showInputModal && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-panel" style={{
                        width: '400px',
                        padding: '24px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        position: 'relative'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Terminal size={20} color="var(--primary)" />
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Program Input</h3>
                            </div>
                            <button 
                                onClick={() => setShowInputModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                            Provide text that will be sent to the program's standard input (STDIN) during execution.
                        </p>

                        <textarea 
                            style={{
                                width: '100%',
                                height: '150px',
                                backgroundColor: '#0d1117',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'white',
                                padding: '12px',
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                resize: 'none',
                                outline: 'none',
                                transition: 'border 0.2s'
                            }}
                            autoFocus
                            placeholder="Enter stdin here..."
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button 
                                onClick={() => setShowInputModal(false)}
                                style={{
                                    padding: '8px 24px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: 'var(--primary)',
                                    color: 'white',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
                                }}
                            >
                                Save Input
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProjectEditor;
