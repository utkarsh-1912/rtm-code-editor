import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { Sun, Moon, Zap, Users, Code, Terminal, ChevronRight, LayoutDashboard, Globe, Shield, HelpCircle, Github, Twitter, Linkedin } from "lucide-react";
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
    // Check for room ID in URL params
    const searchParams = new URLSearchParams(location.search);
    const roomParam = searchParams.get("room");
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, [location]);

  // Pre-fill username if logged in
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
      <div style={{ position: "absolute", top: "10%", left: "-5%", width: "40vw", height: "40vw", background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", filter: "blur(80px)", zIndex: 0 }}></div>
      <div style={{ position: "absolute", bottom: "20%", right: "-5%", width: "35vw", height: "35vw", background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", filter: "blur(70px)", zIndex: 0 }}></div>

      {/* HEADER */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "24px 8%",
        position: "relative",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => navigate("/")}>
          <div style={{ backgroundColor: "var(--primary)", padding: "8px", borderRadius: "12px", color: "white" }}>
            <Code size={24} strokeWidth={3} />
          </div>
          <span style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.03em" }}>Utkristi Colabs</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {user ? (
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.2)",
                borderRadius: "12px",
                color: "var(--primary)",
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.2)"; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.1)"; }}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "10px 24px",
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
          )}
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
        padding: "40px 8% 100px",
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
            fontWeight: "700",
            marginBottom: "24px",
            letterSpacing: "0.02em",
            textTransform: "uppercase"
          }}>
            <Zap size={14} fill="var(--primary)" />
            <span>Powering Real-time Teams</span>
          </div>

          <h1 style={{
            fontSize: "calc(2.8rem + 1.2vw)",
            fontWeight: "900",
            lineHeight: 1.05,
            margin: "0 0 24px 0",
            letterSpacing: "-0.04em"
          }}>
            Collaborate. <br />
            <span style={{
              background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 10px rgba(59, 130, 246, 0.2))"
            }}>Code Everywhere.</span>
          </h1>

          <p style={{
            fontSize: "20px",
            lineHeight: 1.6,
            color: "var(--text-muted)",
            marginBottom: "48px",
            maxWidth: "520px",
            fontWeight: "400"
          }}>
            The professional workspace for modern teams. Sync your code instantly, execute in sub-milliseconds, and chat without leaving your editor.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", maxWidth: "550px" }}>
            {[
              { icon: <Code size={22} />, color: "var(--primary)", title: "Live Sync", desc: "Sub-millisecond latency." },
              { icon: <Globe size={22} />, color: "#f87171", title: "Cloud Run", desc: "Execute 20+ languages." },
              { icon: <Users size={22} />, color: "#4ade80", title: "Team Chat", desc: "Contextual collaboration." },
              { icon: <Shield size={22} />, color: "#a855f7", title: "Secure", desc: "Private & ephemeral rooms." }
            ].map((feature, idx) => (
              <div key={idx} style={{ display: "flex", gap: "16px", alignItems: "start" }}>
                <div style={{ backgroundColor: "var(--bg-card)", padding: "12px", borderRadius: "14px", color: feature.color, border: "1px solid var(--border-color)", boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}>
                  {feature.icon}
                </div>
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "700" }}>{feature.title}</h4>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.4" }}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE: JOIN CARD */}
        <div style={{
          flex: "0 0 460px",
          perspective: "1000px"
        }}>
          <div style={{
            background: "var(--bg-card)",
            backdropFilter: "blur(32px)",
            WebkitBackdropFilter: "blur(32px)",
            border: "1px solid var(--border-color)",
            padding: "40px",
            borderRadius: "32px",
            boxShadow: "0 40px 80px -20px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255,255,255,0.05)",
            animation: "slideUp 0.8s cubic-bezier(0, 0.55, 0.45, 1)",
            position: "relative",
            zIndex: 1
          }}>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "800", color: "var(--text-main)", letterSpacing: "-0.02em" }}>Enter Workspace</h2>
            <p style={{ margin: "0 0 32px 0", fontSize: "15px", color: "var(--text-muted)", lineHeight: "1.5" }}>Paste an invite link or create a new room to start coding.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-muted)", marginLeft: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Room ID</label>
                <input
                  type="text"
                  placeholder="Paste room ID or link..."
                  onChange={handleRoomIdChange}
                  value={roomId}
                  onKeyUp={handleEnterKey}
                  style={{
                    width: "100%",
                    padding: "18px 24px",
                    borderRadius: "16px",
                    outline: "none",
                    border: "2px solid transparent",
                    background: "var(--secondary)",
                    color: "var(--text-main)",
                    fontSize: "16px",
                    fontWeight: "500",
                    boxSizing: "border-box",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)"
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--primary)"; e.target.style.background = "var(--bg-dark)"; e.target.style.boxShadow = "0 0 0 4px rgba(59, 130, 246, 0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "var(--secondary)"; e.target.style.boxShadow = "inset 0 2px 4px rgba(0,0,0,0.05)"; }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-muted)", marginLeft: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  onChange={(e) => setUserName(e.target.value)}
                  value={userName}
                  onKeyUp={handleEnterKey}
                  style={{
                    width: "100%",
                    padding: "18px 24px",
                    borderRadius: "16px",
                    outline: "none",
                    border: "2px solid transparent",
                    background: "var(--secondary)",
                    color: "var(--text-main)",
                    fontSize: "16px",
                    fontWeight: "500",
                    boxSizing: "border-box",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)"
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--primary)"; e.target.style.background = "var(--bg-dark)"; e.target.style.boxShadow = "0 0 0 4px rgba(59, 130, 246, 0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "var(--secondary)"; e.target.style.boxShadow = "inset 0 2px 4px rgba(0,0,0,0.05)"; }}
                />
              </div>

              <button
                onClick={joinRoom}
                style={{
                  marginTop: "8px",
                  width: "100%",
                  padding: "18px",
                  backgroundColor: "var(--primary)",
                  color: "white",
                  fontSize: "17px",
                  fontWeight: "800",
                  borderRadius: "18px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                  boxShadow: "0 12px 28px -6px rgba(59, 130, 246, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px"
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover)"; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 20px 40px -8px rgba(59, 130, 246, 0.6)"; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "var(--primary)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 12px 28px -6px rgba(59, 130, 246, 0.5)"; }}
              >
                Launch Editor <ChevronRight size={20} strokeWidth={3} />
              </button>

              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "18px",
                backgroundColor: "rgba(255, 255, 255, 0.02)",
                borderRadius: "18px",
                fontSize: "15px",
                color: "var(--text-muted)",
                border: "1px solid var(--border-color)"
              }}>
                Need a new session? {" "}
                <button
                  onClick={createNewRoom}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    fontWeight: "800",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "none",
                    transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => e.target.style.color = "var(--primary-hover)"}
                >
                  Create Room
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="landing-footer" style={{
        padding: "80px 8% 40px",
        borderTop: "1px solid var(--border-color)",
        backgroundColor: "rgba(0,0,0,0.03)",
        position: "relative",
        zIndex: 10
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "48px",
          marginBottom: "60px"
        }}>
          {/* Brand Col */}
          <div style={{ maxWidth: "300px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{ backgroundColor: "var(--primary)", padding: "6px", borderRadius: "8px", color: "white" }}>
                <Code size={18} strokeWidth={4} />
              </div>
              <span style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "-0.02em" }}>Utkristi Colabs</span>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.6", marginBottom: "24px" }}>
              The modern collaboration platform for engineers to build, test, and ship code together in real-time.
            </p>
            <div style={{ display: "flex", gap: "16px" }}>
              <Github size={20} style={{ cursor: "pointer", color: "var(--text-muted)" }} />
              <Twitter size={20} style={{ cursor: "pointer", color: "var(--text-muted)" }} />
              <Linkedin size={20} style={{ cursor: "pointer", color: "var(--text-muted)" }} />
            </div>
          </div>

          {/* Links Col 1 */}
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)", marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Product</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <a href="/" style={footerLinkStyle}>Editor</a>
              <a href="/dashboard" style={footerLinkStyle}>Dashboard</a>
              <a href="/about" style={footerLinkStyle}>Features</a>
              <a href="#" style={footerLinkStyle}>Enterprise</a>
            </div>
          </div>

          {/* Links Col 2 */}
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)", marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Support</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <a href="/about" style={footerLinkStyle}>Documentation</a>
              <a href="/about" style={footerLinkStyle}>API Reference</a>
              <a href="/about" style={footerLinkStyle}>Contact</a>
              <a href="/about" style={footerLinkStyle}>Status</a>
            </div>
          </div>

          {/* Links Col 3 */}
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)", marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Legal</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <a href="/privacy" style={footerLinkStyle}>Privacy Policy</a>
              <a href="/terms" style={footerLinkStyle}>Terms of Service</a>
              <a href="/privacy" style={footerLinkStyle}>Cookie Policy</a>
            </div>
          </div>
        </div>

        <div style={{
          paddingTop: "40px",
          borderTop: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "24px",
          fontSize: "14px",
          color: "var(--text-muted)"
        }}>
          <div>
            © {new Date().getFullYear()} Utkristi Colabs. Created by <a href="http://utkristi-io.netlify.app/" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: "700" }}>Utkristi.io</a>
          </div>
          <div style={{ display: "flex", gap: "24px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Globe size={14} /> Global / English</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><HelpCircle size={14} /> Help Center</span>
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
            flex-direction: column !important;
            text-align: center !important;
            padding: 40px 5% 80px !important;
            gap: 60px !important;
          }
          div[style*="hero"] {
            max-width: 100% !important;
          }
          div[style*="perspective"] {
            flex: none !important;
            width: 100% !important;
            max-width: 480px !important;
            margin: 0 auto;
          }
          div[style*="hero"] p {
            margin-left: auto !important;
            margin-right: auto !important;
          }
          div[style*="grid"] {
            margin: 0 auto !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </div>
  );
}

const footerLinkStyle = {
  fontSize: "14px",
  color: "var(--text-muted)",
  textDecoration: "none",
  transition: "all 0.2s",
  cursor: "pointer"
};

// Handle Hover for footer links after render
// (In a real app we'd use a styled component or className, but for this direct style approach):
// We'll use a simple className and global CSS in the style tag for cleaner hover handling.

export default HomePage;
