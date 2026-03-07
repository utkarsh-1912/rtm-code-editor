import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { Sun, Moon, Zap, ChevronRight, LayoutDashboard, Code, Globe, Users, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";

function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem("app-theme") === "light";
  });

  const location = useLocation();

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
    e.preventDefault();
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
    }}>

      {/* Animated Background Mesh */}
      <div className="bg-mesh">
        <div className="mesh-orb orb-1"></div>
        <div className="mesh-orb orb-2"></div>
        <div className="mesh-orb orb-3"></div>
      </div>

      {/* Header */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "32px 5%",
        position: "relative",
        zIndex: 10
      }}>
        <div style={{ cursor: "pointer", transition: "transform 0.2s" }} onClick={() => navigate("/")} onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"} onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}>
          <img src="/utkristi-colabs.png" alt="Logo" style={{ width: "100px", height: "40px" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {user ? (
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "12px 24px",
                backgroundColor: "rgba(59, 130, 246, 0.12)", border: "1px solid rgba(59, 130, 246, 0.25)",
                borderRadius: "14px", color: "var(--primary)", fontSize: "14px", fontWeight: "700", cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", backdropFilter: "blur(8px)"
              }}
              className="premium-btn"
            >
              <LayoutDashboard size={18} /> Dashboard
            </button>
          ) : (
            <button
              onClick={() => navigate("/signup")}
              style={{
                padding: "12px 28px", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)",
                borderRadius: "14px", color: "var(--text-main)", fontSize: "14px", fontWeight: "600", cursor: "pointer",
                transition: "all 0.3s ease"
              }}
              onMouseOver={(e) => { e.target.style.borderColor = "var(--primary)"; e.target.style.transform = "translateY(-1px)"; }}
              onMouseOut={(e) => { e.target.style.borderColor = "var(--border-color)"; e.target.style.transform = "translateY(0)"; }}
            >
              Sign In
            </button>
          )}
          <button
            onClick={toggleTheme}
            style={{
              width: "48px", height: "48px", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)",
              borderRadius: "14px", cursor: "pointer", color: isLightMode ? "#fbbf24" : "var(--text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s ease"
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
            onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--border-color)"}
          >
            {isLightMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Hero Area */}
      <main className="hero-section" style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        padding: "40px 5% 120px",
        position: "relative",
        zIndex: 1
      }}>
        <div style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          gap: "80px",
          alignItems: "center",
          flexWrap: "wrap"
        }} className="hero-content-wrapper">

          {/* Left Content */}
          <div style={{ flex: 1, minWidth: "320px", textAlign: "left" }} className="hero-left">
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

            <h1 className="staggered-entry" style={{ animationDelay: "0.2s", fontSize: "calc(2.8rem + 1.8vw)", fontWeight: "950", marginBottom: "28px", letterSpacing: "-0.05em", lineHeight: 1.05 }}>
              The future of <br />
              <span style={{
                background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #8b5cf6 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                position: "relative"
              }}>
                collaborative code.
              </span>
            </h1>

            <p className="staggered-entry" style={{ animationDelay: "0.3s", fontSize: "21px", color: "var(--text-muted)", lineHeight: 1.6, maxWidth: "580px", marginBottom: "48px", fontWeight: "450" }}>
              Utkristi Colabs provides a sub-millisecond sync workspace for modern engineering teams. Ship faster, together.
            </p>

            <div className="features-grid staggered-entry" style={{ animationDelay: "0.4s", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", maxWidth: "520px" }}>
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
          </div>

          {/* Right Form Card */}
          <div style={{ flex: "0 0 480px", minWidth: "320px" }} className="hero-right staggered-entry">
            <div className="glass-card" style={{
              backgroundColor: "rgba(30, 41, 59, 0.4)",
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              padding: "48px",
              borderRadius: "32px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              animation: "slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              position: "relative",
              overflow: "hidden"
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "4px", background: "linear-gradient(to right, transparent, var(--primary), transparent)", opacity: 0.5 }}></div>

              <h2 style={{ fontSize: "28px", fontWeight: "900", marginBottom: "40px", textAlign: "left", letterSpacing: "-0.02em" }}>Launch Workspace</h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                <div style={{ textAlign: "left" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary)", marginBottom: "10px", display: "block", textTransform: "uppercase", letterSpacing: "0.1em" }}>Global Room ID</label>
                  <input
                    type="text"
                    placeholder="Enter unique identifier..."
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    onKeyUp={handleEnterKey}
                    style={{
                      width: "100%", padding: "18px", borderRadius: "16px", border: "1px solid rgba(255, 255, 255, 0.1)",
                      backgroundColor: "rgba(15, 23, 42, 0.6)", color: "white", fontSize: "16px", outline: "none",
                      transition: "all 0.3s ease", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)"
                    }}
                    className="premium-input"
                  />
                </div>

                <div style={{ textAlign: "left" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary)", marginBottom: "10px", display: "block", textTransform: "uppercase", letterSpacing: "0.1em" }}>Operator Name</label>
                  <input
                    type="text"
                    placeholder="Identify yourself..."
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyUp={handleEnterKey}
                    style={{
                      width: "100%", padding: "18px", borderRadius: "16px", border: "1px solid rgba(255, 255, 255, 0.1)",
                      backgroundColor: "rgba(15, 23, 42, 0.6)", color: "white", fontSize: "16px", outline: "none",
                      transition: "all 0.3s ease", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)"
                    }}
                    className="premium-input"
                  />
                </div>

                <button
                  onClick={joinRoom}
                  style={{
                    width: "100%", padding: "20px", backgroundColor: "var(--primary)", color: "white",
                    fontSize: "17px", fontWeight: "900", borderRadius: "18px", border: "none", cursor: "pointer",
                    transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                    boxShadow: "0 15px 30px -5px rgba(59, 130, 246, 0.4)"
                  }}
                  className="launch-btn"
                >
                  Initialize System <ChevronRight size={22} strokeWidth={3} />
                </button>

                <div style={{ marginTop: "12px", fontSize: "14px", color: "var(--text-muted)", textAlign: "center" }}>
                  First time here? <span onClick={createNewRoom} style={{ color: "var(--primary)", fontWeight: "800", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "4px" }}>Generate Secure Room</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: "40px 5%", borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: "13px", color: "var(--text-muted)", position: "relative", zIndex: 10,
        backgroundColor: "rgba(15, 23, 42, 0.3)", backdropFilter: "blur(10px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#4ade80", boxShadow: "0 0 10px #4ade80" }}></div>
          <span>System Online: 2026 Utkristi Colabs</span>
        </div>
        <div style={{ display: "flex", gap: "40px", fontWeight: "600" }}>
          <a href="/about" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="footer-link">About Core</a>
          <a href="/privacy" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="footer-link">Privacy Protocol</a>
          <a href="/terms" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="footer-link">Terms of Service</a>
        </div>
      </footer>

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
          opacity: 0.4;
          animation: float 20s infinite alternate;
        }

        .orb-1 {
          width: 50vw;
          height: 50vw;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.15), transparent);
          top: -10%;
          left: -10%;
          animation-duration: 25s;
        }

        .orb-2 {
          width: 40vw;
          height: 40vw;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.12), transparent);
          bottom: -5%;
          right: -5%;
          animation-duration: 30s;
          animation-delay: -5s;
        }

        .orb-3 {
          width: 30vw;
          height: 30vw;
          background: radial-gradient(circle, rgba(96, 165, 250, 0.1), transparent);
          top: 30%;
          left: 40%;
          animation-duration: 40s;
          animation-delay: -10s;
        }

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
          background: linear-gradient(
            to right,
            transparent,
            rgba(255, 255, 255, 0.1),
            transparent
          );
          transform: rotate(30deg);
          animation: shimmer 4s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-150%) rotate(30deg); }
          100% { transform: translateX(150%) rotate(30deg); }
        }

        .premium-input:focus {
          border-color: var(--primary) !important;
          background-color: rgba(15, 23, 42, 0.8) !important;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15) !important;
        }

        .launch-btn:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 20px 40px -10px rgba(59, 130, 246, 0.5);
        }

        .launch-btn:active {
          transform: translateY(0) scale(0.98);
        }

        .footer-link:hover {
          color: var(--primary) !important;
        }

        @media (max-width: 968px) {
          .hero-content-wrapper {
            flex-direction: column !important;
            gap: 48px !important;
          }
          .hero-left {
            order: 2;
            text-align: center !important;
            flex: none !important;
          }
          .hero-right {
            order: 1;
            flex: none !important;
            width: 100% !important;
            max-width: 480px !important;
          }
          .hero-left p {
            margin: 0 auto 48px !important;
          }
          .features-grid {
            grid-template-columns: 1fr !important;
            text-align: left;
            max-width: 340px !important;
            margin: 0 auto !important;
          }
          .glass-card {
            padding: 32px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default HomePage;
