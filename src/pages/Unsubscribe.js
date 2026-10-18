import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { XCircle, Mail, Loader2, ShieldCheck, Bell, BellOff } from 'lucide-react';
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
            <ContentLayout title="Email preferences" label="Account">
                <div className="u-skel" style={{ height: 180 }} />
                <p className="u-label" style={{ marginTop: 14 }}><Loader2 size={12} className="u-spin" /> Checking your preferences…</p>
            </ContentLayout>
        );
    }

    if (!email) {
        return (
            <ContentLayout title="Link incomplete" label="Account">
                <div className="u-card g-danger" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                    <XCircle size={28} style={{ color: "var(--u-bad)" }} />
                    <p style={{ margin: 0 }}>This link is missing the email it should manage. Open the preferences link from your latest Utkristi CoLabs email instead.</p>
                    <Link to="/" className="u-btn u-btn--ghost" style={{ alignSelf: "flex-start" }}>Back home</Link>
                </div>
            </ContentLayout>
        );
    }

    return (
        <ContentLayout title={isUnsubscribed ? "You're unsubscribed" : "Email preferences"} label="Account">
            <p>{isUnsubscribed ? "You will no longer receive invites and updates at:" : "Choose whether we send project invites and product updates to:"}</p>
            <p><span className="u-chip u-chip--mono" style={{ fontSize: 12.5, height: 30 }}><Mail size={13} /> {email}</span></p>

            <div className={isUnsubscribed ? "u-card" : "u-pane"} style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16, marginTop: 28 }}>
                <span className="u-label">{isUnsubscribed ? "Paused" : "Subscribed"}</span>
                <h3 style={{ margin: 0, fontSize: 26, fontWeight: 500, letterSpacing: "-0.025em" }}>
                    {isUnsubscribed ? "Emails are off." : "Stop these emails?"}
                </h3>
                <p className="u-muted" style={{ margin: 0 }}>
                    {isUnsubscribed
                        ? "Changed your mind? Turn them back on and you will get invites and updates again."
                        : "You will stop receiving automated invitations and product updates. You can come back here anytime to turn them on."}
                </p>
                <button
                    className={`u-btn u-btn--lg ${isUnsubscribed ? "u-btn--solid" : "u-btn--danger"}`}
                    style={{ alignSelf: "flex-start" }}
                    onClick={() => handleAction(!isUnsubscribed)}
                    disabled={processing}
                >
                    {processing ? <Loader2 size={16} className="u-spin" /> : isUnsubscribed ? <Bell size={16} /> : <BellOff size={16} />}
                    {isUnsubscribed ? "Turn emails back on" : "Unsubscribe"}
                </button>
            </div>

            <p className="u-label" style={{ marginTop: 24 }}><ShieldCheck size={12} /> We only use this address for account email</p>
        </ContentLayout>
    );
};

export default Unsubscribe;
