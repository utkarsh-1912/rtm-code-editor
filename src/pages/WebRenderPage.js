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
    Check,
    Globe
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getBackendUrl } from '../utils/api';
import LogoLoader from '../components/LogoLoader';
import ACTIONS from '../Action';
import { initSocket } from '../socket';

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
    const [bgTheme, setBgTheme] = useState('dark'); // 'dark' | 'light'
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
    const bundleWebApp = (filesList) => {
        const htmlFile = filesList.find(f => f.name === 'index.html' || f.name.endsWith('.html'))?.content 
            || '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Web App</title></head><body><h1>Web Application Preview</h1></body></html>';
        const cssFile = filesList.find(f => f.name === 'style.css' || f.name.endsWith('.css'))?.content || '';
        const jsFile = filesList.find(f => f.name === 'script.js' || f.name.endsWith('.js'))?.content || '';

        const consoleInterceptor = `
        <script>
          (function() {
            const _log = console.log, _error = console.error, _warn = console.warn;
            console.log = function(...args) {
              _log.apply(console, args);
              window.parent.postMessage({ type: 'CONSOLE_LOG', log: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
            };
            console.error = function(...args) {
              _error.apply(console, args);
              window.parent.postMessage({ type: 'CONSOLE_ERROR', log: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
            };
            console.warn = function(...args) {
              _warn.apply(console, args);
              window.parent.postMessage({ type: 'CONSOLE_WARN', log: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
            };
            window.onerror = function(msg, url, line) {
              window.parent.postMessage({ type: 'CONSOLE_ERROR', log: 'Uncaught Error: ' + msg + ' (Line ' + line + ')' }, '*');
            };
          })();
        </script>
        `;

        let bundled = htmlFile;
        if (bundled.includes('</head>')) {
            bundled = bundled.replace('</head>', `${consoleInterceptor}<style>\n${cssFile}\n</style></head>`);
        } else {
            bundled = `${consoleInterceptor}<style>\n${cssFile}\n</style>${bundled}`;
        }

        if (bundled.includes('</body>')) {
            bundled = bundled.replace('</body>', `<script>\n${jsFile}\n</script></body>`);
        } else {
            bundled = `${bundled}\n<script>\n${jsFile}\n</script>`;
        }

        setWebSrcDoc(bundled);
    };

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
            return {
                width: isLandscape ? '812px' : '375px',
                height: isLandscape ? '375px' : '812px',
                borderRadius: '36px',
                border: '12px solid #1e293b',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            };
        }
        if (viewport === 'tablet') {
            return {
                width: isLandscape ? '1024px' : '768px',
                height: isLandscape ? '768px' : '1024px',
                borderRadius: '24px',
                border: '14px solid #1e293b',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            };
        }
        return {
            width: '100%',
            height: '100%',
            borderRadius: '0px',
            border: 'none',
            boxShadow: 'none'
        };
    };

    if (loading) {
        return (
            <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a", color: "white" }}>
                <LogoLoader message="Building Standalone Web Render Engine..." />
            </div>
        );
    }

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: bgTheme === 'dark' ? '#0f172a' : '#f8fafc',
            color: bgTheme === 'dark' ? '#f8fafc' : '#0f172a',
            fontFamily: "'Inter', sans-serif",
            overflow: 'hidden'
        }}>
            {/* Header Toolbar */}
            <div style={{
                height: '52px',
                backgroundColor: bgTheme === 'dark' ? '#1e293b' : '#ffffff',
                borderBottom: `1px solid ${bgTheme === 'dark' ? '#334155' : '#e2e8f0'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                zIndex: 100,
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
                {/* Left Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => navigate(`/project/${projectId}`)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: 'transparent',
                            border: `1px solid ${bgTheme === 'dark' ? '#475569' : '#cbd5e1'}`,
                            color: bgTheme === 'dark' ? '#f8fafc' : '#334155',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        <ArrowLeft size={14} /> Back to Editor
                    </button>

                    <div style={{ height: '18px', width: '1px', backgroundColor: bgTheme === 'dark' ? '#475569' : '#cbd5e1' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Globe size={16} color="#3b82f6" />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: bgTheme === 'dark' ? '#ffffff' : '#0f172a' }}>
                            {project?.name || 'Web App'}
                        </span>
                        <span style={{ fontSize: '10px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                            LIVE WEB RENDER
                        </span>
                    </div>
                </div>

                {/* Viewport Mode Switcher */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: bgTheme === 'dark' ? '#0f172a' : '#f1f5f9',
                    padding: '3px',
                    borderRadius: '8px',
                    border: `1px solid ${bgTheme === 'dark' ? '#334155' : '#cbd5e1'}`
                }}>
                    <button
                        onClick={() => setViewport('desktop')}
                        title="Desktop Viewport (100%)"
                        style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: viewport === 'desktop' ? '#3b82f6' : 'transparent',
                            color: viewport === 'desktop' ? '#ffffff' : bgTheme === 'dark' ? '#94a3b8' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                        }}
                    >
                        <Monitor size={14} /> Desktop
                    </button>
                    <button
                        onClick={() => setViewport('tablet')}
                        title="Tablet Viewport (768px)"
                        style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: viewport === 'tablet' ? '#3b82f6' : 'transparent',
                            color: viewport === 'tablet' ? '#ffffff' : bgTheme === 'dark' ? '#94a3b8' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                        }}
                    >
                        <Tablet size={14} /> Tablet
                    </button>
                    <button
                        onClick={() => setViewport('mobile')}
                        title="Mobile Viewport (375px)"
                        style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: viewport === 'mobile' ? '#3b82f6' : 'transparent',
                            color: viewport === 'mobile' ? '#ffffff' : bgTheme === 'dark' ? '#94a3b8' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                        }}
                    >
                        <Smartphone size={14} /> Mobile
                    </button>

                    {viewport !== 'desktop' && (
                        <button
                            onClick={() => setIsLandscape(!isLandscape)}
                            title="Toggle Orientation"
                            style={{
                                padding: '5px 8px',
                                marginLeft: '4px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: isLandscape ? '#10b981' : 'transparent',
                                color: isLandscape ? '#ffffff' : bgTheme === 'dark' ? '#94a3b8' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: '700'
                            }}
                        >
                            {isLandscape ? 'Landscape' : 'Portrait'}
                        </button>
                    )}
                </div>

                {/* Right Action Tools */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                        title="Toggle Console Output"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: `1px solid ${bgTheme === 'dark' ? '#475569' : '#cbd5e1'}`,
                            backgroundColor: isConsoleOpen ? '#3b82f6' : 'transparent',
                            color: isConsoleOpen ? '#ffffff' : bgTheme === 'dark' ? '#f8fafc' : '#334155',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        <Terminal size={14} /> Console {consoleLogs.length > 0 && `(${consoleLogs.length})`}
                    </button>

                    <button
                        onClick={() => bundleWebApp(files)}
                        title="Reload Web App"
                        style={{
                            padding: '6px',
                            borderRadius: '6px',
                            border: `1px solid ${bgTheme === 'dark' ? '#475569' : '#cbd5e1'}`,
                            backgroundColor: 'transparent',
                            color: bgTheme === 'dark' ? '#f8fafc' : '#334155',
                            cursor: 'pointer',
                            display: 'flex'
                        }}
                    >
                        <RotateCcw size={14} />
                    </button>

                    <button
                        onClick={copyShareUrl}
                        title="Copy Shareable Link"
                        style={{
                            padding: '6px',
                            borderRadius: '6px',
                            border: `1px solid ${bgTheme === 'dark' ? '#475569' : '#cbd5e1'}`,
                            backgroundColor: 'transparent',
                            color: bgTheme === 'dark' ? '#f8fafc' : '#334155',
                            cursor: 'pointer',
                            display: 'flex'
                        }}
                    >
                        {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>

                    <button
                        onClick={() => setBgTheme(bgTheme === 'dark' ? 'light' : 'dark')}
                        title="Toggle Background Theme"
                        style={{
                            padding: '6px',
                            borderRadius: '6px',
                            border: `1px solid ${bgTheme === 'dark' ? '#475569' : '#cbd5e1'}`,
                            backgroundColor: 'transparent',
                            color: bgTheme === 'dark' ? '#f8fafc' : '#334155',
                            cursor: 'pointer',
                            display: 'flex'
                        }}
                    >
                        {bgTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    </button>
                </div>
            </div>

            {/* Main Render Area */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                padding: viewport === 'desktop' ? '0' : '20px'
            }}>
                <div style={{
                    ...getViewportStyles(),
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    position: 'relative',
                    backgroundColor: '#ffffff'
                }}>
                    {/* Simulated Browser URL bar for tablet/mobile frame */}
                    {viewport !== 'desktop' && (
                        <div style={{
                            height: '28px',
                            backgroundColor: '#f1f5f9',
                            borderBottom: '1px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 12px',
                            gap: '8px'
                        }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                            </div>
                            <div style={{
                                flex: 1,
                                backgroundColor: '#ffffff',
                                height: '18px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                fontSize: '10px',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 8px',
                                fontFamily: 'monospace'
                            }}>
                                http://localhost:3000/render/{projectId}
                            </div>
                        </div>
                    )}

                    <iframe
                        key={webSrcDoc}
                        srcDoc={webSrcDoc}
                        title="Standalone Web App Preview"
                        style={{
                            width: '100%',
                            height: viewport === 'desktop' ? '100%' : 'calc(100% - 28px)',
                            border: 'none',
                            backgroundColor: '#ffffff'
                        }}
                        sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                    />
                </div>
            </div>

            {/* Bottom Console Drawer */}
            {isConsoleOpen && (
                <div style={{
                    height: '200px',
                    backgroundColor: '#090d16',
                    borderTop: '1px solid #1e293b',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 90
                }}>
                    <div style={{
                        padding: '6px 16px',
                        backgroundColor: '#0f172a',
                        borderBottom: '1px solid #1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Terminal size={14} color="#3b82f6" />
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Interactive Console Output
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                                onClick={() => setConsoleLogs([])}
                                title="Clear Console"
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    </div>

                    <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6' }}>
                        {consoleLogs.length === 0 ? (
                            <div style={{ color: '#475569', fontStyle: 'italic' }}>No console messages logged yet.</div>
                        ) : (
                            consoleLogs.map(log => (
                                <div key={log.id} style={{
                                    display: 'flex',
                                    gap: '10px',
                                    color: log.type === 'CONSOLE_ERROR' ? '#f87171' : log.type === 'CONSOLE_WARN' ? '#fbbf24' : '#4ade80',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    padding: '2px 0'
                                }}>
                                    <span style={{ color: '#64748b', fontSize: '10px', minWidth: '60px' }}>[{log.time}]</span>
                                    <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{log.message}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
