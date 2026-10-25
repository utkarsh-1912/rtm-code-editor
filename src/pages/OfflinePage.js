import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import "react-reflex/styles.css";
import toast from "react-hot-toast";
import { ArrowLeft, FileUp, Save, Play, WifiOff, Wifi, Cpu } from "lucide-react";
import EditorComp from "../components/editorComp";
import OutputWindow from "../components/outputWindow";
import Logo from "../components/Logo";
import { THEMES } from "../config";
import { runCode, formatRun, desktop } from "../utils/runner";
import { languageForFile, fileNameFor, templateFor, labelFor } from "../utils/languages";
import { resolveTheme } from "../utils/theme";
import "../styles/app.css";

const KEY = "offline-buffer";
const load = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY));
        if (saved && typeof saved.code === "string") return saved;
    } catch { /* corrupted or blocked */ }
    return { language: "javascript", code: templateFor("javascript"), name: null, root: null };
};

// The desktop app's offline editor: one file, saved on this device as you type, run with this
// computer's own toolchains. No account or internet needed; nothing is sent anywhere.
export default function OfflinePage() {
    const navigate = useNavigate();
    const start = useRef(load()).current;
    const [language, setLanguage] = useState(start.language);
    const [code, setCode] = useState(start.code);
    const [file, setFile] = useState({ name: start.name, root: start.root }); // where Save writes
    const [output, setOutput] = useState("");
    const [isError, setIsError] = useState(false);
    const [time, setTime] = useState(null);
    const [stdin, setStdin] = useState("");
    const [running, setRunning] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const codeRef = useRef(code);
    const noSocket = useRef(null);
    const isLightMode = resolveTheme() === "light";
    const settings = (() => {
        try { return JSON.parse(localStorage.getItem("app-editor-settings")) || { fontSize: 16, tabSize: 4 }; } catch { return { fontSize: 16, tabSize: 4 }; }
    })();

    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener("online", up);
        window.addEventListener("offline", down);
        return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
    }, []);

    // Save on this device as you type.
    useEffect(() => {
        const t = setTimeout(() => {
            try { localStorage.setItem(KEY, JSON.stringify({ language, code, name: file.name, root: file.root })); } catch { /* full or blocked */ }
        }, 300);
        return () => clearTimeout(t);
    }, [language, code, file]);

    const run = useCallback(async () => {
        if (running) return;
        setRunning(true);
        setOutput("");
        try {
            const r = await runCode({ language, source: codeRef.current, stdin, localOnly: true });
            setOutput(formatRun(r));
            setIsError(!r.ok);
            setTime(r.timeMs ?? null);
        } catch (err) {
            setOutput(err.message);
            setIsError(true);
            setTime(null);
        } finally {
            setRunning(false);
        }
    }, [language, stdin, running]);

    const open = async () => {
        const picked = await desktop()?.openFiles?.().catch((err) => { toast.error(err.message); return null; });
        const f = picked?.files?.[0];
        if (!f) return;
        const lang = languageForFile(f.path);
        if (lang) setLanguage(lang);
        codeRef.current = f.content;
        setCode(f.content);
        setFile({ name: f.path, root: picked.root });
        toast.success(`Opened ${f.path}${lang ? "" : " (pick its language from the menu)"}`);
    };

    const save = async () => {
        const bridge = desktop();
        if (!bridge?.writeFiles) return toast.error("Saving to disk needs the desktop app.");
        try {
            let { root, name } = file;
            if (!root) {
                const picked = await bridge.pickSaveFolder();
                if (!picked) return;
                root = picked.root;
                name = fileNameFor(language);
            }
            await bridge.writeFiles({ root, files: [{ path: name, content: codeRef.current }] });
            setFile({ root, name });
            toast.success(`Saved ${name}`);
        } catch (err) {
            toast.error(err.message || "Could not save the file");
        }
    };

    // Ctrl+Enter runs, Ctrl+S saves, Ctrl+O opens.
    useEffect(() => {
        const onKey = (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            const k = e.key.toLowerCase();
            if (k === "enter") { e.preventDefault(); run(); }
            if (k === "s") { e.preventDefault(); save(); }
            if (k === "o") { e.preventDefault(); open(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    const changeLanguage = (lang) => {
        setLanguage(lang);
        // An untouched template follows the language; your own code stays.
        if (!codeRef.current.trim() || codeRef.current === templateFor(language)) {
            codeRef.current = templateFor(lang);
            setCode(templateFor(lang));
        }
    };

    return (
        <div className="ws off">
            <header className="off-head">
                <button className="u-icon" onClick={() => navigate(-1)} aria-label="Back" title="Back"><ArrowLeft size={18} /></button>
                <Logo size={24} compact />
                <div className="off-title">
                    <b>{file.name || `Untitled ${labelFor(language)}`}</b>
                    <span>{file.root ? file.root : "Saved on this device"}</span>
                </div>
                <span className={`off-net${online ? " is-on" : ""}`}>{online ? <Wifi size={13} /> : <WifiOff size={13} />} {online ? "Online" : "Offline"}</span>
                <div className="off-actions">
                    <button className="u-btn u-btn--ghost u-btn--sm" onClick={open} title="Open a file (Ctrl O)"><FileUp size={14} /> Open</button>
                    <button className="u-btn u-btn--ghost u-btn--sm" onClick={save} title="Save to disk (Ctrl S)"><Save size={14} /> Save</button>
                    <button className="u-btn u-btn--solid u-btn--sm" onClick={run} disabled={running} title="Run (Ctrl Enter)"><Play size={13} fill="currentColor" /> {running ? "Running…" : "Run"}</button>
                </div>
            </header>
            <div className="off-body">
                <ReflexContainer orientation="horizontal">
                    <ReflexElement flex={0.65} minSize={120}>
                        <EditorComp
                            socketRef={noSocket}
                            roomId="offline"
                            onCodeChange={(c) => { codeRef.current = c; setCode(c); }}
                            language={language}
                            onLanguageChange={changeLanguage}
                            theme={THEMES[0]}
                            code={code}
                            onRunCode={run}
                            isExecuting={running}
                            isLightMode={isLightMode}
                            settings={settings}
                            userName="You"
                        />
                    </ReflexElement>
                    <ReflexSplitter />
                    <ReflexElement flex={0.35} minSize={90}>
                        <OutputWindow output={running ? "Running…" : output} isError={isError} time={time} stdin={stdin} setStdin={setStdin} language={language} />
                    </ReflexElement>
                </ReflexContainer>
            </div>
            <footer className="off-foot">
                <span><Cpu size={12} /> Runs on this computer with your installed toolchains</span>
                <span>Nothing here is sent online</span>
            </footer>
        </div>
    );
}
