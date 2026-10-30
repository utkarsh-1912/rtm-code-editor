import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import VideoChat from "../components/VideoChat";
import { initSocket } from "../socket";

// Keeps a call going after you leave its room or project, when the "Keep calls on other
// pages" setting is on (utils/callPrefs). The page hands its call over as it unmounts; this
// host rejoins the same call on its own socket and shows it as a small window with a way back.
// Opening that room or project again hands the call back to the page.
// Each hand-over is a quick rejoin: the call keeps going, the connection is rebuilt.
const CallCarryContext = createContext({ carry: () => {}, claim: () => false });

export const useCallCarry = () => useContext(CallCarryContext);

export function CallCarryProvider({ children }) {
    const navigate = useNavigate();
    const [call, setCall] = useState(null); // { id, title, path, user }
    const [ready, setReady] = useState(false);
    const [joined, setJoined] = useState(false);
    const [minimized, setMinimized] = useState(true);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    const socketRef = useRef(null);
    const callRef = useRef(null);
    callRef.current = call;

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const carry = useCallback((next) => {
        setJoined(false);
        setMinimized(true);
        setCall(next);
    }, []);

    // A page opening for this call takes it back. True when there was one to take.
    const claim = useCallback((id) => {
        if (!callRef.current || callRef.current.id !== id) return false;
        setCall(null);
        return true;
    }, []);

    // The call gets its own socket, so it does not depend on any page being open.
    const callId = call?.id;
    useEffect(() => {
        if (!callId) return undefined;
        let live = true;
        let socket = null;
        initSocket().then((s) => {
            if (!live) { s.disconnect(); return; }
            socket = s;
            socketRef.current = s;
            setReady(true);
        });
        return () => {
            live = false;
            setReady(false);
            socketRef.current = null;
            socket?.disconnect();
        };
    }, [callId]);

    return (
        <CallCarryContext.Provider value={{ carry, claim }}>
            {children}
            {call && ready && (
                <div style={isMobile && !minimized ? { position: "fixed", inset: 0, zIndex: 9998, backgroundColor: "#000" } : undefined}>
                    <VideoChat
                        key={call.id}
                        socketRef={socketRef}
                        projectId={call.id}
                        user={call.user}
                        isMinimized={minimized}
                        onMinimizeToggle={setMinimized}
                        externalInCall={joined}
                        onCallStateChange={(active) => {
                            setJoined(active);
                            if (!active) setCall(null);
                        }}
                        isMobile={isMobile}
                        returnTo={{ label: `Back to ${call.title}`, onClick: () => navigate(call.path) }}
                    />
                </div>
            )}
        </CallCarryContext.Provider>
    );
}
