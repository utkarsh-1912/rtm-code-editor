import React from "react";
import { ChevronRight } from "lucide-react";

const JoinForm = ({ roomId, setRoomId, userName, setUserName, handleEnterKey, joinRoom, createNewRoom, user }) => {
    return (
        <div className="glass-card" style={{
            backgroundColor: "var(--bg-card-transparent)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            padding: "40px",
            borderRadius: "28px",
            border: "1px solid var(--border-color-glass)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
            position: "relative",
            overflow: "hidden"
        }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "4px", background: "linear-gradient(to right, transparent, var(--primary), transparent)", opacity: 0.5 }}></div>

            <h2 style={{ fontSize: "24px", fontWeight: "900", marginBottom: "8px", textAlign: "left", letterSpacing: "-0.02em" }}>Enter Workspace</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "32px", textAlign: "left" }}>Join a room to start collaborating instantly.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ textAlign: "left" }}>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary)", marginBottom: "10px", display: "block", textTransform: "uppercase", letterSpacing: "0.1em" }}>Room ID or Invite Link</label>
                    <input
                        type="text"
                        placeholder="Paste room ID or link..."
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        onKeyUp={handleEnterKey}
                        style={{
                            width: "100%", padding: "18px", borderRadius: "16px", border: "1px solid var(--border-color-soft)",
                            backgroundColor: "var(--bg-input)", color: "var(--text-main)", fontSize: "16px", outline: "none",
                            transition: "all 0.3s ease", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)"
                        }}
                        className="premium-input"
                    />
                </div>

                {user ? (
                    <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid var(--border-color-soft)' }}>
                        <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.name}&background=0D8ABC&color=fff`} alt="Avatar" style={{ width: '72px', height: '72px', borderRadius: '50%', marginBottom: '16px', border: '3px solid var(--primary)', objectFit: 'cover' }} />
                        <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)', fontWeight: '800' }}>{user.name}</h3>
                        <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>{user.email}</p>
                    </div>
                ) : (
                    <div style={{ textAlign: "left" }}>
                        <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary)", marginBottom: "10px", display: "block", textTransform: "uppercase", letterSpacing: "0.1em" }}>Display Name</label>
                        <input
                            type="text"
                            placeholder="e.g. John Doe"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            onKeyUp={handleEnterKey}
                            style={{
                                width: "100%", padding: "18px", borderRadius: "16px", border: "1px solid var(--border-color-soft)",
                                backgroundColor: "var(--bg-input)", color: "var(--text-main)", fontSize: "16px", outline: "none",
                                transition: "all 0.3s ease", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)"
                            }}
                            className="premium-input"
                        />
                    </div>
                )}

                <button
                    onClick={joinRoom}
                    style={{
                        width: "100%", padding: "20px",
                        background: "linear-gradient(135deg, var(--primary) 0%, #2563eb 100%)",
                        color: "white",
                        fontSize: "17px", fontWeight: "900", borderRadius: "20px", border: "none", cursor: "pointer",
                        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                        boxShadow: "0 15px 30px -5px rgba(59, 130, 246, 0.4)"
                    }}
                    onMouseOver={e => {
                        e.currentTarget.style.transform = "translateY(-3px) scale(1.02)";
                        e.currentTarget.style.boxShadow = "0 20px 40px -10px rgba(59, 130, 246, 0.5)";
                    }}
                    onMouseOut={e => {
                        e.currentTarget.style.transform = "translateY(0) scale(1)";
                        e.currentTarget.style.boxShadow = "0 15px 30px -5px rgba(59, 130, 246, 0.4)";
                    }}
                    className="launch-btn"
                >
                    Join Workspace <ChevronRight size={22} strokeWidth={3} />
                </button>

                <div style={{ marginTop: "12px", fontSize: "14px", color: "var(--text-muted)", textAlign: "center" }}>
                    New here? <span onClick={createNewRoom} style={{ color: "var(--primary)", fontWeight: "800", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "4px" }}>Create your own room</span>
                </div>
            </div>
        </div>
    );
};

export default JoinForm;
