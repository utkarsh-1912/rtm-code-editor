import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Monitor, 
    Tablet, 
    Smartphone, 
    RotateCcw, 
    ArrowLeft, 
    Terminal, 
    Trash2, 
    Sun, 
    Moon,
    Copy,
    Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getBackendUrl } from '../utils/api';
import Loader from '../components/ux/Loader';
import { resolveTheme, setThemePref } from '../utils/theme';
import '../styles/app.css';
import ACTIONS from '../Action';
import { initSocket } from '../socket';
import { bundleWebProject } from '../utils/webBundle';

export default function WebRenderPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState(null);
    const [files, setFiles] = useState([]);
    const [webSrcDoc, setWebSrcDoc] = useState('');
    
    // Viewport responsive state: 'desktop' | 'tablet' | 'mobile'
    const [viewport, setViewport] = useState('desktop');
    const [isLandscape, setIsLandscape] = useState(false);
    
    // Console drawer state
    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    const [consoleLogs, setConsoleLogs] = useState([]);
    
    // Theme state
    const [bgTheme, setBgTheme] = useState(resolveTheme); // 'dark' | 'light'
    const [copied, setCopied] = useState(false);
    
    const socketRef = useRef(null);

    // 1. Fetch Project & Files
    const loadProjectData = useCallback(async () => {
        try {
            setLoading(true);
            const backendUrl = getBackendUrl();
            
            const projRes = await fetch(`${backendUrl}/api/projects/${projectId}`);
            if (!projRes.ok) throw new Error("Project not found");
            const projData = await projRes.json();
            setProject(projData);

            const filesRes = await fetch(`${backendUrl}/api/projects/${projectId}/files`);
            if (!filesRes.ok) throw new Error("Files not found");
            const filesData = await filesRes.json();
            setFiles(filesData);

            bundleWebApp(filesData);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load web application preview");
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadProjectData();
    }, [loadProjectData]);

    // 2. Setup Socket for Live Reload on Code Changes
    useEffect(() => {
        let isMounted = true;
        const setupSocket = async () => {
            try {
                socketRef.current = await initSocket();
                if (!isMounted) return;

                socketRef.current.emit(ACTIONS.JOIN, {
                    roomId: `project-${projectId}`,
                    user: { name: 'Preview Engine', isGuest: true }
                });

                socketRef.current.on(ACTIONS.FILE_CHANGE, ({ fileId, content }) => {
                    setFiles(prev => {
                        const updated = prev.map(f => f.id === fileId ? { ...f, content } : f);
                        bundleWebApp(updated);
                        return updated;
                    });
                });
            } catch (e) {
                console.error("Socket error in render page:", e);
            }
        };

        setupSocket();

        return () => {
            isMounted = false;
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [projectId]);

    // 3. Listen for iframe console messages
    useEffect(() => {
        const handleIframeMessage = (event) => {
            if (event.data?.type === 'CONSOLE_LOG' || event.data?.type === 'CONSOLE_WARN' || event.data?.type === 'CONSOLE_ERROR') {
                const newLog = {
                    id: Date.now() + Math.random(),
                    type: event.data.type,
                    message: event.data.log,
                    time: new Date().toLocaleTimeString()
                };
                setConsoleLogs(prev => [...prev.slice(-200), newLog]);
            }
        };
        window.addEventListener('message', handleIframeMessage);
        return () => window.removeEventListener('message', handleIframeMessage);
    }, []);

    // 4. Bundle HTML, CSS, JS into srcDoc
    const bundleWebApp = (filesList) => setWebSrcDoc(bundleWebProject(filesList));

    const copyShareUrl = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            toast.success("Standalone Preview link copied!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Failed to copy link");
        }
    };

    const getViewportStyles = () => {
        if (viewport === 'mobile') {
            return { width: isLandscape ? '812px' : '375px', height: isLandscape ? '375px' : '812px', borderRadius: '36px', border: '10px solid var(--u-solid)' };
        }
        if (viewport === 'tablet') {
            return { width: isLandscape ? '1024px' : '768px', height: isLandscape ? '768px' : '1024px', borderRadius: '26px', border: '12px solid var(--u-solid)' };
        }
        return { width: '100%', height: '100%', borderRadius: 0, border: 'none' };
    };

    const toggleTheme = () => {
        const next = bgTheme === 'dark' ? 'light' : 'dark';
        setBgTheme(next);
        setThemePref(next);
    };

    if (loading) {
        return (
            <div className="ws">
                <Loader variant="fill" message="Building preview" detail="Bundling project files" />
            </div>
        );
    }

    return (
        <div className="ws">
            <header className="wsh">
                <div className="wsh-left">
                    <button className="u-btn u-btn--sm u-btn--ghost" onClick={() => navigate(`/project/${projectId}`)}>
                        <ArrowLeft size={14} /> Editor
                    </button>
                    <div className="wsh-crumb">
                        <span>preview</span><i>/</i>
                        <button disabled>{project?.name || 'Web app'}</button>
                        <span className="u-chip u-chip--mono u-chip--accent"><span className="u-dot" /> live</span>
                    </div>
                </div>

                <div className="u-seg" role="tablist" aria-label="Viewport">
                    {[
                        ['desktop', <Monitor size={13} />, 'Desktop'],
                        ['tablet', <Tablet size={13} />, 'Tablet'],
                        ['mobile', <Smartphone size={13} />, 'Mobile'],
                    ].map(([id, icon, label]) => (
                        <button key={id} className={viewport === id ? 'on' : ''} onClick={() => setViewport(id)} title={label}>{icon}<span className="wr-hide">{label}</span></button>
                    ))}
                    {viewport !== 'desktop' && (
                        <button className={isLandscape ? 'on' : ''} onClick={() => setIsLandscape(!isLandscape)} title="Toggle orientation">
                            {isLandscape ? 'Landscape' : 'Portrait'}
                        </button>
                    )}
                </div>

                <div className="wsh-right">
                    <div className="wsh-group" style={{ borderLeft: 0 }}>
                        <button className={`u-icon${isConsoleOpen ? ' on' : ''}`} onClick={() => setIsConsoleOpen(!isConsoleOpen)} title="Console" aria-label="Toggle console">
                            <Terminal size={17} />
                            {consoleLogs.length > 0 && <span className="u-badge" />}
                        </button>
                        <button className="u-icon" onClick={() => bundleWebApp(files)} title="Reload" aria-label="Reload preview"><RotateCcw size={17} /></button>
                        <button className="u-icon" onClick={copyShareUrl} title="Copy link" aria-label="Copy shareable link">{copied ? <Check size={17} /> : <Copy size={17} />}</button>
                        <button className="u-icon" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">{bgTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
                    </div>
                </div>
            </header>

            <div className="wr-stage" style={{ padding: viewport === 'desktop' ? 0 : 24 }}>
                <div className="wr-device" style={getViewportStyles()}>
                    {viewport !== 'desktop' && (
                        <div className="ws-browser-bar"><i /><i /><i /><span>{window.location.host}/render/{projectId}</span></div>
                    )}
                    <iframe
                        key={webSrcDoc}
                        srcDoc={webSrcDoc}
                        title="Standalone Web App Preview"
                        style={{ width: '100%', height: viewport === 'desktop' ? '100%' : 'calc(100% - 30px)', border: 'none', background: '#fff', display: 'block' }}
                        sandbox="allow-scripts allow-modals allow-forms allow-popups"
                    />
                </div>
            </div>

            {isConsoleOpen && (
                <div className="wr-console">
                    <div className="ws-pane-head">
                        <span><Terminal size={12} /> Console <b>{consoleLogs.length}</b></span>
                        <button className="u-icon" style={{ width: 28, height: 28 }} onClick={() => setConsoleLogs([])} title="Clear console" aria-label="Clear console"><Trash2 size={13} /></button>
                    </div>
                    <div className="ws-console" style={{ padding: '10px 16px' }}>
                        {consoleLogs.length === 0 ? (
                            <span className="u-faint">No console messages yet.</span>
                        ) : consoleLogs.map((log) => (
                            <div key={log.id} className={`wr-log ${log.type === 'CONSOLE_ERROR' ? 'err' : log.type === 'CONSOLE_WARN' ? 'warn' : ''}`}>
                                <span>{log.time}</span>
                                <span>{log.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
