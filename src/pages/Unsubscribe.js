import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
    XCircle,
    Mail,
    Loader2,
    ShieldCheck,
    Zap,
    BellOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import ContentLayout from '../components/ContentLayout';

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
            <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 className="animate-spin" style={{ color: 'var(--primary)' }} size={40} />
                <p style={{ marginTop: '24px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Synchronizing...</p>
                <style>{`
                    .animate-spin { animation: spin 1s linear infinite; }
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    if (!email) {
        return (
            <ContentLayout title="Security Check">
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <XCircle style={{ color: '#ef4444', marginBottom: '24px' }} size={64} strokeWidth={1.5} />
                    <p style={{ color: 'var(--text-main)', fontSize: '18px', lineHeight: 1.6, marginBottom: '32px' }}>
                        This subscription management link is missing required authentication parameters.
                        Please access your preferences via the link provided in your latest RTM Studio email.
                    </p>
                    <Link to="/" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>
                        Back to Workspace
                    </Link>
                </div>
            </ContentLayout>
        );
    }

    return (
        <ContentLayout title={isUnsubscribed ? "Preferences Set" : "Management Hub"}>
            <div style={{ marginBottom: '48px' }}>
                <p style={{ fontSize: '18px', lineHeight: '1.6', color: 'var(--text-main)', fontWeight: '500', marginBottom: '20px' }}>
                    {isUnsubscribed
                        ? "Your preferences have been updated. You will no longer receive communications at:"
                        : "Configure how you receive project invites and technical updates for:"
                    }
                </p>
                <div style={{ padding: '12px 20px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', display: 'inline-block', border: '1px solid var(--border-color)', color: 'var(--primary)', fontWeight: 700, fontSize: '15px', fontFamily: 'monospace' }}>
                    {email}
                </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '48px', borderRadius: '32px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '20px',
                    backgroundColor: isUnsubscribed ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                    color: isUnsubscribed ? '#f59e0b' : 'var(--primary)',
                    margin: '0 auto 32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease'
                }}>
                    {isUnsubscribed ? <BellOff size={32} /> : <Mail size={32} />}
                </div>

                {!isUnsubscribed ? (
                    <>
                        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '16px' }}>Ready to Unsubscribe?</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '15px' }}>
                            You will stop receiving all automated system invitations and technical reports. You can return here anytime to re-enable them.
                        </p>
                        <button
                            onClick={() => handleAction(true)}
                            disabled={processing}
                            style={{
                                backgroundColor: '#ef4444',
                                color: '#white',
                                fontWeight: 700,
                                padding: '16px 40px',
                                borderRadius: '16px',
                                border: 'none',
                                fontSize: '16px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '12px',
                                transition: 'all 0.2s',
                                opacity: processing ? 0.7 : 1
                            }}
                        >
                            {processing ? <Loader2 className="animate-spin" size={20} /> : "Confirm Unsubscribe"}
                        </button>
                    </>
                ) : (
                    <>
                        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '16px' }}>Settings Synchronized</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '15px' }}>
                            Your email has been removed from our automated relay system. If this was a mistake, you can re-activate your subscription below.
                        </p>
                        <button
                            onClick={() => handleAction(false)}
                            disabled={processing}
                            style={{
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                fontWeight: 700,
                                padding: '16px 40px',
                                borderRadius: '16px',
                                border: 'none',
                                fontSize: '16px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '12px',
                                transition: 'all 0.2s',
                                opacity: processing ? 0.7 : 1
                            }}
                        >
                            {processing && <Loader2 className="animate-spin" size={20} />}
                            Re-enable Communications
                        </button>
                    </>
                )}
            </div>

            <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'center', gap: '30px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}><ShieldCheck size={14} /> Privacy First</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}><Zap size={14} /> Instant Sync</span>
            </div>

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                button:hover { filter: brightness(1.1); transform: translateY(-1px); }
                button:active { transform: translateY(0); }
            `}</style>
        </ContentLayout>
    );
};

export default Unsubscribe;
