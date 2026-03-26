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
    Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

const Unsubscribe = () => {
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email');
    const [loading, setLoading] = useState(true);
    const [isUnsubscribed, setIsUnsubscribed] = useState(false);
    const [processing, setProcessing] = useState(false);

    const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;

    useEffect(() => {
        if (!email) {
            setLoading(false);
            return;
        }

        const checkStatus = async () => {
            try {
                const res = await fetch(`${backendUrl}/api/user-subscription?email=${encodeURIComponent(email)}`);
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
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                <div style={{ position: 'relative' }}>
                    <div style={{ width: '80px', height: '80px', border: '4px solid #f1f5f9', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 className="animate-spin" style={{ color: '#2563eb' }} size={24} />
                    </div>
                </div>
                <p style={{ marginTop: '24px', color: '#64748b', fontWeight: 600 }}>Syncing preferences...</p>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!email) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '24px', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ backgroundColor: '#ffffff', padding: '48px', borderRadius: '40px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.05)', maxWidth: '500px', width: '100%', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                    <div style={{ width: '96px', height: '96px', backgroundColor: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' }}>
                        <XCircle style={{ color: '#ef4444' }} size={48} />
                    </div>
                    <h1 style={{ fontSize: '30px', fontWeight: 800, color: '#0f172a', marginBottom: '16px', letterSpacing: '-0.02em' }}>Access Restricted</h1>
                    <p style={{ color: '#64748b', marginBottom: '40px', fontSize: '17px', lineHeight: 1.6 }}>
                        This subscription management link is missing required parameters or has expired. Please use the link provided in your latest RTM Studio email.
                    </p>
                    <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', backgroundColor: '#0f172a', color: '#ffffff', padding: '16px 32px', borderRadius: '16px', fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s' }}>
                        <ArrowLeft size={20} /> Return to Hub
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="unsubscribe-container" style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Inter, sans-serif' }}>
            <div className="unsubscribe-card" style={{ maxWidth: '1000px', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', overflow: 'hidden', backgroundColor: '#ffffff', borderRadius: '56px', boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.08)', border: '1px solid #f1f5f9' }}>
                
                {/* Visual Side */}
                <div className="visual-side" style={{ padding: '64px', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                    {/* Background Glows */}
                    <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)', borderRadius: '50%' }}></div>
                    <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(79, 70, 229, 0.2) 0%, transparent 70%)', borderRadius: '50%' }}></div>

                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <img 
                            src="https://utkristi-colabs.onrender.com/utkristi-colabs.png" 
                            alt="RTM Studio" 
                            style={{ height: '28px', marginBottom: '64px', filter: 'invert(1) brightness(2)' }}
                        />
                        <h2 style={{ fontSize: '42px', fontWeight: 800, marginBottom: '32px', lineHeight: 1.1, letterSpacing: '-0.04em' }}>Stay Connected <br/>to the Studio.</h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'start' }}>
                                <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Zap size={22} style={{ color: '#60a5fa' }} />
                                </div>
                                <div>
                                    <p style={{ fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>Project Updates</p>
                                    <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>Real-time sync alerts when your team pushes new features.</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'start' }}>
                                <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <ShieldCheck size={22} style={{ color: '#60a5fa' }} />
                                </div>
                                <div>
                                    <p style={{ fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>Security Centers</p>
                                    <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>Immediate notifications regarding workspace access and audits.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ position: 'relative', zIndex: 1, paddingTop: '64px', display: 'flex', alignItems: 'center', gap: '16px', color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
                        <Lock size={16} /> Secure Enterprise Relay
                    </div>
                </div>

                {/* Content Side */}
                <div className="content-side" style={{ padding: '64px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ marginBottom: '48px' }}>
                        <div style={{ 
                            width: '80px', 
                            height: '80px', 
                            borderRadius: '24px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            marginBottom: '40px', 
                            backgroundColor: isUnsubscribed ? '#fffbeb' : '#eff6ff', 
                            color: isUnsubscribed ? '#f59e0b' : '#3b82f6',
                            transition: 'background-color 0.5s ease'
                        }}>
                            {isUnsubscribed ? <BellOff size={40} /> : <Mail size={40} />}
                        </div>
                        <h1 style={{ fontSize: '36px', fontWeight: 800, color: '#0f172a', marginBottom: '16px', letterSpacing: '-0.04em' }}>
                            {isUnsubscribed ? "Preferences Set" : "Management Hub"}
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '18px', lineHeight: 1.6 }}>
                            {isUnsubscribed 
                                ? "We've successfully updated our systems. You will no longer receive communications at:"
                                : "Adjust how you receive project invites and system updates for:"
                            }
                        </p>
                        <div style={{ marginTop: '24px', padding: '12px 20px', backgroundColor: '#f8fafc', borderRadius: '12px', display: 'inline-block', border: '1px solid #f1f5f9', fontFamily: 'monospace', color: '#334155', fontWeight: 600 }}>
                            {email}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {!isUnsubscribed ? (
                            <button
                                onClick={() => handleAction(true)}
                                disabled={processing}
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
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    gap: '16px',
                                    boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.2)',
                                    opacity: processing ? 0.7 : 1,
                                    transition: 'transform 0.2s ease, background-color 0.2s ease'
                                }}
                            >
                                {processing ? <Loader2 className="animate-spin" size={24} /> : "Confirm Unsubscribe"}
                                {!processing && <ArrowLeft style={{ transform: 'rotate(180deg)' }} size={20} />}
                            </button>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#059669', fontWeight: 700, backgroundColor: '#ecfdf5', padding: '16px 24px', borderRadius: '16px', border: '1px solid #d1fae5' }}>
                                    <CheckCircle2 size={22} /> System Updated Successfully
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
                                        opacity: processing ? 0.7 : 1
                                    }}
                                >
                                    {processing && <Loader2 className="animate-spin" size={24} />}
                                    Resubscribe to Updates
                                </button>
                            </div>
                        )}
                        
                        <div style={{ textAlign: 'center', marginTop: '32px' }}>
                            <Link to="/" style={{ color: '#94a3b8', fontWeight: 700, textDecoration: 'none', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                                <ArrowLeft size={14} /> Back to Dashboard
                            </Link>
                        </div>
                    </div>

                    <div style={{ marginTop: '80px', paddingTop: '40px', borderTop: '1px solid #f8fafc', textAlign: 'center' }}>
                        <p style={{ color: '#cbd5e1', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            &copy; 2026 Utkristi Colabs &middot; Enterprise Systems
                        </p>
                    </div>
                </div>
            </div>
            
            <style>{`
                @media (max-width: 640px) {
                    .unsubscribe-card { border-radius: 0 !important; border: none !important; }
                    .visual-side { display: none !important; }
                    .content-side { padding: 40px 24px !important; }
                    h1 { font-size: 28px !important; }
                }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default Unsubscribe;
