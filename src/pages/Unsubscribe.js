import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
    XCircle, 
    Mail, 
    ArrowLeft, 
    Loader2, 
    ShieldCheck, 
    Zap, 
    BellOff, 
    CheckCircle2,
    Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

const Unsubscribe = () => {
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email');
    const [loading, setLoading] = useState(true);
    const [isUnsubscribed, setIsUnsubscribed] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Robust Backend URL Resolution
    const getBackendUrl = () => {
        if (process.env.REACT_APP_BACKEND_URL) return process.env.REACT_APP_BACKEND_URL;
        const origin = window.location.origin;
        // Fallback for local development
        if (origin.includes('localhost:3000')) return 'http://localhost:5000';
        return origin;
    };
    const backendUrl = getBackendUrl();

    useEffect(() => {
        if (!email) {
            setLoading(false);
            return;
        }

        const checkStatus = async () => {
            try {
                const res = await fetch(`${backendUrl}/api/user-subscription?email=${encodeURIComponent(email)}`);
                if (!res.ok) throw new Error("Sync failed");
                const data = await res.json();
                setIsUnsubscribed(data.isUnsubscribed);
            } catch (err) {
                console.error("Failed to check subscription:", err);
            } finally {
                setLoading(false);
            }
        };

        checkStatus();
    }, [email, backendUrl]);

    const handleAction = async (unsubscribe) => {
        setProcessing(true);
        try {
            const res = await fetch(`${backendUrl}/api/unsubscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, unsubscribed: unsubscribe })
            });
            const data = await res.json();
            if (data.success) {
                setIsUnsubscribed(unsubscribe);
                toast.success(data.message);
            } else {
                toast.error(data.error || "Operation failed");
            }
        } catch (err) {
            toast.error("Network error. Please try again.");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fcfcfd' }}>
                <div style={{ position: 'relative', width: '64px', height: '64px' }}>
                    <div className="spinner" style={{ width: '100%', height: '100%', border: '3px solid #f1f5f9', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s ease-in-out infinite' }}></div>
                </div>
                <p style={{ marginTop: '24px', color: '#94a3b8', fontSize: '14px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Synchronizing...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!email) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fcfcfd', padding: '40px', fontFamily: "'Outfit', sans-serif" }}>
                <div style={{ backgroundColor: '#ffffff', padding: '64px', borderRadius: '48px', boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.05)', maxWidth: '540px', width: '100%', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                    <XCircle style={{ color: '#ef4444', marginBottom: '32px' }} size={64} strokeWidth={1.5} />
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', marginBottom: '20px', letterSpacing: '-0.02em' }}>Link Incomplete</h1>
                    <p style={{ color: '#64748b', marginBottom: '48px', fontSize: '18px', lineHeight: 1.6 }}>
                        This security link is missing required authentication parameters. Please access your preferences via the "Manage Notifications" link in your RTM Studio email.
                    </p>
                    <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', backgroundColor: '#0f172a', color: '#ffffff', padding: '20px 48px', borderRadius: '24px', fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s', fontSize: '16px' }}>
                        <ArrowLeft size={20} /> Back to Studio
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fcfcfd', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', fontFamily: "'Outfit', sans-serif" }}>
            <div style={{ maxWidth: '640px', width: '100%', backgroundColor: '#ffffff', borderRadius: '56px', boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.08)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                
                {/* Header Branding */}
                <div style={{ padding: '64px 64px 40px', textAlign: 'center' }}>
                    <img 
                        src="https://utkristi-colabs.onrender.com/utkristi-colabs.png" 
                        alt="RTM Studio" 
                        style={{ height: '24px', margin: '0 auto 48px', display: 'block' }}
                    />
                    <div style={{ 
                        width: '80px', 
                        height: '80px', 
                        borderRadius: '28px', 
                        backgroundColor: isUnsubscribed ? '#fff7ed' : '#f0f7ff', 
                        color: isUnsubscribed ? '#ea580c' : '#2563eb',
                        margin: '0 auto 32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                        {isUnsubscribed ? <BellOff size={36} strokeWidth={1.5} /> : <Mail size={36} strokeWidth={1.5} />}
                    </div>
                    <h1 style={{ fontSize: '36px', fontWeight: 800, color: '#0f172a', marginBottom: '16px', letterSpacing: '-0.04em' }}>
                        {isUnsubscribed ? "Action Confirmed" : "Communication Hub"}
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '18px', lineHeight: 1.6, maxWidth: '400px', margin: '0 auto' }}>
                        {isUnsubscribed 
                            ? "Your preferences have been updated. You will no longer receive notifications at:"
                            : "Configure how you receive project invites and technical updates for:"
                        }
                    </p>
                    <div style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#f8fafc', borderRadius: '12px', display: 'inline-block', border: '1px solid #f1f5f9', color: '#475569', fontWeight: 700, fontSize: '14px' }}>
                        {email}
                    </div>
                </div>

                {/* Form Content */}
                <div style={{ padding: '0 64px 64px' }}>
                    {!isUnsubscribed ? (
                        <div style={{ marginBottom: '48px' }}>
                            <div style={{ backgroundColor: '#f8fafc', borderRadius: '32px', padding: '32px', border: '1px dashed #e2e8f0' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Shield size={18} className="text-blue-600" /> Subscription Benefits
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                                            <Zap size={14} /> Alerts
                                        </div>
                                        <p style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 }}>Real-time sync and project updates.</p>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                                            <ShieldCheck size={14} /> Security
                                        </div>
                                        <p style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 }}>Workspace access and audit logs.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <button
                                onClick={() => handleAction(true)}
                                disabled={processing}
                                className="action-button"
                                style={{ 
                                    width: '100%', 
                                    backgroundColor: '#2563eb', 
                                    color: '#ffffff', 
                                    fontWeight: 700, 
                                    padding: '24px', 
                                    borderRadius: '24px', 
                                    border: 'none', 
                                    fontSize: '18px', 
                                    cursor: 'pointer', 
                                    marginTop: '40px',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    gap: '16px',
                                    boxShadow: '0 20px 40px -10px rgba(37, 99, 235, 0.25)',
                                    opacity: processing ? 0.7 : 1,
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                            >
                                {processing ? <Loader2 className="animate-spin" size={24} /> : "Confirm Unsubscribe"}
                                {!processing && <ArrowLeft style={{ transform: 'rotate(180deg)' }} size={20} />}
                            </button>
                        </div>
                    ) : (
                        <div style={{ marginBottom: '48px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#059669', fontWeight: 700, backgroundColor: '#f0fdf4', padding: '24px', borderRadius: '24px', border: '1px solid #d1fae5', marginBottom: '32px', fontSize: '16px' }}>
                                <CheckCircle2 size={24} /> System Preferences Synchronized
                            </div>
                            <button
                                onClick={() => handleAction(false)}
                                disabled={processing}
                                style={{ 
                                    width: '100%', 
                                    backgroundColor: '#0f172a', 
                                    color: '#ffffff', 
                                    fontWeight: 700, 
                                    padding: '24px', 
                                    borderRadius: '24px', 
                                    border: 'none', 
                                    fontSize: '18px', 
                                    cursor: 'pointer', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    gap: '16px',
                                    opacity: processing ? 0.7 : 1,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {processing && <Loader2 className="animate-spin" size={24} />}
                                Re-enable Communications
                            </button>
                        </div>
                    )}
                    
                    <div style={{ textAlign: 'center' }}>
                        <Link to="/" style={{ color: '#cbd5e1', fontWeight: 700, textDecoration: 'none', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'inline-flex', alignItems: 'center', gap: '12px', transition: 'color 0.2s' }} className="back-link">
                            <ArrowLeft size={16} /> Return to Studio Dashboard
                        </Link>
                    </div>
                </div>

                {/* Footer Branding */}
                <div style={{ padding: '40px 64px 64px', backgroundColor: '#fcfcfd', textAlign: 'center', borderTop: '1px solid #f1f5f9' }}>
                    <p style={{ color: '#cbd5e1', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                        &copy; 2026 Utkristi Colabs &middot; Enterprise Intelligence Systems
                    </p>
                </div>
            </div>
            
            <style>{`
                @media (max-width: 640px) {
                    div[style*="max-width: 640px"] { border-radius: 0 !important; border: none !important; }
                    div[style*="padding: 64px"] { padding: 48px 24px !important; }
                    h1 { font-size: 28px !important; }
                    .action-button { padding: 20px !important; font-size: 16px !important; }
                }
                .animate-spin { animation: spin 0.8s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .action-button:hover { transform: translateY(-2px); background-color: #1d4ed8 !important; }
                .back-link:hover { color: #94a3b8 !important; }
            `}</style>
        </div>
    );
};

export default Unsubscribe;
