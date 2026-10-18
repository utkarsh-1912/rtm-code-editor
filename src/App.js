import { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import Snippets from "./pages/Snippets";
import Settings from "./pages/Settings";
import ProjectPage from "./pages/ProjectPage";
import WebRenderPage from "./pages/WebRenderPage";
import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";
import OfflineBanner from "./components/OfflineBanner";
import ErrorBoundary from "./components/ErrorBoundary";

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
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/editor/:roomId" element={<Editor />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/features" element={<Features />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/download" element={<Download />} />
            <Route path="/status" element={<Status />} />
            <Route path="/security" element={<Security />} />
            <Route path="/support" element={<Support />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/snippets" element={<Snippets />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/project/:projectId" element={<ProjectPage />} />
            <Route path="/render/:projectId" element={<WebRenderPage />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </BackendProvider>
    </ErrorBoundary>
  );
}

export default App;
