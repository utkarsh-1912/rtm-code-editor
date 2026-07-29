import React from "react";
import { ChevronRight } from "lucide-react";

const JoinForm = ({ roomId, setRoomId, userName, setUserName, handleEnterKey, joinRoom, createNewRoom, user }) => {
    return (
        <div className="glassmorphic-card glow-effect" style={{
            padding: "40px",
            position: "relative",
            overflow: "hidden"
        }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "4px", background: "linear-gradient(to right, transparent, var(--primary), transparent)", opacity: 0.5 }}></div>

            <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "8px", textAlign: "left", letterSpacing: "-0.02em", fontFamily: "'Outfit', sans-serif" }}>Enter Workspace</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "32px", textAlign: "left" }}>Join a room to start collaborating instantly.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ textAlign: "left" }}>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary)", marginBottom: "10px", display: "block", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Outfit', sans-serif" }}>Room ID or Invite Link</label>
                    <input
                        type="text"
                        placeholder="Paste room ID or link..."
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        onKeyUp={handleEnterKey}
                        className="glassmorphic-input"
                    />
                </div>

                {user ? (
                    <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-color)' }}>
                        <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.name}&background=0D8ABC&color=fff`} alt="Avatar" style={{ width: '72px', height: '72px', borderRadius: '50%', marginBottom: '16px', border: '3px solid var(--primary)', objectFit: 'cover' }} />
                        <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)', fontWeight: '800', fontFamily: "'Outfit', sans-serif" }}>{user.name}</h3>
                        <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>{user.email}</p>
                    </div>
                ) : (
                    <div style={{ textAlign: "left" }}>
                        <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary)", marginBottom: "10px", display: "block", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Outfit', sans-serif" }}>Display Name</label>
                        <input
                            type="text"
                            placeholder="e.g. John Doe"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            onKeyUp={handleEnterKey}
                            className="glassmorphic-input"
                        />
                    </div>
                )}

                <button
                    onClick={joinRoom}
                    className="primary-action-btn hover-bounce"
                    style={{ width: "100%", padding: "16px", fontSize: "16px" }}
                >
                    Join Workspace <ChevronRight size={20} strokeWidth={3} />
                </button>

                <div style={{ marginTop: "12px", fontSize: "14px", color: "var(--text-muted)", textAlign: "center" }}>
                    New here? <span onClick={createNewRoom} style={{ color: "var(--primary)", fontWeight: "800", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "4px" }}>Create your own room</span>
                </div>
            </div>
        </div>
    );
};

export default JoinForm;
