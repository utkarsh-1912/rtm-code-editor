import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { XCircle, Mail, ArrowLeft, Loader2 } from 'lucide-react';
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
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        );
    }

    if (!email) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100">
                    <XCircle className="mx-auto text-red-500 mb-6" size={64} />
                    <h1 className="text-2xl font-bold text-slate-900 mb-4">Invalid Link</h1>
                    <p className="text-slate-500 mb-8">This unsubscribe link is missing required information. Please check the email we sent you.</p>
                    <Link to="/" className="inline-flex items-center gap-2 text-primary font-semibold hover:underline">
                        <ArrowLeft size={18} /> Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9] p-4 font-sans">
            <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden max-w-xl w-full border border-slate-200">
                {/* Header */}
                <div className="bg-[#0f172a] p-10 text-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent"></div>
                    <img 
                        src="https://utkristi-colabs.onrender.com/utkristi-colabs.png" 
                        alt="Utkristi Colabs" 
                        className="h-8 mx-auto mb-8 relative z-10"
                    />
                    <h1 className="text-3xl font-extrabold text-white tracking-tight relative z-10">Email Preferences</h1>
                </div>

                {/* Content */}
                <div className="p-12 text-center">
                    <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-8 ${isUnsubscribed ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'}`}>
                        <Mail size={36} />
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 mb-4">
                        {isUnsubscribed ? "You're Unsubscribed" : "Manage Notifications"}
                    </h2>
                    
                    <p className="text-slate-600 mb-10 leading-relaxed text-lg">
                        {isUnsubscribed 
                            ? `We've updated your preferences. You will no longer receive project invitations or system notifications at ${email}.`
                            : `Are you sure you want to stop receiving project invitations and system updates at ${email}?`
                        }
                    </p>

                    <div className="flex flex-col gap-4">
                        {!isUnsubscribed ? (
                            <button
                                onClick={() => handleAction(true)}
                                disabled={processing}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-5 rounded-2xl transition-all shadow-lg shadow-blue-200 text-lg flex items-center justify-center gap-3"
                            >
                                {processing && <Loader2 className="animate-spin" size={20} />}
                                Confirm Unsubscribe
                            </button>
                        ) : (
                            <button
                                onClick={() => handleAction(false)}
                                disabled={processing}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-5 rounded-2xl transition-all text-lg flex items-center justify-center gap-3"
                            >
                                {processing && <Loader2 className="animate-spin" size={20} />}
                                Oops, Resubscribe Me
                            </button>
                        )}
                        
                        <Link to="/" className="text-slate-400 font-medium hover:text-slate-600 mt-4 transition-colors">
                            Return to Homepage
                        </Link>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-8 text-center border-top border-slate-100">
                    <p className="text-slate-400 text-sm">
                        &copy; 2026 Utkristi Colabs. Enterprise Intelligence Systems.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Unsubscribe;
