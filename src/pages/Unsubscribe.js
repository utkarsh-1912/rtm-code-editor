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
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="animate-spin text-blue-600" size={24} />
                    </div>
                </div>
                <p className="mt-6 text-slate-500 font-medium animate-pulse">Syncing preferences...</p>
            </div>
        );
    }

    if (!email) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 font-sans">
                <div className="bg-white p-12 rounded-[48px] shadow-2xl shadow-slate-200 max-w-lg w-full text-center border border-slate-100">
                    <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8">
                        <XCircle className="text-red-500" size={48} />
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">Access Restricted</h1>
                    <p className="text-slate-500 mb-10 text-lg leading-relaxed">
                        This subscription management link is missing required parameters or has expired. Please use the link provided in your latest RTM Studio email.
                    </p>
                    <Link to="/" className="inline-flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                        <ArrowLeft size={20} /> Return to Hub
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-sans selection:bg-blue-100 selection:text-blue-900">
            <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden bg-white rounded-[56px] shadow-2xl shadow-slate-200 border border-slate-100">
                
                {/* Visual Side */}
                <div className="hidden lg:flex flex-col justify-between p-16 bg-slate-900 text-white relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-[120px] -mr-48 -mt-48"></div>
                        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500 rounded-full blur-[120px] -ml-48 -mb-48"></div>
                    </div>

                    <div className="relative z-10">
                        <img 
                            src="https://utkristi-colabs.onrender.com/utkristi-colabs.png" 
                            alt="RTM Studio" 
                            className="h-7 mb-16 invert brightness-200"
                        />
                        <h2 className="text-4xl font-extrabold mb-8 leading-tight tracking-tight">Stay Connected <br/>to the Studio.</h2>
                        
                        <div className="space-y-8">
                            <div className="flex gap-5 items-start">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-md">
                                    <Zap size={22} className="text-blue-400" />
                                </div>
                                <div>
                                    <p className="font-bold text-lg mb-1">Project Updates</p>
                                    <p className="text-slate-400 text-sm leading-relaxed">Real-time sync alerts when your team pushes new features.</p>
                                </div>
                            </div>
                            <div className="flex gap-5 items-start">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-md">
                                    <ShieldCheck size={22} className="text-blue-400" />
                                </div>
                                <div>
                                    <p className="font-bold text-lg mb-1">Security Centers</p>
                                    <p className="text-slate-400 text-sm leading-relaxed">Immediate notifications regarding workspace access and audits.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 pt-16 flex items-center gap-4 text-slate-500 text-sm font-medium">
                        <Lock size={16} /> Secure Enterprise Relay
                    </div>
                </div>

                {/* Form Side */}
                <div className="p-12 lg:p-20 flex flex-col justify-center">
                    <div className="mb-12">
                        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-10 transition-colors duration-500 ${isUnsubscribed ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-600'}`}>
                            {isUnsubscribed ? <BellOff size={40} /> : <Mail size={40} />}
                        </div>
                        <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tighter">
                            {isUnsubscribed ? "Preferences Set" : "Management Hub"}
                        </h1>
                        <p className="text-slate-500 text-lg leading-relaxed">
                            {isUnsubscribed 
                                ? "We've successfully updated our systems. You will no longer receive communications at:"
                                : "Adjust how you receive project invites and system updates for:"
                            }
                        </p>
                        <div className="mt-4 px-4 py-3 bg-slate-50 rounded-xl inline-block border border-slate-100 font-mono text-slate-700 text-sm font-semibold">
                            {email}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {!isUnsubscribed ? (
                            <button
                                onClick={() => handleAction(true)}
                                disabled={processing}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-6 rounded-[24px] transition-all shadow-xl shadow-blue-100 text-lg flex items-center justify-center gap-4 group"
                            >
                                {processing ? <Loader2 className="animate-spin" size={24} /> : "Confirm Unsubscribe"}
                                {!processing && <ArrowLeft className="rotate-180 group-hover:translate-x-1 transition-transform" size={20} />}
                            </button>
                        ) : (
                            <div className="space-y-8">
                                <div className="flex items-center gap-3 text-emerald-600 font-bold bg-emerald-50 px-6 py-4 rounded-2xl border border-emerald-100">
                                    <CheckCircle2 size={22} /> System Updated Successfully
                                </div>
                                <button
                                    onClick={() => handleAction(false)}
                                    disabled={processing}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-6 rounded-[24px] transition-all text-lg flex items-center justify-center gap-3"
                                >
                                    {processing && <Loader2 className="animate-spin" size={24} />}
                                    Resubscribe to Updates
                                </button>
                            </div>
                        )}
                        
                        <div className="pt-8 text-center">
                            <Link to="/" className="text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                                <ArrowLeft size={14} /> Back to Dashboard
                            </Link>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-20 pt-10 border-t border-slate-50 text-center lg:text-left">
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">
                            &copy; 2026 Utkristi Colabs &middot; Enterprise Systems
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Unsubscribe;
