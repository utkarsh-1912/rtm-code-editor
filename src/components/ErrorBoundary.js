import React from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw, Copy, Check, Bug } from 'lucide-react';

const RELOAD_KEY = 'eb-chunk-reload';
// Crash reports go to Support (the source code isn't public).
const SUPPORT_URL = '/support';

// After a deploy, an open tab can ask for script files that no longer exist. One automatic
// reload fixes that; the session flag stops a reload loop if it keeps failing.
const isStaleBundle = (error) => /ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(`${error?.name} ${error?.message}`);

// Catches render errors. Shows a recoverable screen: try again (re-render without a reload),
// reload, go home, copy details for a bug report. `compact` = inside the app (one page crashed).
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, info: null, copied: false, at: null };
    }

    static getDerivedStateFromError(error) {
        return { error, at: new Date() };
    }

    componentDidCatch(error, info) {
        console.error('Uncaught error:', error, info?.componentStack);
        this.setState({ info });
        if (isStaleBundle(error)) {
            let tried = false;
            try { tried = sessionStorage.getItem(RELOAD_KEY) === '1'; sessionStorage.setItem(RELOAD_KEY, '1'); } catch { /* storage blocked */ }
            if (!tried) window.location.reload();
        }
    }

    componentDidMount() {
        // A page that renders fine clears the reload guard for next time.
        setTimeout(() => { try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* storage blocked */ } }, 5000);
    }

    details() {
        const { error, info, at } = this.state;
        const stack = String(error?.stack || '').split('\n').slice(0, 8).join('\n');
        const comp = String(info?.componentStack || '').trim().split('\n').slice(0, 6).join('\n');
        return [
            `Error: ${error?.message || error}`,
            `Page: ${window.location.pathname}${window.location.search}`,
            `Time: ${(at || new Date()).toISOString()}`,
            `App: ${window.colabsDesktop ? 'desktop' : 'web'} · ${navigator.userAgent}`,
            '',
            stack,
            comp && `\nComponents:\n${comp}`,
        ].filter(Boolean).join('\n');
    }

    copy = async () => {
        try {
            await navigator.clipboard.writeText(this.details());
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 1600);
        } catch { /* clipboard blocked */ }
    };

    retry = () => this.setState({ error: null, info: null, at: null });

    render() {
        const { error, copied } = this.state;
        if (!error) return this.props.children;

        const stale = isStaleBundle(error);
        const title = stale ? 'A new version is available' : 'Something broke on this page';
        const lede = stale
            ? 'The app was updated while this tab was open. Reload to get the latest version.'
            : 'Your work is safe: room code is saved on this device and synced to your room, and projects are saved as you type.';
        const report = `${SUPPORT_URL}?topic=${encodeURIComponent(`Crash: ${String(error?.message || error).slice(0, 80)}`)}`;

        return (
            <div className={`eb${this.props.compact ? ' eb--compact' : ''}`} role="alert">
                <div className="eb-card">
                    <span className="eb-icon" aria-hidden="true">{stale ? <RefreshCw size={22} /> : <AlertTriangle size={22} />}</span>
                    <h1>{title}</h1>
                    <p>{lede}</p>
                    <code className="eb-msg">{String(error?.message || error).slice(0, 220)}</code>

                    <div className="eb-actions">
                        {!stale && <button className="eb-btn eb-btn--primary" onClick={this.retry}><RotateCcw size={15} /> Try again</button>}
                        <button className={`eb-btn${stale ? ' eb-btn--primary' : ''}`} onClick={() => window.location.reload()}><RefreshCw size={15} /> Reload</button>
                        <button className="eb-btn" onClick={() => { window.location.href = '/'; }}><Home size={15} /> Home</button>
                    </div>

                    {!stale && (
                        <div className="eb-foot">
                            <button className="eb-link" onClick={this.copy}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy error details'}</button>
                            <a className="eb-link" href={report} target="_blank" rel="noreferrer"><Bug size={13} /> Report an issue</a>
                        </div>
                    )}

                    {process.env.NODE_ENV === 'development' && (
                        <details className="eb-dev">
                            <summary>Stack (development only)</summary>
                            <pre>{this.details()}</pre>
                        </details>
                    )}
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
