import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { Sun, Moon, Zap, ChevronRight, LayoutDashboard, Github, Twitter, Linkedin } from "lucide-react";
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
      overflow: "hidden"
    }}>

      {/* Background Decor */}
      <div style={{ position: "absolute", top: "15%", left: "10%", width: "40vw", height: "40vw", background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", filter: "blur(100px)", zIndex: 0 }}></div>
      <div style={{ position: "absolute", bottom: "15%", right: "10%", width: "35vw", height: "35vw", background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", filter: "blur(80px)", zIndex: 0 }}></div>

      {/* Header */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "24px 8%",
        position: "relative",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => navigate("/")}>
          <img src="/utkristi-colabs.png" alt="Logo" style={{ width: "32px", height: "32px", borderRadius: "8px" }} />
          <span style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "-0.02em" }}>Utkristi Colabs</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {user ? (
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px",
                backgroundColor: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)",
                borderRadius: "12px", color: "var(--primary)", fontSize: "14px", fontWeight: "700", cursor: "pointer"
              }}
            >
              <LayoutDashboard size={18} /> Dashboard
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "10px 24px", backgroundColor: "transparent", border: "1px solid var(--border-color)",
                borderRadius: "12px", color: "var(--text-main)", fontSize: "14px", fontWeight: "600", cursor: "pointer"
              }}
            >
              Sign In
            </button>
          )}
          <button
            onClick={toggleTheme}
            style={{
              width: "42px", height: "42px", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)",
              borderRadius: "12px", cursor: "pointer", color: isLightMode ? "#fbbf24" : "var(--text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            {isLightMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Centered Hero Area */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px 100px",
        position: "relative",
        zIndex: 1,
        textAlign: "center"
      }}>
        <div style={{ maxWidth: "600px", marginBottom: "48px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            backgroundColor: "rgba(59, 130, 246, 0.1)", color: "var(--primary)",
            padding: "6px 14px", borderRadius: "50px", fontSize: "12px", fontWeight: "700",
            marginBottom: "24px", textTransform: "uppercase", letterSpacing: "0.05em"
          }}>
            <Zap size={14} fill="var(--primary)" /> Collaborative Coding Simplified
          </div>
          <h1 style={{ fontSize: "calc(2.5rem + 1vw)", fontWeight: "900", marginBottom: "20px", letterSpacing: "-0.04em", lineHeight: 1.1 }}>
            Code Together. <br />
            <span style={{ color: "var(--primary)" }}>Anywhere.</span>
          </h1>
          <p style={{ fontSize: "18px", color: "var(--text-muted)", lineHeight: "1.6", maxWidth: "500px", margin: "0 auto" }}>
            The ultra-lightweight workspace for modern teams. Create a room and start collaborating in seconds.
          </p>
        </div>

        {/* Input Card */}
        <div style={{
          width: "100%",
          maxWidth: "440px",
          backgroundColor: "var(--bg-card)",
          padding: "40px",
          borderRadius: "28px",
          border: "1px solid var(--border-color)",
          boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.3)",
          animation: "slideUp 0.6s cubic-bezier(0, 0.55, 0.45, 1)"
        }}>
          <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "32px", textAlign: "left" }}>Launch Workspace</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ textAlign: "left" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "8px", display: "block", textTransform: "uppercase" }}>Room ID</label>
              <input
                type="text"
                placeholder="Ex: 5w2e4r..."
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyUp={handleEnterKey}
                style={{
                  width: "100%", padding: "16px", borderRadius: "14px", border: "2px solid var(--border-color)",
                  backgroundColor: "var(--bg-dark)", color: "var(--text-main)", fontSize: "16px", outline: "none"
                }}
              />
            </div>

            <div style={{ textAlign: "left" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "8px", display: "block", textTransform: "uppercase" }}>Your Name</label>
              <input
                type="text"
                placeholder="Ex: John Doe"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyUp={handleEnterKey}
                style={{
                  width: "100%", padding: "16px", borderRadius: "14px", border: "2px solid var(--border-color)",
                  backgroundColor: "var(--bg-dark)", color: "var(--text-main)", fontSize: "16px", outline: "none"
                }}
              />
            </div>

            <button
              onClick={joinRoom}
              style={{
                width: "100%", padding: "18px", backgroundColor: "var(--primary)", color: "white",
                fontSize: "16px", fontWeight: "800", borderRadius: "16px", border: "none", cursor: "pointer",
                transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                boxShadow: "0 10px 20px rgba(59, 130, 246, 0.3)"
              }}
            >
              Launch Editor <ChevronRight size={20} />
            </button>

            <div style={{ marginTop: "8px", fontSize: "14px", color: "var(--text-muted)" }}>
              Need a new room? <span onClick={createNewRoom} style={{ color: "var(--primary)", fontWeight: "700", cursor: "pointer" }}>Create Room</span>
            </div>
          </div>
        </div>
      </main>

      {/* Simplified Footer */}
      <footer style={{
        padding: "32px 8%", borderTop: "1px solid var(--border-color)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: "14px", color: "var(--text-muted)", position: "relative", zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <span>&copy; 2026 Utkristi Colabs</span>
          <a href="/about" style={{ color: "inherit", textDecoration: "none" }}>About</a>
          <a href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
        </div>
        <div style={{ display: "flex", gap: "20px" }}>
          <Github size={18} style={{ cursor: "pointer" }} />
          <Twitter size={18} style={{ cursor: "pointer" }} />
          <Linkedin size={18} style={{ cursor: "pointer" }} />
        </div>
      </footer>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default HomePage;
