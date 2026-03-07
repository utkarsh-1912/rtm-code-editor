import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { Sun, Moon, Zap, Users, Code, Terminal, ChevronRight } from "lucide-react";

function HomePage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem("app-theme") === "light";
  });

  const location = useLocation();

  useEffect(() => {
    // Check for room ID in URL params
    const searchParams = new URLSearchParams(location.search);
    const roomParam = searchParams.get("room");
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, [location]);

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
    if (!roomId || !userName) {
      toast.error("Room Id & Username are required.");
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

  const handleRoomIdChange = (e) => {
    let val = e.target.value;
    if (val.includes("/editor/")) {
      const parts = val.split("/editor/");
      if (parts.length > 1) {
        val = parts[1].split(/[/?#]/)[0];
      }
    }
    setRoomId(val);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      backgroundColor: "var(--bg-dark)",
      color: "var(--text-main)",
      fontFamily: "'Outfit', sans-serif",
      position: "relative",
      overflowX: "hidden"
    }}>

      {/* BACKGROUND ELEMENTS */}
      <div style={{ position: "absolute", top: "10%", left: "-5%", width: "40vw", height: "40vw", background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", filter: "blur(60px)", zIndex: 0 }}></div>
      <div style={{ position: "absolute", bottom: "10%", right: "-5%", width: "35vw", height: "35vw", background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", filter: "blur(50px)", zIndex: 0 }}></div>

      {/* HEADER */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "24px 8%",
        position: "relative",
        zIndex: 10
      }}>
        <img src="/utkristi-colabs.png" alt="Logo" style={{ height: "40px", filter: "drop-shadow(0px 4px 8px rgba(0,0,0,0.1))" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => navigate("/login")}
            style={{
              padding: "10px 12px",
              backgroundColor: "transparent",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              color: "var(--text-main)",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "var(--border-color)"; }}
          >
            Sign In
          </button>
          <button
            onClick={toggleTheme}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "42px",
              height: "42px",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              cursor: "pointer",
              color: isLightMode ? "#fbbf24" : "var(--text-muted)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = "rotate(15deg) scale(1.05)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "var(--border-color)"; }}
            title="Toggle Theme"
          >
            {isLightMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 8%",
        gap: "60px",
        position: "relative",
        zIndex: 1
      }}>

        {/* LEFT SIDE: HERO */}
        <div style={{ flex: 1, maxWidth: "600px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            color: "var(--primary)",
            padding: "8px 16px",
            borderRadius: "50px",
            fontSize: "14px",
            fontWeight: "600",
            marginBottom: "24px"
          }}>
            <Zap size={14} fill="var(--primary)" />
            <span>Release 1.0 is live!</span>
          </div>

          <h1 style={{
            fontSize: "calc(2.5rem + 1vw)",
            fontWeight: "800",
            lineHeight: 1.1,
            margin: "0 0 24px 0",
            letterSpacing: "-0.02em"
          }}>
            Collaborate. Code. <br />
            <span style={{ color: "var(--primary)", position: "relative" }}>
              Conquer.
              <svg style={{ position: "absolute", bottom: "-8px", left: 0, width: "100%", height: "12px" }} viewBox="0 0 100 12" preserveAspectRatio="none">
                <path d="M0,10 Q50,0 100,10" stroke="var(--primary)" strokeWidth="4" fill="none" opacity="0.3" />
              </svg>
            </span>
          </h1>

          <p style={{
            fontSize: "18px",
            lineHeight: 1.6,
            color: "var(--text-muted)",
            marginBottom: "40px",
            maxWidth: "500px"
          }}>
            Real-time synchronization, lightning-fast execution, and seamless chat—all in one place. Experience the next generation of collaborative coding.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", maxWidth: "500px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "start" }}>
              <div style={{ backgroundColor: "var(--secondary)", padding: "10px", borderRadius: "12px", color: "var(--primary)" }}>
                <Code size={20} />
              </div>
              <div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "700" }}>Live Editing</h4>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>Instant sync with sub-millisecond latency.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "start" }}>
              <div style={{ backgroundColor: "var(--secondary)", padding: "10px", borderRadius: "12px", color: "#f87171" }}>
                <Terminal size={20} />
              </div>
              <div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "700" }}>Fast Execution</h4>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>Execute in multiple languages powered by Judge0.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "start" }}>
              <div style={{ backgroundColor: "var(--secondary)", padding: "10px", borderRadius: "12px", color: "#4ade80" }}>
                <Users size={20} />
              </div>
              <div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "700" }}>Smooth Chat</h4>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>Built-in real-time chat with emoji support.</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: JOIN CARD */}
        <div style={{
          flex: "0 0 440px",
          perspective: "1000px"
        }}>
          <div style={{
            background: "var(--bg-card)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid var(--border-color)",
            padding: "28px",
            borderRadius: "28px",
            boxShadow: "0 30px 60px -12px rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(255,255,255,0.05)",
            animation: "slideUp 0.8s cubic-bezier(0, 0.55, 0.45, 1)",
            position: "relative",
            zIndex: 1
          }}>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "800", color: "var(--text-main)" }}>Enter Workspace</h2>
            <p style={{ margin: "0 0 32px 0", fontSize: "15px", color: "var(--text-muted)" }}>Join a room to start collaborating instantly.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)", marginLeft: "4px" }}>Room ID or Invite Link</label>
                <input
                  type="text"
                  placeholder="Paste room ID or link..."
                  onChange={handleRoomIdChange}
                  value={roomId}
                  onKeyUp={handleEnterKey}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    borderRadius: "16px",
                    outline: "none",
                    border: "2px solid transparent",
                    background: "var(--secondary)",
                    color: "var(--text-main)",
                    fontSize: "15px",
                    fontWeight: "500",
                    boxSizing: "border-box",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--primary)"; e.target.style.background = "var(--bg-dark)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "var(--secondary)"; }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)", marginLeft: "4px" }}>Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  onChange={(e) => setUserName(e.target.value)}
                  value={userName}
                  onKeyUp={handleEnterKey}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    borderRadius: "16px",
                    outline: "none",
                    border: "2px solid transparent",
                    background: "var(--secondary)",
                    color: "var(--text-main)",
                    fontSize: "15px",
                    fontWeight: "500",
                    boxSizing: "border-box",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--primary)"; e.target.style.background = "var(--bg-dark)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "var(--secondary)"; }}
                />
              </div>

              <button
                onClick={joinRoom}
                style={{
                  marginTop: "12px",
                  width: "100%",
                  padding: "16px",
                  backgroundColor: "var(--primary)",
                  color: "white",
                  fontSize: "16px",
                  fontWeight: "700",
                  borderRadius: "16px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 15px 30px -5px rgba(59, 130, 246, 0.6)"; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "var(--primary)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 10px 25px -5px rgba(59, 130, 246, 0.5)"; }}
              >
                Join Workspace <ChevronRight size={18} />
              </button>

              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "16px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "16px",
                fontSize: "14px",
                color: "var(--text-muted)"
              }}>
                New here? {" "}
                <button
                  onClick={createNewRoom}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    fontWeight: "700",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "none"
                  }}
                  onMouseOver={(e) => e.target.style.textDecoration = "underline"}
                  onMouseOut={(e) => e.target.style.textDecoration = "none"}
                >
                  Create your own room
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="landing-footer" style={{
        padding: "32px 8%",
        borderTop: "1px solid var(--border-color)",
        backgroundColor: "rgba(0,0,0,0.02)",
        position: "relative",
        zIndex: 10
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "24px"
        }}>
          {/* Logo & Copyright */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "var(--text-muted)",
            fontSize: "14px",
            fontWeight: "500"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              Created with <span style={{ color: "#ef4444" }}>💙</span> by <a href="http://utkristi-io.netlify.app/" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: "700" }}>Utkristi.io</a>
            </div>
            <div style={{ width: "1px", height: "12px", backgroundColor: "var(--border-color)" }} />
          </div>

          <div style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: "600", display: "flex", alignItems: "center", gap: "16px" }} className="footer-links">
            <a href="/about" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px", transition: "all 0.2s" }} onMouseOver={(e) => e.target.style.color = "var(--primary)"} onMouseOut={(e) => e.target.style.color = "var(--text-muted)"}>About</a>
            <a href="/privacy" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px", transition: "all 0.2s" }} onMouseOver={(e) => e.target.style.color = "var(--primary)"} onMouseOut={(e) => e.target.style.color = "var(--text-muted)"}>Privacy</a>
            <a href="/terms" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px", transition: "all 0.2s" }} onMouseOver={(e) => e.target.style.color = "var(--primary)"} onMouseOut={(e) => e.target.style.color = "var(--text-muted)"}>Terms</a>
            <a href="http://utkristi-io.netlify.app/" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px", transition: "all 0.2s" }} onMouseOver={(e) => e.target.style.color = "var(--primary)"} onMouseOut={(e) => e.target.style.color = "var(--text-muted)"}>Author</a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 1024px) {
          main {
            flex-direction: column-reverse !important;
            text-align: center !important;
            padding: 40px 8% !important;
            gap: 48px !important;
          }
          div[style*="hero"] {
            max-width: 100% !important;
          }
          div[style*="perspective"] {
            flex: none !important;
            width: 100% !important;
            max-width: 480px !important;
          }
          div[style*="hero"] p {
            margin-left: auto !important;
            margin-right: auto !important;
          }
        }
        @media (max-width: 768px) {
          .landing-footer > div {
            flex-direction: column !important;
            text-align: center !important;
            gap: 24px !important;
          }
          .footer-links {
            justify-content: center !important;
            flex-direction: column !important;
            gap: 12px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default HomePage;
