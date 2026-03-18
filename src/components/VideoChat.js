import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    PhoneOff, Video, VideoOff, Mic, MicOff, Maximize2, Minimize2,
    ChevronDown, User, ScreenShare, ScreenShareOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import ACTIONS from '../Action';

const VideoChat = ({ socketRef, projectId, user, isMinimized, onMinimizeToggle, externalInCall, onCallStateChange }) => {
    // --- State Management ---
    const [localStream, setLocalStream] = useState(null);
    const [remoteUsers, setRemoteUsers] = useState({}); // { socketId: { stream, name, isMuted, isVideoOff, isScreenSharing } }
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [inCall, setInCall] = useState(false);
    const [activeSpeaker, setActiveSpeaker] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [pipPosition, setPipPosition] = useState({ x: window.innerWidth - 240, y: window.innerHeight - 200 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isHoveringMini, setIsHoveringMini] = useState(false);

    // --- Refs for WebRTC & Audio ---
    const peersRef = useRef({}); // { socketId: RTCPeerConnection }
    const screenStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analysersRef = useRef({}); // { socketId: AnalyserNode }

    // --- Media Action Helper ---
    const broadcastMediaState = useCallback((state) => {
        if (!socketRef.current) return;
        socketRef.current.emit(ACTIONS.MEDIA_STATE_CHANGE, {
            roomId: `project-${projectId}`,
            state
        });
    }, [projectId, socketRef]);

    // --- Speaker Detection Logic ---
    const setupAudioAnalysis = useCallback((stream, id) => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }

            const source = audioContextRef.current.createMediaStreamSource(stream);
            const analyser = audioContextRef.current.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analysersRef.current[id] = analyser;
        } catch (e) {
            console.warn("Audio analysis setup failed", e);
        }
    }, []);

    // --- WebRTC Core Functions ---
    const createPeer = useCallback((targetSocketId, name, stream) => {
        const peer = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        if (stream) {
            stream.getTracks().forEach(track => peer.addTrack(track, stream));
        }

        peer.onicecandidate = (event) => {
            if (event.candidate && socketRef.current) {
                socketRef.current.emit('new-ice-candidate', {
                    to: targetSocketId,
                    candidate: event.candidate
                });
            }
        };

        peer.ontrack = (event) => {
            const remoteStream = event.streams[0];
            setRemoteUsers(prev => ({
                ...prev,
                [targetSocketId]: { ...prev[targetSocketId], stream: remoteStream, name }
            }));
            setupAudioAnalysis(remoteStream, targetSocketId);
        };

        return peer;
    }, [socketRef, setupAudioAnalysis]);

    const handleJoinCall = useCallback(async () => {
        if (!socketRef.current) return;

        try {
            if (user?.isGuest) {
                setInCall(true);
                socketRef.current.emit('join-video-chat', {
                    projectId,
                    userId: socketRef.current.id,
                    name: user?.name || "Guest",
                    isSpectator: true
                });
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, frameRate: 30 },
                audio: true
            });

            setLocalStream(stream);
            setInCall(true);
            setupAudioAnalysis(stream, 'local');

            socketRef.current.emit('join-video-chat', {
                projectId,
                userId: socketRef.current.id,
                name: user?.name || socketRef.current.userName,
                isSpectator: false
            });

        } catch (err) {
            console.error("Camera access denied", err);
            toast.error("Please enable camera & microphone to join.");
        }
    }, [projectId, socketRef, user, setupAudioAnalysis]);

    const handleLeaveCall = useCallback(() => {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());

        Object.values(peersRef.current).forEach(p => p.close());
        peersRef.current = {};
        analysersRef.current = {};

        setLocalStream(null);
        setRemoteUsers({});
        setInCall(false);
        setIsScreenSharing(false);
        setActiveSpeaker(null);

        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }

        if (socketRef.current) {
            socketRef.current.emit('leave-video-chat', { projectId });
        }
    }, [localStream, projectId, socketRef]);

    useEffect(() => {
        if (externalInCall && !inCall) {
            handleJoinCall();
        } else if (!externalInCall && inCall) {
            handleLeaveCall();
        }
    }, [externalInCall, inCall, handleJoinCall, handleLeaveCall]);

    const handleLeaveCallLocal = () => {
        handleLeaveCall();
        onCallStateChange?.(false);
    };

    // --- Socket Signaling Handlers ---
    useEffect(() => {
        if (!socketRef.current) return;
        const socket = socketRef.current;

        const onUserJoined = async ({ userId, name, isSpectator }) => {
            if (userId === socket.id) return;
            if (isSpectator) {
                toast(`${name} is watching`);
                return;
            }

            if (localStream) {
                const peer = createPeer(userId, name, localStream);
                peersRef.current[userId] = peer;

                try {
                    const offer = await peer.createOffer();
                    await peer.setLocalDescription(offer);
                    socket.emit('video-offer', { to: userId, offer });
                } catch (err) { console.error("Offer error", err); }
            } else {
                socket.emit('request-streams', { to: userId });
            }
        };

        const onVideoOffer = async ({ from, offer }) => {
            const peer = createPeer(from, "User", localStream);
            peersRef.current[from] = peer;

            try {
                await peer.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                socket.emit('video-answer', { to: from, answer });
            } catch (err) { console.error("Answer error", err); }
        };

        const onVideoAnswer = async ({ from, answer }) => {
            const peer = peersRef.current[from];
            if (peer) {
                try {
                    await peer.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (err) { console.error("Set remote description error", err); }
            }
        };

        const onIceCandidate = async ({ from, candidate }) => {
            const peer = peersRef.current[from];
            if (peer) {
                try {
                    await peer.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) { }
            }
        };

        const onRequestStreams = ({ from }) => {
            if (localStream) onUserJoined({ userId: from, name: "Remote", isSpectator: false });
        };

        const onUserLeft = ({ userId }) => {
            if (peersRef.current[userId]) {
                peersRef.current[userId].close();
                delete peersRef.current[userId];
                delete analysersRef.current[userId];
                setRemoteUsers(prev => {
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                });
            }
        };

        const onMediaStateChange = ({ userId, state }) => {
            setRemoteUsers(prev => ({
                ...prev,
                [userId]: { ...prev[userId], ...state }
            }));
        };

        socket.on('user-joined-video', onUserJoined);
        socket.on('video-offer', onVideoOffer);
        socket.on('video-answer', onVideoAnswer);
        socket.on('new-ice-candidate', onIceCandidate);
        socket.on('request-streams', onRequestStreams);
        socket.on('user-left-video', onUserLeft);
        socket.on(ACTIONS.MEDIA_STATE_CHANGE, onMediaStateChange);

        return () => {
            socket.off('user-joined-video');
            socket.off('video-offer');
            socket.off('video-answer');
            socket.off('new-ice-candidate');
            socket.off('request-streams');
            socket.off('user-left-video');
            socket.off(ACTIONS.MEDIA_STATE_CHANGE);
        };
    }, [localStream, socketRef, createPeer]);

    // --- Active Speaker Detection ---
    useEffect(() => {
        if (!inCall) return;
        const interval = setInterval(() => {
            let topVol = 0;
            let currentSpeaker = null;

            if (analysersRef.current['local'] && !isMuted) {
                const data = new Uint8Array(analysersRef.current['local'].frequencyBinCount);
                analysersRef.current['local'].getByteFrequencyData(data);
                const vol = data.reduce((a, b) => a + b, 0) / data.length;
                if (vol > 35) {
                    topVol = vol;
                    currentSpeaker = 'local';
                }
            }

            Object.entries(analysersRef.current).forEach(([id, analyser]) => {
                if (id === 'local' || remoteUsers[id]?.isMuted) return;
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                const vol = data.reduce((a, b) => a + b, 0) / data.length;
                if (vol > topVol && vol > 35) {
                    topVol = vol;
                    currentSpeaker = id;
                }
            });

            if (currentSpeaker !== activeSpeaker) setActiveSpeaker(currentSpeaker);
        }, 300);

        return () => clearInterval(interval);
    }, [inCall, activeSpeaker, isMuted, remoteUsers]);

    // --- PiP Drag Logic ---
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            setPipPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        };

        const handleMouseUp = () => setIsDragging(false);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    const startDragging = (e) => {
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - pipPosition.x,
            y: e.clientY - pipPosition.y
        });
    };

    // --- Screen Sharing ---
    const toggleScreenShare = async () => {
        try {
            if (!isScreenSharing) {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                screenStreamRef.current = screenStream;
                const screenTrack = screenStream.getVideoTracks()[0];

                Object.values(peersRef.current).forEach(peer => {
                    const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                });

                screenTrack.onended = () => handleStopScreenShare();
                setIsScreenSharing(true);
                broadcastMediaState({ isScreenSharing: true });
            } else {
                handleStopScreenShare();
            }
        } catch (err) { console.error("Screen share fail", err); }
    };

    const handleStopScreenShare = () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
        }
        const videoTrack = localStream.getVideoTracks()[0];
        Object.values(peersRef.current).forEach(peer => {
            const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(videoTrack);
        });
        setIsScreenSharing(false);
        broadcastMediaState({ isScreenSharing: false });
    };

    // --- UI Render Helpers ---
    const totalPeople = Object.keys(remoteUsers).length + (user?.isGuest ? 0 : 1);

    if (!inCall) return null;

    if (isMinimized) {
        return (
            <div
                className="glass-panel"
                style={{
                    ...minimizedOverlayStyle,
                    left: `${pipPosition.x}px`,
                    top: `${pipPosition.y}px`,
                    bottom: 'auto',
                    right: 'auto',
                    border: isDragging ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                    scale: isDragging ? '1.02' : '1',
                    transition: isDragging ? 'none' : 'scale 0.2s, border 0.2s'
                }}
                onMouseDown={startDragging}
                onMouseEnter={() => setIsHoveringMini(true)}
                onMouseLeave={() => setIsHoveringMini(false)}
            >
                <div style={minifiedGridStyle}>
                    {activeSpeaker === 'local' || !activeSpeaker ? (
                        <video ref={(el) => { if (el) el.srcObject = localStream }} autoPlay muted playsInline style={miniVideoElement} />
                    ) : (
                        <RemoteVideo user={remoteUsers[activeSpeaker]} isMini />
                    )}
                </div>

                {/* Internal Hover Controls */}
                <div style={{
                    ...miniControls,
                    opacity: isHoveringMini || isDragging ? 1 : 0,
                    transform: isHoveringMini || isDragging ? 'translateY(0)' : 'translateY(10px)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    pointerEvents: isHoveringMini ? 'auto' : 'none'
                }}>
                    <button style={miniBtn} onClick={(e) => { e.stopPropagation(); onMinimizeToggle(false); }} title="Expand">
                        <Maximize2 size={12} color="white" />
                    </button>
                    <button
                        style={{ ...miniBtn, color: isVideoOff ? '#ef4444' : 'white' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            const tr = localStream?.getVideoTracks()[0];
                            if (tr) {
                                tr.enabled = !tr.enabled;
                                setIsVideoOff(!tr.enabled);
                                broadcastMediaState({ isVideoOff: !tr.enabled });
                            }
                        }}
                        title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                    >
                        {isVideoOff ? <VideoOff size={12} color="#ef4444" /> : <Video size={12} color="white" />}
                    </button>
                    <button
                        style={{ ...miniBtn, color: isMuted ? '#ef4444' : 'white' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            const tr = localStream?.getAudioTracks()[0];
                            if (tr) {
                                tr.enabled = !tr.enabled;
                                setIsMuted(!tr.enabled);
                                broadcastMediaState({ isMuted: !tr.enabled });
                            }
                        }}
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? <MicOff size={12} color="#ef4444" /> : <Mic size={12} color="white" />}
                    </button>
                    <button
                        style={{ ...miniBtn, backgroundColor: '#ef4444' }}
                        onClick={(e) => { e.stopPropagation(); handleLeaveCallLocal(); }}
                        title="End Call"
                    >
                        <PhoneOff size={12} color="white" />
                    </button>
                </div>
            </div>
        );
    }


    return (
        <div style={containerStyle(isExpanded)}>
            {!inCall ? null : (
                <div style={callWorkspaceStyle}>
                    <div style={gridStyle(totalPeople)}>
                        {!user?.isGuest && (
                            <div style={{ ...videoTileStyle(activeSpeaker === 'local'), position: 'relative' }}>
                                {isVideoOff ? (
                                    <div style={avatarCenterStyle}><User size={48} opacity={0.1} /></div>
                                ) : (
                                    <video ref={(el) => { if (el) el.srcObject = localStream }} autoPlay muted playsInline style={videoElementStyle} />
                                )}
                                <div style={tileOverlayStyle}>
                                    <div style={nameTagStyle}>You</div>
                                </div>
                            </div>
                        )}
                        {Object.entries(remoteUsers).map(([id, remote]) => (
                            <div key={id} style={{ ...videoTileStyle(activeSpeaker === id), position: 'relative' }}>
                                <RemoteVideo user={remote} />
                            </div>
                        ))}
                    </div>

                    <div style={controlDockWrapper}>
                        <div className="glass-panel" style={controlDock}>
                            {!user?.isGuest && (
                                <>
                                    <button style={controlCircle(isMuted, '#ef4444')} onClick={() => {
                                        const tr = localStream.getAudioTracks()[0];
                                        tr.enabled = !tr.enabled;
                                        setIsMuted(!tr.enabled);
                                        broadcastMediaState({ isMuted: !tr.enabled });
                                    }}>
                                        {isMuted ? <MicOff size={18} color="#ef4444" /> : <Mic size={18} color="white" />}
                                    </button>
                                    <button style={controlCircle(isVideoOff, '#ef4444')} onClick={() => {
                                        const tr = localStream.getVideoTracks()[0];
                                        tr.enabled = !tr.enabled;
                                        setIsVideoOff(!tr.enabled);
                                        broadcastMediaState({ isVideoOff: !tr.enabled });
                                    }}>
                                        {isVideoOff ? <VideoOff size={18} color="#ef4444" /> : <Video size={18} color="white" />}
                                    </button>
                                    <button style={controlCircle(isScreenSharing, 'var(--primary)')} onClick={toggleScreenShare}>
                                        {isScreenSharing ? <ScreenShareOff size={18} color="white" /> : <ScreenShare size={18} color="white" />}
                                    </button>
                                </>
                            )}
                            <button style={controlCircle(false)} onClick={() => onMinimizeToggle(true)} title="Minimize to Overlay">
                                <ChevronDown size={18} color="white" />
                            </button>
                            <button style={controlCircle(false)} onClick={() => setIsExpanded(!isExpanded)}>
                                {isExpanded ? <Minimize2 size={18} color="white" /> : <Maximize2 size={18} color="white" />}
                            </button>
                            <button style={hangUpStyle} onClick={handleLeaveCallLocal}><PhoneOff size={20} color="white" /></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const RemoteVideo = ({ user, isMini }) => {
    const videoRef = useRef();
    useEffect(() => {
        if (videoRef.current && user?.stream) videoRef.current.srcObject = user.stream;
    }, [user?.stream]);

    if (!user) return null;

    return (
        <>
            {user.isVideoOff ? (
                <div style={avatarCenterStyle}><User size={isMini ? 24 : 48} opacity={0.1} /></div>
            ) : (
                <video ref={videoRef} autoPlay playsInline style={isMini ? miniVideoElement : videoElementStyle} />
            )}
            {!isMini && (
                <div style={tileOverlayStyle}>
                    <div style={nameTagStyle}>{user.name || "Participant"}</div>
                </div>
            )}
        </>
    );
};

// --- Styles ---
const containerStyle = (isExpanded) => ({
    backgroundColor: "#0d1117",
    height: isExpanded ? "100%" : "340px",
    display: "flex", flexDirection: "column",
    transition: "height 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    position: "relative", overflow: "hidden",
});

const minimizedOverlayStyle = {
    position: 'fixed', bottom: '80px', right: '24px', width: '220px', height: '140px',
    borderRadius: '16px', zIndex: 9999, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)', cursor: 'move', userSelect: 'none'
};

const minifiedGridStyle = { flex: 1, backgroundColor: '#000', position: 'relative' };
const miniVideoElement = { width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' };
const miniControls = {
    position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
    display: 'flex', gap: '8px', padding: '6px', borderRadius: '12px',
    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.1)', zIndex: 2
};
const miniBtn = { width: '24px', height: '24px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

const callWorkspaceStyle = { flex: 1, display: "flex", flexDirection: "column", position: 'relative' };

const gridStyle = (total) => ({
    display: 'grid',
    gridTemplateColumns: total <= 1 ? '1fr' : total <= 2 ? '1fr 1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px', padding: '16px', height: '100%', width: '100%', overflowY: 'auto'
});

const videoTileStyle = (active) => ({ borderRadius: "20px", overflow: "hidden", backgroundColor: "#161b22", aspectRatio: "16/10", border: active ? "3px solid var(--primary)" : "1px solid rgba(255,255,255,0.05)", transition: "all 0.3s" });
const videoElementStyle = { width: "100%", height: "100%", objectFit: "cover" };
const avatarCenterStyle = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' };
const tileOverlayStyle = { position: "absolute", bottom: "12px", left: "12px", pointerEvents: "none" };
const nameTagStyle = { backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "4px 12px", borderRadius: "100px" };
const controlDockWrapper = { position: "absolute", bottom: "32px", width: "100%", display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 10 };
const controlDock = { display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "24px", pointerEvents: "auto" };
const controlCircle = (active, color) => ({ width: "42px", height: "42px", borderRadius: "14px", backgroundColor: active ? (color || "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.03)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" });
const hangUpStyle = { width: "56px", height: "42px", borderRadius: "14px", backgroundColor: "#ef4444", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

export default VideoChat;
