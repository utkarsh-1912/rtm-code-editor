import { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import HomePage from "./pages/main";
import Editor from "./pages/editor";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Download from "./pages/Download";
import Status from "./pages/Status";
import Security from "./pages/Security";
import Support from "./pages/Support";
import { Toaster } from "react-hot-toast";
import { applyTheme, getThemePref } from "./utils/theme";

import { AuthProvider } from "./context/AuthContext";
import { BackendProvider } from "./context/BackendContext";
import ServerWake from "./components/ux/ServerWake";
import OfflineNotice from "./components/ux/OfflineNotice";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import Snippets from "./pages/Snippets";
import MeetPage from "./pages/MeetPage";
import OfflinePage from "./pages/OfflinePage";
import Docs from "./pages/Docs";
import Settings from "./pages/Settings";
import ProjectPage from "./pages/ProjectPage";
import WebRenderPage from "./pages/WebRenderPage";
import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";
import OfflineBanner from "./components/OfflineBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import DesktopStart from "./pages/DesktopStart";
import { IS_DESKTOP, desktop, openOnWebsite } from "./utils/desktop";

if (IS_DESKTOP) document.documentElement.classList.add("is-desktop");

// Desktop app: website pages open in the browser instead of inside the app.
function OnWebsite() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    openOnWebsite(pathname + search);
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }, [pathname, search, navigate]);
  return null;
}

// Desktop app: native menu items (Go > Workspace, File > Open Folder…) navigate in place.
// A crash inside one page shows the error there; going to another page clears it.
function PageBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname} compact>{children}</ErrorBoundary>;
}

function DesktopBridge() {
  const navigate = useNavigate();
  useEffect(() => desktop()?.onNavigate?.((to) => {
    if (typeof to === "string" && to.startsWith("/")) navigate(to);
  }), [navigate]);
  return null;
}

const page = (el) => (IS_DESKTOP ? <OnWebsite /> : el);

function App() {
  useEffect(() => {
    // Global Wake-up: Ping the backend to start spin-up on Render
    applyTheme();
    // Follow the OS while the preference is "system"
    const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
    const onChange = () => getThemePref() === "system" && applyTheme("system");
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, []);

  return (
    <ErrorBoundary>
      <BackendProvider>
      <AuthProvider>
        <OfflineBanner />
        <ServerWake />
        <OfflineNotice />
        <div>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { borderRadius: 14, fontFamily: "Archivo, Inter, sans-serif", fontSize: 14, background: "#151513", color: "#E8E6DF", border: "1px solid rgba(232,230,223,.12)" },
              success: { iconTheme: { primary: "#4ADE80", secondary: "#151513" } },
              error: { iconTheme: { primary: "#F87171", secondary: "#151513" } },
            }}
          ></Toaster>
        </div>
        <BrowserRouter>
          {IS_DESKTOP && <DesktopBridge />}
          <PageBoundary>
          <Routes>
            <Route path="/" element={IS_DESKTOP ? <DesktopStart /> : <HomePage />} />
            <Route path="/editor/:roomId" element={<Editor />} />
            <Route path="/about" element={page(<About />)} />
            <Route path="/privacy" element={page(<Privacy />)} />
            <Route path="/terms" element={page(<Terms />)} />
            <Route path="/features" element={page(<Features />)} />
            <Route path="/pricing" element={page(<Pricing />)} />
            <Route path="/download" element={page(<Download />)} />
            <Route path="/status" element={page(<Status />)} />
            <Route path="/security" element={page(<Security />)} />
            <Route path="/support" element={page(<Support />)} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/snippets" element={<Snippets />} />
            <Route path="/meet/:meetingId" element={<MeetPage />} />
            <Route path="/offline" element={<OfflinePage />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/project/:projectId" element={<ProjectPage />} />
            <Route path="/render/:projectId" element={<WebRenderPage />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </PageBoundary>
        </BrowserRouter>
      </AuthProvider>
      </BackendProvider>
    </ErrorBoundary>
  );
}

export default App;
