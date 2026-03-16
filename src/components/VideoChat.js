import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PhoneOff, Video, VideoOff, Mic, MicOff, User, ScreenShare, ScreenShareOff, Maximize2, Minimize2, Signal } from 'lucide-react';
import toast from 'react-hot-toast';
import ACTIONS from '../Action';

const VideoChat = ({ socketRef, projectId, user }) => {
    // --- State Management ---
    const [stream, setStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: { stream, name, isSpeaking, isMuted, isVideoOff, isScreenSharing } }
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [inCall, setInCall] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [activeSpeaker, setActiveSpeaker] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);

    // --- Refs ---
    const peersRef = useRef({});
    const screenStreamRef = useRef(null);
    const localVideoRef = useRef();
    const audioAnalysersRef = useRef({});
    const localAudioAnalyserRef = useRef(null);
    const audioContextRef = useRef(null);

    // --- Actions helper ---
    const emitMediaState = useCallback((state) => {
        socketRef.current.emit(ACTIONS.MEDIA_STATE_CHANGE, {
            roomId: `project-${projectId}`,
            state
        });
    }, [projectId, socketRef]);

    // --- Media Controls ---
    const startCall = async () => {
        if (!socketRef || !socketRef.current) {
            toast.error("Connecting to server...");
            return;
        }

        if (!user && !socketRef.current?.userName) {
            toast.error("Please enter a name first");
            return;
        }

        if (!user || user.isGuest) {
            // Guests can join to view
            setInCall(true);
            socketRef.current.emit('join-video-chat', {
                projectId,
                userId: socketRef.current.id,
                name: user?.name || socketRef.current.userName,
                isSpectator: true
            });
            return;
        }

        try {
            const localStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, frameRate: 24 },
                audio: true
            });
            setStream(localStream);
            setInCall(true);

            initAudioDetection(localStream, 'local');

            socketRef.current.emit('join-video-chat', {
                projectId,
                userId: socketRef.current.id,
                name: user.name || socketRef.current.userName,
                isSpectator: false
            });
        } catch (err) {
            console.error("Failed to get media", err);
            toast.error("Could not access camera/microphone");
        }
    };

    const endCall = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
        }
        setStream(null);
        setInCall(false);
        setIsScreenSharing(false);

        Object.values(peersRef.current).forEach(peer => peer.close());
        peersRef.current = {};
        setRemoteStreams({});

        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }

        socketRef.current.emit('leave-video-chat', { projectId });
    };

    // --- WebRTC Logic ---
    const addPeer = useCallback((userId, myId, localStream, remoteName) => {
        const peer = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        peersRef.current[userId] = peer;
        localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current.emit('new-ice-candidate', { to: userId, candidate: event.candidate });
            }
        };

        peer.ontrack = (event) => {
            const remoteStream = event.streams[0];
            setRemoteStreams(prev => ({
                ...prev,
                [userId]: { ...prev[userId], stream: remoteStream, name: remoteName }
            }));
            initAudioDetection(remoteStream, userId);
        };

        return peer;
    }, [socketRef]);

    const createPeer = useCallback((userId, myId, localStream, remoteName) => {
        const peer = addPeer(userId, myId, localStream, remoteName);
        if (localStream) {
            peer.createOffer().then(offer => {
                peer.setLocalDescription(offer);
                socketRef.current.emit('video-offer', { to: userId, offer });
            });
        } else {
            // Spectator only
            socketRef.current.emit('request-streams', { to: userId });
        }
        return peer;
    }, [addPeer, socketRef]);

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

                screenTrack.onended = () => stopScreenShare();
                setIsScreenSharing(true);
                socketRef.current.emit(ACTIONS.SCREEN_SHARE_START, { roomId: `project-${projectId}` });
            } else {
                stopScreenShare();
            }
        } catch (err) {
            console.error("Screen share error:", err);
        }
    };

    const stopScreenShare = () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }
        const videoTrack = stream.getVideoTracks()[0];
        Object.values(peersRef.current).forEach(peer => {
            const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(videoTrack);
        });
        setIsScreenSharing(false);
        socketRef.current.emit(ACTIONS.SCREEN_SHARE_STOP, { roomId: `project-${projectId}` });
    };

    // --- Speaker Detection Logic ---
    const initAudioDetection = (audioStream, id) => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }

            const source = audioContextRef.current.createMediaStreamSource(audioStream);
            const analyser = audioContextRef.current.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            if (id === 'local') {
                localAudioAnalyserRef.current = analyser;
            } else {
                audioAnalysersRef.current[id] = analyser;
            }
        } catch (e) {
            console.warn("Audio Context init failed", e);
        }
    };

    useEffect(() => {
        if (!inCall) return;
        const interval = setInterval(() => {
            let maxVol = 0;
            let speakerId = null;

            if (localAudioAnalyserRef.current && !isMuted) {
                const data = new Uint8Array(localAudioAnalyserRef.current.frequencyBinCount);
                localAudioAnalyserRef.current.getByteFrequencyData(data);
                const volume = data.reduce((a, b) => a + b, 0) / data.length;
                if (volume > 30) {
                    maxVol = volume;
                    speakerId = 'local';
                }
            }

            Object.entries(audioAnalysersRef.current).forEach(([id, analyser]) => {
                if (remoteStreams[id]?.isMuted) return;
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                const volume = data.reduce((a, b) => a + b, 0) / data.length;
                if (volume > 30 && volume > maxVol) {
                    maxVol = volume;
                    speakerId = id;
                }
            });

            if (speakerId !== activeSpeaker) {
                setActiveSpeaker(speakerId);
            }
        }, 200);
        return () => clearInterval(interval);
    }, [inCall, activeSpeaker, isMuted, remoteStreams]);

    // --- Socket Handlers ---
    useEffect(() => {
        if (!socketRef.current) return;
        const socket = socketRef.current;

        const handleUserJoined = ({ userId, name, isSpectator }) => {
            if (userId === socket.id) return;
            if (isSpectator) {
                toast(`${name} is watching`);
                return;
            }
            toast(`${name} joined video`);
            if (stream) createPeer(userId, socket.id, stream, name);
        };

        const handleRequestStreams = ({ from }) => {
            if (stream) createPeer(from, socket.id, stream, user?.name || socket.id);
        };

        const handleOffer = async ({ from, offer }) => {
            const peer = addPeer(from, socket.id, stream, "User");
            try {
                await peer.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                socket.emit('video-answer', { to: from, answer });
            } catch (err) { console.error(err); }
        };

        const handleAnswer = async ({ from, answer }) => {
            const peer = peersRef.current[from];
            if (peer) try { await peer.setRemoteDescription(new RTCSessionDescription(answer)); } catch (err) { console.error(err); }
        };

        const handleCandidate = async ({ from, candidate }) => {
            const peer = peersRef.current[from];
            if (peer) try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (err) { }
        };

        const handleMediaChange = ({ userId, state }) => {
            setRemoteStreams(prev => ({
                ...prev,
                [userId]: { ...prev[userId], ...state }
            }));
        };

        const handleScreenStart = ({ userId }) => {
            setRemoteStreams(prev => ({
                ...prev,
                [userId]: { ...prev[userId], isScreenSharing: true }
            }));
        };

        const handleScreenStop = ({ userId }) => {
            setRemoteStreams(prev => ({
                ...prev,
                [userId]: { ...prev[userId], isScreenSharing: false }
            }));
        };

        socket.on('user-joined-video', handleUserJoined);
        socket.on('video-offer', handleOffer);
        socket.on('video-answer', handleAnswer);
        socket.on('new-ice-candidate', handleCandidate);
        socket.on('request-streams', handleRequestStreams);
        socket.on(ACTIONS.MEDIA_STATE_CHANGE, handleMediaChange);
        socket.on(ACTIONS.SCREEN_SHARE_START, handleScreenStart);
        socket.on(ACTIONS.SCREEN_SHARE_STOP, handleScreenStop);

        socket.on('user-left-video', ({ userId }) => {
            if (peersRef.current[userId]) {
                peersRef.current[userId].close();
                delete peersRef.current[userId];
                delete audioAnalysersRef.current[userId];
                setRemoteStreams(prev => {
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                });
            }
        });

        return () => {
            socket.off('user-joined-video', handleUserJoined);
            socket.off('video-offer', handleOffer);
            socket.off('video-answer', handleAnswer);
            socket.off('new-ice-candidate', handleCandidate);
            socket.off('request-streams', handleRequestStreams);
            socket.off(ACTIONS.MEDIA_STATE_CHANGE);
            socket.off(ACTIONS.SCREEN_SHARE_START);
            socket.off(ACTIONS.SCREEN_SHARE_STOP);
            socket.off('user-left-video');
        };
    }, [stream, socketRef, createPeer, addPeer, user?.name]);

    useEffect(() => {
        if (inCall && stream && localVideoRef.current && !isVideoOff) {
            localVideoRef.current.srcObject = stream;
        }
    }, [inCall, stream, isVideoOff]);

    // Auto-join for guests/spectators
    useEffect(() => {
        if (!inCall && user?.isGuest) {
            const timer = setTimeout(() => {
                startCall();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [user, inCall, startCall]);

    // --- Layout Logic ---
    const screenSharer = Object.entries(remoteStreams).find(([, r]) => r.isScreenSharing) || (isScreenSharing ? ['local', { name: 'You' }] : null);
    const totalParticipants = Object.keys(remoteStreams).length + 1;
    const gridCols = screenSharer ? 1 : (totalParticipants <= 1 ? 1 : totalParticipants <= 2 ? 1 : totalParticipants <= 4 ? 2 : 3);

    return (
        <div style={containerStyle(isExpanded)}>
            {!inCall ? (
                <div style={preCallContainerStyle}>
                    <div style={heroIconStyle}><Video size={48} color="var(--primary)" /></div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px' }}>Collaboration Call</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '240px', margin: '0 auto 24px' }}>
                        {(!user || user.isGuest) ? "Connect as a guest to observe and chat." : "Join with audio and video to collaborate."}
                    </p>
                    <button onClick={startCall} style={mainJoinButtonStyle(user?.isGuest)} disabled={!user || user.isGuest}>
                        <Video size={18} /><span>Join Meeting</span>
                    </button>
                </div>
            ) : (
                <div style={activeCallContainerStyle}>
                    <div style={videoGridStyle(gridCols, !!screenSharer)}>
                        {/* Local Video - Only if not screen sharing or if it's NOT the primary stream */}
                        <div style={videoWrapperStyle(activeSpeaker === 'local')}>
                            {isVideoOff ? (
                                <div style={avatarPlaceholderStyle}><div style={avatarCircleStyle}><User size={40} /></div></div>
                            ) : (
                                <video ref={localVideoRef} autoPlay muted playsInline style={videoStyle} />
                            )}
                            <div style={participantOverlaysStyle}>
                                <span style={labelStyle}>You</span>
                                {isMuted && <div style={mutedBadgeStyle}><MicOff size={10} color="white" /></div>}
                            </div>
                        </div>

                        {/* Remote Videos */}
                        {Object.entries(remoteStreams).map(([id, remote]) => (
                            <div key={id} style={videoWrapperStyle(activeSpeaker === id)}>
                                <VideoElement stream={remote.stream} name={remote.name} isMuted={remote.isMuted} isVideoOff={remote.isVideoOff} />
                            </div>
                        ))}
                    </div>

                    {/* Floating Controls */}
                    <div style={controlBarWrapperStyle}>
                        <div style={floatingControlBarStyle}>
                            <button onClick={() => {
                                const tr = stream.getAudioTracks()[0];
                                tr.enabled = !tr.enabled;
                                setIsMuted(!tr.enabled);
                                emitMediaState({ isMuted: !tr.enabled });
                            }} style={actionButtonStyle(isMuted, '#ef4444')} title={isMuted ? "Unmute" : "Mute"}>
                                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                            </button>

                            <button onClick={() => {
                                const tr = stream.getVideoTracks()[0];
                                tr.enabled = !tr.enabled;
                                setIsVideoOff(!tr.enabled);
                                emitMediaState({ isVideoOff: !tr.enabled });
                            }} style={actionButtonStyle(isVideoOff, '#ef4444')} title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}>
                                {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
                            </button>

                            <button onClick={toggleScreenShare} style={actionButtonStyle(isScreenSharing, 'var(--primary)')} title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
                                {isScreenSharing ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
                            </button>

                            <div style={dividerStyle} />

                            <button onClick={() => setIsExpanded(!isExpanded)} style={actionButtonStyle(false)} title={isExpanded ? "Collapse" : "Expand"}>
                                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>

                            <button onClick={endCall} style={hangUpButtonStyle} title="Leave Meeting"><PhoneOff size={20} /></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const VideoElement = ({ stream, name, isMuted, isVideoOff }) => {
    const ref = useRef();
    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
            ref.current.play().catch(() => { });
        }
    }, [stream]);

    return (
        <>
            {isVideoOff ? (
                <div style={avatarPlaceholderStyle}><div style={avatarCircleStyle}><User size={40} /></div></div>
            ) : (
                <video ref={ref} autoPlay playsInline style={videoStyle} muted={false} />
            )}
            <div style={participantOverlaysStyle}>
                <span style={labelStyle}>{name || "Participant"}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {isMuted && <div style={mutedBadgeStyle}><MicOff size={10} color="white" /></div>}
                    <Signal size={12} color="#22c55e" />
                </div>
            </div>
        </>
    );
};

// --- Styles ---

const containerStyle = (isExpanded) => ({
    backgroundColor: "#0d1117",
    height: isExpanded ? "100%" : "320px",
    display: "flex",
    flexDirection: "column",
    transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    overflow: "hidden",
});

const preCallContainerStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px",
    textAlign: "center",
};

const heroIconStyle = {
    width: "80px",
    height: "80px",
    borderRadius: "24px",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
};

const mainJoinButtonStyle = (isGuest) => ({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 24px",
    backgroundColor: isGuest ? "rgba(255,255,255,0.05)" : "var(--primary)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontWeight: "700",
    cursor: isGuest ? "not-allowed" : "pointer",
    boxShadow: isGuest ? "none" : "0 8px 16px rgba(59, 130, 246, 0.3)",
});

const activeCallContainerStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "12px",
    position: "relative",
    minHeight: 0,
};

const videoGridStyle = (cols, hasScreenShare) => ({
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: "12px",
    flex: 1,
    minHeight: 0,
    alignContent: "start",
    overflowY: "auto",
});

const videoWrapperStyle = (isSpeaking) => ({
    position: "relative",
    borderRadius: "16px",
    overflow: "hidden",
    backgroundColor: "#161b22",
    aspectRatio: "16/10",
    border: isSpeaking ? "3px solid #3b82f6" : "1px solid rgba(255,255,255,0.05)",
    boxShadow: isSpeaking ? "0 0 20px rgba(59, 130, 246, 0.2)" : "none",
    transition: "all 0.2s ease",
});

const videoStyle = { width: "100%", height: "100%", objectFit: "cover" };

const participantOverlaysStyle = {
    position: "absolute",
    bottom: "8px",
    left: "8px",
    right: "8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    pointerEvents: "none",
};

const labelStyle = {
    backgroundColor: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(4px)",
    color: "white",
    fontSize: "10px",
    fontWeight: "600",
    padding: "2px 8px",
    borderRadius: "4px",
};

const mutedBadgeStyle = {
    backgroundColor: "#ef4444",
    padding: "3px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const avatarPlaceholderStyle = { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1117" };
const avatarCircleStyle = { width: "70px", height: "70px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.05)" };

const controlBarWrapperStyle = { position: "absolute", bottom: "24px", left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" };
const floatingControlBarStyle = { backgroundColor: "rgba(22, 27, 34, 0.8)", backdropFilter: "blur(12px)", padding: "8px", borderRadius: "18px", display: "flex", alignItems: "center", gap: "6px", border: "1px solid rgba(255,255,255,0.08)", pointerEvents: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" };

const actionButtonStyle = (isActive, activeColor) => ({
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    backgroundColor: isActive ? (activeColor || "rgba(255,255,255,0.1)") : "transparent",
    border: "none",
    color: isActive ? "white" : "var(--text-muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s",
});

const hangUpButtonStyle = { width: "50px", height: "38px", borderRadius: "12px", backgroundColor: "#ef4444", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)" };
const dividerStyle = { width: "1px", height: "20px", backgroundColor: "rgba(255,255,255,0.1)", margin: "0 4px" };

export default VideoChat;
