import React, { useEffect } from "react";
import Logo from "../Logo";
import { Link, useNavigate } from "react-router-dom";
import { Github, Mail, ArrowLeft, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { ThemeButton } from "../ux/Shell";
import { useClock, localCity } from "../ux/primitives";
import "../../styles/site.css";
import "../../styles/app.css";

const POINTS = [
    "Real-time sync with live cursors",
    "Voice, video and whiteboard in every room",
    "Private rooms, shared only by link",
];

// Shared sign-in / sign-up screen; the two routes only differ in copy.
export default function AuthPage({ mode }) {
    const { loginWithGoogle, loginWithGitHub, user, loading } = useAuth();
    const navigate = useNavigate();
    const now = useClock();
    const isSignup = mode === "signup";

    useEffect(() => {
        if (user) navigate("/dashboard");
    }, [user, navigate]);

    const handleLogin = async (provider) => {
        try {
            if (provider === "google") await loginWithGoogle();
            if (provider === "github") await loginWithGitHub();
            toast.success(isSignup ? "Welcome aboard!" : "Welcome back!");
        } catch (error) {
            toast.error(`Authentication failed: ${error.message}`);
        }
    };

    const title = isSignup ? ["Build", "together."] : ["Welcome", "back."];

    return (
        <div className="ux au-shell">
            <div className="u-grain" aria-hidden="true" />

            <aside className="u-pane au-aside">
                <div className="au-aside-top">
                    <Link to="/" aria-label="Home"><Logo size={30} /></Link>
                    <span className="u-label">{localCity()} {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                </div>
                <div>
                    <span className="u-label">{isSignup ? "Get started" : "Sign in"}</span>
                    <h1 className="u-display u-giant u-lines is-in au-title">
                        {title.map((t, i) => <span key={t}><span style={{ "--d": `${80 + i * 100}ms` }}>{t}</span></span>)}
                    </h1>
                    <ol className="l-list">
                        {POINTS.map((p, i) => <li key={p}><i>{String(i + 1).padStart(2, "0")}</i>{p}</li>)}
                    </ol>
                </div>
                <span className="u-label">&copy; {now.getFullYear()} Utkristi CoLabs</span>
            </aside>

            <main className="au-main">
                <div className="au-top">
                    <Link to="/" className="u-btn u-btn--sm"><ArrowLeft size={14} /> Back</Link>
                    <ThemeButton />
                </div>

                <div className="au-card u-enter">
                    <span className="u-label">{isSignup ? "01 — Create account" : "01 — Sign in"}</span>
                    <h2>{isSignup ? "Create your account" : "Sign in to your workspace"}</h2>
                    <p className="u-muted">{isSignup ? "Free to start. No credit card." : "Your projects, snippets and teams are waiting."}</p>

                    <div className="au-providers">
                        <button className="u-btn u-btn--ghost u-btn--lg u-btn--block" onClick={() => handleLogin("google")} disabled={loading}><Mail size={17} /> Continue with Google</button>
                        <button className="u-btn u-btn--ghost u-btn--lg u-btn--block" onClick={() => handleLogin("github")} disabled={loading}><Github size={17} /> Continue with GitHub</button>
                    </div>

                    <div className="au-or"><span>or</span></div>

                    <button className="u-btn u-btn--solid u-btn--lg u-btn--block" onClick={() => navigate("/")}>
                        Continue as guest <ArrowRight size={16} />
                    </button>

                    <p className="u-muted u-small" style={{ textAlign: "center", margin: "22px 0 0" }}>
                        {isSignup ? "Already have an account? " : "New here? "}
                        <Link to={isSignup ? "/login" : "/signup"} className="u-ul" style={{ color: "var(--u-ink)" }}>
                            {isSignup ? "Sign in" : "Create an account"}
                        </Link>
                    </p>
                </div>

                <p className="u-label au-legal">By continuing you agree to the <Link to="/terms" className="u-ul">terms</Link> and <Link to="/privacy" className="u-ul">privacy policy</Link>.</p>
            </main>
        </div>
    );
}
