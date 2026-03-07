import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: '100vh',
                    width: '100vw',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    fontFamily: 'Inter, sans-serif',
                    padding: '20px',
                    textAlign: 'center'
                }}>
                    <div style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        padding: '24px',
                        borderRadius: '50%',
                        marginBottom: '24px',
                        color: '#ef4444'
                    }}>
                        <AlertTriangle size={48} />
                    </div>

                    <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '16px' }}>Oops! Something went wrong.</h1>
                    <p style={{ color: '#94a3b8', maxWidth: '500px', lineHeight: '1.6', marginBottom: '32px' }}>
                        An unexpected error occurred in our system. Don't worry, your code is likely safe in local storage or the database.
                    </p>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 24px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <RefreshCw size={18} /> Reload App
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 24px',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Home size={18} /> Back to Home
                        </button>
                    </div>

                    {process.env.NODE_ENV === 'development' && (
                        <div style={{
                            marginTop: '48px',
                            padding: '16px',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            borderRadius: '12px',
                            textAlign: 'left',
                            maxWidth: '800px',
                            width: '100%',
                            overflow: 'auto',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <p style={{ color: '#ef4444', fontWeight: '700', marginBottom: '8px', fontSize: '14px' }}>Error Details:</p>
                            <pre style={{ margin: 0, fontSize: '12px', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>
                                {this.state.error && this.state.error.toString()}
                            </pre>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
