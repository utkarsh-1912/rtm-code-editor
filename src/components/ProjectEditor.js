import React, { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { colabsDark, colabsLight, editorChrome } from "../utils/editorTheme";
import { EditorView } from "@codemirror/view";
import { remoteCursorPlugin } from "./remoteCursor";
import { vim } from "@replit/codemirror-vim";
import { emacs } from "@replit/codemirror-emacs";
import { editorLanguage } from "../utils/languages";
import ACTIONS from "../Action";

// --- Remote Cursor Branding ---

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
    language
}) {
    const [editorCode, setEditorCode] = useState(code || "");
    const [remoteCursors, setRemoteCursors] = useState({});
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
        const handleLeft = ({ socketId }) => {
            setRemoteCursors(prev => { const next = { ...prev }; delete next[socketId]; return next; });
        };
        socket.on(ACTIONS.DISCONNECTED, handleLeft);

        return () => {
            socket.off(ACTIONS.FILE_CHANGE, handleCodeChange);
            socket.off(ACTIONS.CURSOR_MOVE, handleCursorMove);
            socket.off(ACTIONS.DISCONNECTED, handleLeft); // only ours; never strip the page's listeners
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

    // `lang` may be a language name or a file extension.
    const getLanguageExtension = (lang) => editorLanguage(String(lang || "").toLowerCase());

    return (
        <div style={{ height: "100%", backgroundColor: "var(--u-bg, #282a36)", overflow: "hidden", position: 'relative' }}>
            <CodeMirror
                value={editorCode}
                height="100%"
                theme={isLightMode ? colabsLight : colabsDark}
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
                    editorChrome,
                    ...(settings?.wordWrap ? [EditorView.lineWrapping] : []),
                    ...(settings?.keybinding === "vim" ? [vim()] : []),
                    ...(settings?.keybinding === "emacs" ? [emacs()] : []),
                    remoteCursorPlugin(remoteCursors),
                ]}
                style={{ height: "100%" }}
            />

        </div>
    );
}

export default ProjectEditor;
