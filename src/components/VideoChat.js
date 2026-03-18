import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    PhoneOff, Video, VideoOff, Mic, MicOff, User,
    ScreenShare, ScreenShareOff, Maximize2, Minimize2,
    Signal, Radio
} from 'lucide-react';
import toast from 'react-hot-toast';
import ACTIONS from '../Action';

const VideoChat = ({ socketRef, projectId, user }) => {
    // --- State Management ---
    const [localStream, setLocalStream] = useState(null);
    const [remoteUsers, setRemoteUsers] = useState({}); // { socketId: { stream, name, isMuted, isVideoOff, isScreenSharing } }
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [inCall, setInCall] = useState(false);
    const [activeSpeaker, setActiveSpeaker] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

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

        // Add local tracks if they exist
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
        setIsConnecting(true);

        try {
            // Guests / Spectators don't need media
            if (user?.isGuest) {
                setInCall(true);
                socketRef.current.emit('join-video-chat', {
                    projectId,
                    userId: socketRef.current.id,
                    name: user?.name || "Guest",
                    isSpectator: true
                });
                setIsConnecting(false);
                return;
            }

            // Request Camera/Mic
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, frameRate: 30 },
                audio: true
            });

            setLocalStream(stream);
            setInCall(true);
            setupAudioAnalysis(stream, 'local');

            // Signal entry to others
            socketRef.current.emit('join-video-chat', {
                projectId,
                userId: socketRef.current.id,
                name: user?.name || socketRef.current.userName,
                isSpectator: false
            });

        } catch (err) {
            console.error("Camera access denied", err);
            toast.error("Please enable camera & microphone to join.");
        } finally {
            setIsConnecting(false);
        }
    }, [projectId, socketRef, user, setupAudioAnalysis]);

    const handleLeaveCall = useCallback(() => {
        // Stop all local tracks
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());

        // Close all peer connections
        Object.values(peersRef.current).forEach(p => p.close());
        peersRef.current = {};
        analysersRef.current = {};

        // Reset state
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

            // If we have a stream, initiate an offer to the newcomer
            if (localStream) {
                const peer = createPeer(userId, name, localStream);
                peersRef.current[userId] = peer;

                try {
                    const offer = await peer.createOffer();
                    await peer.setLocalDescription(offer);
                    socket.emit('video-offer', { to: userId, offer });
                } catch (err) { console.error("Offer error", err); }
            } else {
                // We are spectators, just request their stream
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

            // Check Local
            if (analysersRef.current['local'] && !isMuted) {
                const data = new Uint8Array(analysersRef.current['local'].frequencyBinCount);
                analysersRef.current['local'].getByteFrequencyData(data);
                const vol = data.reduce((a, b) => a + b, 0) / data.length;
                if (vol > 35) {
                    topVol = vol;
                    currentSpeaker = 'local';
                }
            }

            // Check Remotes
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

    // --- Screen Sharing Implementation ---
    const toggleScreenShare = async () => {
        try {
            if (!isScreenSharing) {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                screenStreamRef.current = screenStream;
                const screenTrack = screenStream.getVideoTracks()[0];

                // Replace track on all peer connections
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
        } catch (err) {
            console.error("Screen share fail", err);
        }
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
    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: totalPeople <= 1 ? '1fr' : totalPeople <= 2 ? '1fr 1fr' : totalPeople <= 4 ? '1fr 1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '12px',
        padding: '16px',
        height: '100%',
        width: '100%',
        alignContent: 'start',
        overflowY: 'auto'
    };

    return (
        <div style={containerStyle(isExpanded)}>
            {!inCall ? (
                <div style={welcomeScreenStyle}>
                    <div className="glass-panel" style={welcomeCardStyle}>
                        <div style={pulseIconStyle}><Radio size={32} color="var(--primary)" /></div>
                        <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#fff', marginBottom: '8px' }}>Collaboration Hub</h2>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', maxWidth: '240px', margin: '0 auto 24px' }}>
                            Experience high-fidelity workspace communication with crystal clear video and screen sharing.
                        </p>
                        <button
                            style={primaryJoinButtonStyle(isConnecting)}
                            onClick={handleJoinCall}
                            disabled={isConnecting}
                        >
                            {isConnecting ? "Negotiating..." : (user?.isGuest ? "Join as Spectator" : "Join Conference")}
                        </button>
                    </div>
                </div>
            ) : (
                <div style={callWorkspaceStyle}>
                    <div style={gridStyle}>
                        {/* LOCAL TILE */}
                        {!user?.isGuest && (
                            <div style={videoTileStyle(activeSpeaker === 'local')}>
                                {isVideoOff ? (
                                    <div style={avatarCenterStyle}><User size={48} opacity={0.1} /></div>
                                ) : (
                                    <video ref={(el) => { if (el) el.srcObject = localStream }} autoPlay muted playsInline style={videoElementStyle} />
                                )}
                                <div style={tileOverlayStyle}>
                                    <div style={nameTagStyle}>You</div>
                                    <div style={statusIconGroupStyle}>
                                        {isMuted && <MicOff size={12} color="#f87171" />}
                                        {isScreenSharing && <ScreenShare size={12} color="var(--primary)" />}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* REMOTE TILES */}
                        {Object.entries(remoteUsers).map(([id, remote]) => (
                            <div key={id} style={videoTileStyle(activeSpeaker === id)}>
                                <RemoteVideo user={remote} />
                            </div>
                        ))}
                    </div>

                    {/* CONTROL BAR */}
                    <div style={controlDockWrapper}>
                        <div className="glass-panel" style={controlDock}>
                            {!user?.isGuest && (
                                <>
                                    <button
                                        style={controlCircle(isMuted, '#ef4444')}
                                        onClick={() => {
                                            const tr = localStream.getAudioTracks()[0];
                                            tr.enabled = !tr.enabled;
                                            setIsMuted(!tr.enabled);
                                            broadcastMediaState({ isMuted: !tr.enabled });
                                        }}
                                    >
                                        {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                                    </button>

                                    <button
                                        style={controlCircle(isVideoOff, '#ef4444')}
                                        onClick={() => {
                                            const tr = localStream.getVideoTracks()[0];
                                            tr.enabled = !tr.enabled;
                                            setIsVideoOff(!tr.enabled);
                                            broadcastMediaState({ isVideoOff: !tr.enabled });
                                        }}
                                    >
                                        {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
                                    </button>

                                    <button
                                        style={controlCircle(isScreenSharing, 'var(--primary)')}
                                        onClick={toggleScreenShare}
                                    >
                                        {isScreenSharing ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
                                    </button>

                                    <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />
                                </>
                            )}

                            <button style={controlCircle(false)} onClick={() => setIsExpanded(!isExpanded)}>
                                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>

                            <button style={hangUpStyle} onClick={handleLeaveCall}><PhoneOff size={20} /></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const RemoteVideo = ({ user }) => {
    const videoRef = useRef();
    useEffect(() => {
        if (videoRef.current && user.stream) {
            videoRef.current.srcObject = user.stream;
        }
    }, [user.stream]);

    return (
        <>
            {user.isVideoOff ? (
                <div style={avatarCenterStyle}><User size={48} opacity={0.1} /></div>
            ) : (
                <video ref={videoRef} autoPlay playsInline style={videoElementStyle} />
            )}
            <div style={tileOverlayStyle}>
                <div style={nameTagStyle}>{user.name || "Participant"}</div>
                <div style={statusIconGroupStyle}>
                    {user.isMuted && <MicOff size={12} color="#f87171" />}
                    {user.isScreenSharing && <ScreenShare size={12} color="var(--primary)" />}
                </div>
            </div>
        </>
    );
};

// --- Styles ---

const containerStyle = (isExpanded) => ({
    backgroundColor: "#0d1117",
    height: isExpanded ? "100%" : "340px",
    display: "flex",
    flexDirection: "column",
    transition: "height 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    position: "relative",
    overflow: "hidden",
});

const welcomeScreenStyle = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" };
const welcomeCardStyle = { borderRadius: "24px", padding: "48px 32px", textAlign: "center", border: "1px solid rgba(255,255,255,0.05)", maxWidth: "400px" };

const pulseIconStyle = { width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', position: 'relative' };

const primaryJoinButtonStyle = (loading) => ({
    padding: "14px 28px",
    backgroundColor: loading ? "rgba(255,255,255,0.05)" : "var(--primary)",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    fontWeight: "800",
    fontSize: "14px",
    cursor: loading ? "wait" : "pointer",
    boxShadow: loading ? "none" : "0 10px 20px rgba(59, 130, 246, 0.3)",
    transition: "all 0.2s"
});

const callWorkspaceStyle = { flex: 1, display: "flex", flexDirection: "column", position: 'relative' };

const videoTileStyle = (active) => ({
    position: "relative",
    borderRadius: "20px",
    overflow: "hidden",
    backgroundColor: "#161b22",
    aspectRatio: "16/10",
    border: active ? "3px solid var(--primary)" : "1px solid rgba(255,255,255,0.05)",
    boxShadow: active ? "0 0 30px rgba(59, 130, 246, 0.2)" : "none",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
});

const videoElementStyle = { width: "100%", height: "100%", objectFit: "cover" };
const avatarCenterStyle = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' };

const tileOverlayStyle = { position: "absolute", bottom: "12px", left: "12px", right: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "none" };
const nameTagStyle = { backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "4px 12px", borderRadius: "100px" };
const statusIconGroupStyle = { display: "flex", gap: "6px", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: "4px 8px", borderRadius: "100px", backdropFilter: "blur(8px)" };

const controlDockWrapper = { position: "absolute", bottom: "32px", width: "100%", display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 10 };
const controlDock = { display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "24px", pointerEvents: "auto", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" };

const controlCircle = (active, color) => ({
    width: "42px",
    height: "42px",
    borderRadius: "14px",
    backgroundColor: active ? (color || "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.03)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s"
});

const hangUpStyle = { width: "56px", height: "42px", borderRadius: "14px", backgroundColor: "#ef4444", color: "white", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", boxShadow: "0 8px 16px rgba(239, 68, 68, 0.3)" };

export default VideoChat;
