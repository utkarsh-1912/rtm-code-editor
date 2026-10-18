import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";

// Fill-in-the-sentence join card that sits on the landing stage.
const JoinForm = ({ roomId, setRoomId, userName, setUserName, handleEnterKey, joinRoom, createNewRoom, user }) => {
    const ready = Boolean(roomId.trim()) && Boolean(user || userName.trim());
    return (
        <form className="l-join" onSubmit={(e) => { e.preventDefault(); joinRoom(); }} aria-label="Join a room">
            <div className="l-join-head">
                <span className="u-label">Join a room</span>
                <span className="u-label">{ready ? "02" : "01"} of 02</span>
            </div>

            <p className="l-join-line">
                {user ? <>I'm <b>{user.name}</b></> : <>I'm{" "}
                    <input
                        className="l-blank"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        onKeyUp={handleEnterKey}
                        placeholder="your name"
                        aria-label="Display name"
                        size={Math.max(9, userName.length + 1)}
                    />
                </>}
                {" "}and I'm joining{" "}
                <input
                    className="l-blank"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    onKeyUp={handleEnterKey}
                    placeholder="room ID or link"
                    aria-label="Room ID or invite link"
                    size={Math.max(13, Math.min(roomId.length + 1, 26))}
                />.
            </p>

            <div className="l-join-chips">
                <button type="button" className="u-chip" onClick={createNewRoom}><Sparkles size={12} /> Make me a new room</button>
                <span className="u-chip">No account needed</span>
            </div>

            <button type="submit" className="u-btn u-btn--solid" style={{ alignSelf: "flex-start" }}>
                Join room <ArrowRight size={15} />
            </button>
        </form>
    );
};

export default JoinForm;
