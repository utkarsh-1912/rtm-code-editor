import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { Zap, Code, Globe, Users, Shield, LayoutDashboard, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// Modular Components
import Navbar from "../components/Landing/Navbar";
import JoinForm from "../components/Landing/JoinForm";
import Footer from "../components/Landing/Footer";

function HomePage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem("app-theme") === "light";
  });

  const location = useLocation();

  useEffect(() => {
    if (user?.uid) {
      refreshProfile(user.uid);
    }
  }, [user?.uid, refreshProfile]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const roomParam = searchParams.get("room");
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, [location]);

  useEffect(() => {
    if (user && user.name) {
      setUserName(user.name);
    }
  }, [user]);

  const toggleTheme = () => {
    const newMode = !isLightMode;
    setIsLightMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("light-theme");
      localStorage.setItem("app-theme", "light");
    } else {
      document.documentElement.classList.remove("light-theme");
      localStorage.setItem("app-theme", "dark");
    }
  };

  function createNewRoom(e) {
    if (e) e.preventDefault();
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRoomId(id);
    toast.success("New Room Created !!", { iconTheme: { primary: "var(--primary)" } });
  }

  const joinRoom = () => {
    if (!roomId) {
      toast.error("Room Id is required.");
      return;
    }
    if (!userName) {
      toast.error("Username is required.");
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    const role = searchParams.get("role") || "editor";

    navigate(`/editor/${roomId}`, {
      state: { userName, role },
    });
  };

  const revisitLastRoom = () => {
    if (user?.last_room_id) {
      navigate(`/editor/${user.last_room_id}`, {
        state: { userName: user.name, role: "editor" },
      });
    }
  };

  const handleEnterKey = (e) => {
    if (e.code === "Enter") {
      joinRoom();
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      backgroundColor: "var(--bg-dark)",
      color: "var(--text-main)",
      fontFamily: "'Inter', sans-serif",
      position: "relative",
      overflowX: "hidden"
    }} className="landing-root">

      {/* Theme-Aware CSS Variables Override */}
      <style>{`
        :root {
          --bg-card-transparent: rgba(30, 41, 59, 0.4);
          --border-color-glass: rgba(255, 255, 255, 0.08);
          --border-color-soft: rgba(255, 255, 255, 0.05);
          --bg-input: rgba(15, 23, 42, 0.6);
          --bg-footer: rgba(15, 23, 42, 0.3);
          --orb-opacity: 0.4;
        }
        .light-theme {
          --bg-dark: #fbfdff;
          --bg-card: #ffffff;
          --bg-card-transparent: rgba(255, 255, 255, 0.7);
          --border-color-glass: rgba(0, 0, 0, 0.05);
          --border-color-soft: rgba(0, 0, 0, 0.05);
          --text-main: #1e293b;
          --text-muted: #64748b;
          --bg-input: rgba(241, 245, 249, 0.8);
          --bg-footer: rgba(248, 250, 252, 0.5);
          --orb-opacity: 0.2;
        }
      `}</style>

      {/* Animated Background Mesh */}
      <div className="bg-mesh">
        <div className="mesh-orb orb-1"></div>
        <div className="mesh-orb orb-2"></div>
        <div className="mesh-orb orb-3"></div>
      </div>

      <Navbar
        user={user}
        isLightMode={isLightMode}
        toggleTheme={toggleTheme}
        navigate={navigate}
      />

      {/* Hero Area */}
      <main className="hero-section" style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        padding: "20px 5% 80px", // Reduced padding as requested
        position: "relative",
        zIndex: 1
      }}>
        <div style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          gap: "80px",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center"
        }} className="hero-content-wrapper">

          {/* Left Content */}
          <div style={{ flex: 1, minWidth: "320px", textAlign: "left", maxWidth: "600px" }} className="hero-left">
            {user ? (
              /* Authenticated User View */
              <div className="staggered-entry" style={{ animationDelay: "0.1s" }}>
                <div className="shimmer-badge" style={{
                  display: "inline-flex", alignItems: "center", gap: "10px",
                  backgroundColor: "rgba(59, 130, 246, 0.08)", color: "var(--primary)",
                  padding: "8px 18px", borderRadius: "50px", fontSize: "13px", fontWeight: "700",
                  marginBottom: "32px", textTransform: "uppercase", letterSpacing: "0.08em",
                  border: "1px solid rgba(59, 130, 246, 0.15)", position: "relative", overflow: "hidden"
                }}>
                  <Zap size={14} fill="var(--primary)" /> Personalized Codespace Ready
                </div>

                <h1 style={{ fontSize: "calc(2.5rem + 1.2vw)", fontWeight: "900", lineHeight: "1.1", margin: "0px 0px 16px", letterSpacing: "-0.03em" }}>
                  Welcome back, <br />
                  <span style={{ color: "var(--primary)" }}>{user.name || "Developer"}</span>
                </h1>

                <p style={{ fontSize: "18px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "40px", maxWidth: "500px" }}>
                  Your workspaces and snippets are synced and ready. Pick up right where you left off.
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }} className="hero-buttons">
                  <button
                    onClick={() => navigate("/dashboard")}
                    style={{
                      flex: 1,
                      minWidth: "240px",
                      padding: "16px 32px",
                      background: "linear-gradient(135deg, var(--primary) 0%, #2563eb 100%)",
                      color: "white",
                      borderRadius: "16px",
                      fontWeight: "800",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "12px",
                      boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.5)",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      fontSize: "15px"
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.boxShadow = "0 15px 30px -5px rgba(59, 130, 246, 0.6)";
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 10px 25px -5px rgba(59, 130, 246, 0.5)";
                    }}
                  >
                    <LayoutDashboard size={20} strokeWidth={2.5} /> Open Dashboard
                  </button>
                  <button
                    onClick={createNewRoom}
                    style={{
                      flex: 1,
                      minWidth: "240px",
                      padding: "16px 32px",
                      backgroundColor: "var(--bg-card-transparent)",
                      color: "var(--text-main)",
                      borderRadius: "16px",
                      fontWeight: "800",
                      border: "1px solid var(--border-color-glass)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "12px",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      fontSize: "15px",
                      backdropFilter: "blur(10px)"
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.borderColor = "var(--primary)";
                      e.currentTarget.style.backgroundColor = "var(--bg-card)";
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.borderColor = "var(--border-color-glass)";
                      e.currentTarget.style.backgroundColor = "var(--bg-card-transparent)";
                    }}
                  >
                    <Code size={20} strokeWidth={2.5} /> New Workspace
                  </button>
                </div>

                {user.last_room_id && (
                  <div className="staggered-entry" style={{ animationDelay: "0.5s", width: "100%", marginBottom: "48px" }}>
                    <div style={{
                      padding: "24px",
                      backgroundColor: "rgba(168, 85, 247, 0.04)",
                      borderRadius: "20px",
                      border: "1px solid rgba(168, 85, 247, 0.15)",
                      display: "block",
                      width: "100%",
                      boxShadow: "0 10px 30px -10px rgba(168, 85, 247, 0.2)",
                      position: "relative",
                      overflow: "hidden"
                    }}>
                      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "2px", background: "linear-gradient(90deg, transparent, #a855f7, transparent)" }}></div>
                      <div style={{ fontSize: "11px", color: "#a855f7", fontWeight: "800", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Continue Session</div>
                      <button
                        onClick={revisitLastRoom}
                        style={{
                          display: "flex", alignItems: "center", gap: "12px", background: "none", border: "none",
                          color: "var(--text-main)", fontWeight: "700", cursor: "pointer", padding: 0,
                          fontSize: "16px", transition: "all 0.2s", width: "100%", justifyContent: "flex-start"
                        }}
                        onMouseOver={e => e.currentTarget.style.color = "#a855f7"}
                        onMouseOut={e => e.currentTarget.style.color = "var(--text-main)"}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ backgroundColor: "rgba(168, 85, 247, 0.1)", padding: "8px", borderRadius: "10px" }}>
                            <Globe size={18} color="#a855f7" />
                          </div>
                          <span>Revisit Room: <span style={{ opacity: 0.6 }}>{user.last_room_id}</span></span>
                        </div>
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Guest/Landing View */
              <>
                <div className="staggered-entry" style={{ animationDelay: "0.1s" }}>
                  <div className="shimmer-badge" style={{
                    display: "inline-flex", alignItems: "center", gap: "10px",
                    backgroundColor: "rgba(59, 130, 246, 0.08)", color: "var(--primary)",
                    padding: "8px 18px", borderRadius: "50px", fontSize: "13px", fontWeight: "700",
                    marginBottom: "32px", textTransform: "uppercase", letterSpacing: "0.08em",
                    border: "1px solid rgba(59, 130, 246, 0.15)", position: "relative", overflow: "hidden"
                  }}>
                    <Zap size={14} fill="var(--primary)" /> Powering High-Performance Teams
                  </div>
                </div>

                <h1 style={{ fontSize: "calc(2.5rem + 1vw)", fontWeight: "800", lineHeight: "1.1", margin: "0px 0px 24px", letterSpacing: "-0.02em" }} className="staggered-entry">
                  Collaborate. Code. <br />
                  <span style={{ color: "var(--primary)", position: "relative" }}>
                    Conquer.
                    <svg viewBox="0 0 100 12" preserveAspectRatio="none" style={{ position: "absolute", bottom: "-8px", left: "0px", width: "100%", height: "12px" }}>
                      <path d="M0,10 Q50,0 100,10" stroke="var(--primary)" strokeWidth="4" fill="none" opacity="0.3"></path>
                    </svg>
                  </span>
                </h1>

                <p className="staggered-entry" style={{ animationDelay: "0.3s", fontSize: "18px", color: "var(--text-muted)", lineHeight: 1.7, maxWidth: "580px", marginBottom: "48px" }}>
                  Real-time synchronization, lightning-fast execution, and seamless chat—all in one place. Experience the next generation of collaborative coding.
                </p>

                <div className="features-grid staggered-entry" style={{ animationDelay: "0.4s", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
                  {[
                    { icon: <Code size={22} />, title: "Precision Sync", desc: "Conflict-free real-time edits." },
                    { icon: <Globe size={22} />, title: "Cloud Engine", desc: "Instant multi-lang execution." },
                    { icon: <Users size={22} />, title: "Team Protocol", desc: "Integrated context-aware chat." },
                    { icon: <Shield size={22} />, title: "Secure Vault", desc: "Ephemeral, encrypted rooms." }
                  ].map((f, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "16px", alignItems: "start" }}>
                      <div style={{
                        color: "var(--primary)", marginTop: "4px", backgroundColor: "rgba(59, 130, 246, 0.08)",
                        padding: "10px", borderRadius: "12px", border: "1px solid rgba(59, 130, 246, 0.1)"
                      }}>{f.icon}</div>
                      <div>
                        <div style={{ fontWeight: "800", fontSize: "15px", marginBottom: "4px" }}>{f.title}</div>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.4 }}>{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right Form Card */}
          <div style={{ flex: "0 0 460px", minWidth: "320px", marginTop: "20px" }} className="hero-right staggered-entry">
            <JoinForm
              roomId={roomId}
              setRoomId={setRoomId}
              userName={userName}
              setUserName={setUserName}
              handleEnterKey={handleEnterKey}
              joinRoom={joinRoom}
              createNewRoom={createNewRoom}
            />
          </div>

        </div>
      </main>

      <Footer isLightMode={isLightMode} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        .bg-mesh {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 0;
          pointer-events: none;
        }

        .mesh-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: var(--orb-opacity);
          animation: float 20s infinite alternate;
        }

        .orb-1 { width: 50vw; height: 50vw; background: radial-gradient(circle, rgba(59, 130, 246, 0.15), transparent); top: -10%; left: -10%; animation-duration: 25s; }
        .orb-2 { width: 40vw; height: 40vw; background: radial-gradient(circle, rgba(139, 92, 246, 0.12), transparent); bottom: -5%; right: -5%; animation-duration: 30s; }
        .orb-3 { width: 30vw; height: 30vw; background: radial-gradient(circle, rgba(96, 165, 250, 0.1), transparent); top: 30%; left: 40%; animation-duration: 40s; }

        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(5%, 5%) scale(1.1); }
          100% { transform: translate(-5%, 2%) scale(1); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .staggered-entry {
          opacity: 0;
          animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .shimmer-badge::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.1), transparent);
          transform: rotate(30deg);
          animation: shimmer 4s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-150%) rotate(30deg); }
          100% { transform: translateX(150%) rotate(30deg); }
        }

        .premium-input:focus {
          border-color: var(--primary) !important;
          background-color: var(--bg-card) !important;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15) !important;
        }

        .launch-btn:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 20px 40px -10px rgba(59, 130, 246, 0.5);
        }

        .footer-link:hover { color: var(--primary) !important; }

        @media (max-width: 968px) {
          .hero-content-wrapper { flex-direction: column !important; gap: 48px !important; }
          .hero-left { order: 2; text-align: center !important; flex: none !important; }
          .hero-right { order: 1; flex: none !important; width: 100% !important; max-width: 480px !important; }
          .hero-left p { margin: 0 auto 48px !important; }
          .features-grid { grid-template-columns: 1fr !important; text-align: left; max-width: 340px !important; margin: 0 auto !important; }
          .footer-right { gap: 20px !important; }
          .landing-footer { flex-direction: column; gap: 24px; text-align: center; }
          .hero-buttons { flex-direction: column !important; align-items: stretch !important; width: 100% !important; max-width: 400px; margin: 0 auto; }
          .hero-buttons button { width: 100% !important; justify-content: center !important; }
        }
      `}</style>
    </div>
  );
}

export default HomePage;
