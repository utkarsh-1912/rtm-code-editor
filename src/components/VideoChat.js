import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Video, VideoOff, Mic, MicOff, Maximize2, Minimize2,
    ChevronDown, User, ScreenShare, ScreenShareOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import ACTIONS from '../Action';

const VideoChat = ({ 
    socketRef, 
    projectId, 
    user, 
    isMinimized, 
    onMinimizeToggle, 
    externalInCall, 
    onCallStateChange,
    clients = [],
    mediaStates = {},
    initialAudioState = true,
    initialVideoState = true
}) => {
    // --- State Management ---
    const [localStream, setLocalStream] = useState(null);
    const [remoteUsers, setRemoteUsers] = useState({}); // { socketId: { stream, name, isMuted, isVideoOff, isScreenSharing } }
    const [isMuted, setIsMuted] = useState(!initialAudioState);
    const [isVideoOff, setIsVideoOff] = useState(!initialVideoState);
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

    const mediaStateRef = useRef({ isMuted, isVideoOff });
    useEffect(() => {
        mediaStateRef.current = { isMuted, isVideoOff };
    }, [isMuted, isVideoOff]);

    // --- Media Action Helper ---
    const broadcastMediaState = useCallback((state) => {
        if (!socketRef.current) return;
        socketRef.current.emit(ACTIONS.MEDIA_STATE_CHANGE, {
            roomId: `project-${projectId}`,
            state
        });
    }, [projectId, socketRef]);

    // --- Screen Sharing Logic ---
    const stopScreenShare = useCallback(async () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }

        try {
            if (!isVideoOff) {
                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720, frameRate: 30 }
                });
                const camTrack = newStream.getVideoTracks()[0];
                
                Object.values(peersRef.current).forEach(peer => {
                    const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(camTrack);
                });

                const currentAudio = localStream?.getAudioTracks()[0];
                const displayStream = new MediaStream([camTrack]);
                if (currentAudio) displayStream.addTrack(currentAudio);
                setLocalStream(displayStream);
            }
            setIsScreenSharing(false);
        } catch (err) {
            console.error("Return to camera failed", err);
            toast.error("Could not restore camera");
            setIsScreenSharing(false);
        }
    }, [isVideoOff, localStream]);

    const toggleScreenShare = useCallback(async () => {
        if (!isScreenSharing) {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                const screenTrack = screenStream.getVideoTracks()[0];
                screenStreamRef.current = screenStream;

                screenTrack.onended = () => {
                    stopScreenShare();
                };

                Object.values(peersRef.current).forEach(peer => {
                    const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                });

                const currentAudio = localStream?.getAudioTracks()[0];
                const displayStream = new MediaStream([screenTrack]);
                if (currentAudio) displayStream.addTrack(currentAudio);
                setLocalStream(displayStream);
                setIsScreenSharing(true);

            } catch (err) {
                console.error("Screen share failed", err);
            }
        } else {
            await stopScreenShare();
        }
    }, [isScreenSharing, localStream, stopScreenShare]);

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

            let stream;
            if (!initialVideoState && !initialAudioState) {
                // If both are false, avoid getUserMedia throwing an error. Create an empty stream.
                stream = new MediaStream();
            } else {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: initialVideoState ? { width: 1280, height: 720, frameRate: 30 } : false,
                    audio: initialAudioState
                });
            }

            setLocalStream(stream);
            setInCall(true);

            // Handle edge case where initial state is explicitly false, setup dummy tracks if needed
            // But usually getUserMedia with {video: false, audio: true} returns a stream with only an audio track.
            // If they both are false, we shouldn't even call getUserMedia.
            if (initialAudioState) {
                setupAudioAnalysis(stream, 'local');
            }

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
    }, [projectId, socketRef, user, setupAudioAnalysis, initialAudioState, initialVideoState]);

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

    // Cleanup camera tracks faithfully on hard unmounts (e.g Sidebar routing to Dashboard)
    useEffect(() => {
        const currentStream = localStream;
        return () => {
            if (currentStream) {
                currentStream.getTracks().forEach(t => t.stop());
            }
        };
    }, [localStream]);


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

            // Only create if we don't have this peer already
            if (peersRef.current[userId]) return;

            if (localStream) {
                const peer = createPeer(userId, name, localStream);
                peersRef.current[userId] = peer;

                try {
                    const offer = await peer.createOffer();
                    await peer.setLocalDescription(offer);
                    socket.emit('video-offer', { to: userId, offer });
                    
                    // Broadcast our current media state so the new user knows our status
                    socket.emit(ACTIONS.MEDIA_STATE_CHANGE, {
                        roomId: `project-${projectId}`,
                        state: mediaStateRef.current
                    });
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

                // Also broadcast our media state back so they have ours
                socket.emit(ACTIONS.MEDIA_STATE_CHANGE, {
                    roomId: `project-${projectId}`,
                    state: mediaStateRef.current
                });
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

        const onParticipantsList = ({ clients }) => {
            console.log("Existing participants:", clients);
            clients.forEach(c => {
                onUserJoined({ userId: c.userId, name: c.name, isSpectator: c.isSpectator });
            });
        };

        socket.on('video-participants', onParticipantsList);
        socket.on('user-joined-video', onUserJoined);
        socket.on('video-offer', onVideoOffer);
        socket.on('video-answer', onVideoAnswer);
        socket.on('new-ice-candidate', onIceCandidate);
        socket.on('request-streams', onRequestStreams);
        socket.on('user-left-video', onUserLeft);
        socket.on(ACTIONS.MEDIA_STATE_CHANGE, onMediaStateChange);

        return () => {
            socket.off('video-participants', onParticipantsList);
            socket.off('user-joined-video', onUserJoined);
            socket.off('video-offer', onVideoOffer);
            socket.off('video-answer', onVideoAnswer);
            socket.off('new-ice-candidate', onIceCandidate);
            socket.off('request-streams', onRequestStreams);
            socket.off('user-left-video', onUserLeft);
            socket.off(ACTIONS.MEDIA_STATE_CHANGE, onMediaStateChange);
        };
    }, [localStream, socketRef, createPeer, projectId]);

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
                    transform: isHoveringMini || isDragging ? 'translate(calc(-50%)) scale(1)' : 'translate(calc(-50%)) translateY(10px) scale(0.9)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    pointerEvents: isHoveringMini ? 'auto' : 'none'
                }}>
                    <button style={miniBtn} onClick={(e) => { e.stopPropagation(); onMinimizeToggle(false); }} title="Expand">
                        <Maximize2 size={12} color="white" />
                    </button>
                    <button
                        style={{ ...miniBtn, color: isVideoOff ? '#ef4444' : 'white' }}
                        onClick={async (e) => {
                            e.stopPropagation();
                            const videoTrack = localStream?.getVideoTracks()[0];
                            if (!videoTrack) return;

                            if (!isVideoOff) {
                                videoTrack.stop();
                                setIsVideoOff(true);
                                broadcastMediaState({ isVideoOff: true });
                            } else {
                                try {
                                    const newStream = await navigator.mediaDevices.getUserMedia({
                                        video: { width: 1280, height: 720, frameRate: 30 }
                                    });
                                    const newTrack = newStream.getVideoTracks()[0];
                                    localStream.removeTrack(videoTrack);
                                    localStream.addTrack(newTrack);
                                    
                                    // Trigger state update to refresh all consumers/signaling handlers
                                    setLocalStream(new MediaStream(localStream.getTracks()));

                                    Object.values(peersRef.current).forEach(peer => {
                                        const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
                                        if (sender) sender.replaceTrack(newTrack);
                                    });
                                    setIsVideoOff(false);
                                    broadcastMediaState({ isVideoOff: false });
                                } catch (err) {
                                    console.error("Failed to restart camera from PiP", err);
                                }
                            }
                        }}
                        title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                    >
                        {isVideoOff ? <VideoOff size={12} /> : <Video size={12} />}
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
                        {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
                    </button>
                    <button
                        style={{ ...miniBtn }}
                        onClick={(e) => { e.stopPropagation(); onMinimizeToggle(false); }}
                        title="Expand"
                    >
                        <Maximize2 size={12} color="white" />
                    </button>
                </div>
            </div>
        );
    }


    return (
        <div style={containerStyle(isExpanded)}>
            {!inCall ? null : (
                <div style={callWorkspaceStyle}>
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
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
                        </div>

                        {/* Integrated Participants Sidebar (Desktop Expanded Mode) */}
                        {isExpanded && (
                            <div style={participantsSidebarStyle}>
                                <div style={sidebarHeaderStyle}>
                                    <h3 style={sidebarTitleStyle}>PARTICIPANTS ({clients.length})</h3>
                                </div>
                                <div style={participantsListStyle}>
                                    {clients.map((client, i) => {
                                        const media = mediaStates[client.socketId] || {};
                                        const isMainUser = client.name === (user?.name || socketRef.current?.userName);
                                        const currentMedia = isMainUser ? { isMuted, isVideoOff } : media;
                                        
                                        return (
                                            <div key={i} style={participantItemStyle}>
                                                <div style={avatarCircleStyle}>
                                                    {(client.userName || client.name || 'U')[0]}
                                                </div>
                                                <span style={participantNameStyle}>
                                                    {client.userName || client.name} {isMainUser && "(You)"}
                                                </span>
                                                <div style={participantStatusStyle}>
                                                    {currentMedia.isMuted ? <MicOff size={14} color="#ef4444" /> : <Mic size={14} color="#10b981" />}
                                                    {currentMedia.isVideoOff ? <VideoOff size={14} color="#ef4444" /> : <Video size={14} color="#10b981" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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
                                    <button style={controlCircle(isVideoOff, '#ef4444')} onClick={async () => {
                                        const videoTrack = localStream.getVideoTracks()[0];
                                        if (!isVideoOff) {
                                            // Stop the track to turn off LED
                                            videoTrack.stop();
                                            setIsVideoOff(true);
                                            broadcastMediaState({ isVideoOff: true });
                                        } else {
                                            try {
                                                const newStream = await navigator.mediaDevices.getUserMedia({
                                                    video: { width: 1280, height: 720, frameRate: 30 }
                                                });
                                                const newTrack = newStream.getVideoTracks()[0];

                                                // Replace in local stream
                                                localStream.removeTrack(videoTrack);
                                                localStream.addTrack(newTrack);
                                                
                                                // Trigger state update to refresh all consumers/signaling handlers
                                                setLocalStream(new MediaStream(localStream.getTracks()));

                                                // Replace in all peer connections
                                                Object.values(peersRef.current).forEach(peer => {
                                                    const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
                                                    if (sender) sender.replaceTrack(newTrack);
                                                });

                                                setIsVideoOff(false);
                                                broadcastMediaState({ isVideoOff: false });
                                            } catch (err) {
                                                console.error("Failed to restart camera", err);
                                                toast.error("Could not restart camera");
                                            }
                                        }
                                    }}>
                                        {isVideoOff ? <VideoOff size={18} color="#ef4444" /> : <Video size={18} color="white" />}
                                    </button>
                                    <button style={controlCircle(isScreenSharing, 'var(--primary)')} onClick={toggleScreenShare} title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
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
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9000,
    display: "flex", flexDirection: "column",
    overflow: "hidden",
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

const gridStyle = (total) => {
    let cols = 1;
    if (total === 2) cols = 2;
    else if (total <= 4) cols = 2;
    else cols = 3;

    return {
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoRows: 'min-content',
        gap: '20px',
        padding: '32px',
        height: '100%',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        overflowY: 'auto',
        alignContent: 'center'
    };
};

const participantsSidebarStyle = {
    width: '280px',
    backgroundColor: '#0d1117',
    borderLeft: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    zIndex: 10
};

const sidebarHeaderStyle = {
    padding: '24px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
};

const sidebarTitleStyle = {
    margin: 0,
    fontSize: '11px',
    fontWeight: '800',
    color: 'var(--primary)',
    letterSpacing: '0.1em'
};

const participantsListStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '12px'
};

const participantItemStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: '8px',
    gap: '12px',
    border: '1px solid rgba(255,255,255,0.03)'
};

const avatarCircleStyle = {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    backgroundColor: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    color: 'white',
    textTransform: 'uppercase'
};

const participantNameStyle = {
    flex: 1,
    fontSize: '13px',
    fontWeight: '600',
    color: 'white',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
};

const participantStatusStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    opacity: 0.8
};

const videoTileStyle = (active) => ({
    borderRadius: "16px",
    overflow: "hidden",
    backgroundColor: "#161b22",
    aspectRatio: "16/9",
    border: active ? "3px solid var(--primary)" : "1px solid rgba(255,255,255,0.05)",
    boxShadow: active ? "0 0 20px rgba(59, 130, 246, 0.4)" : "0 8px 16px rgba(0,0,0,0.2)",
    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
    position: 'relative'
});

const videoElementStyle = { width: "100%", height: "100%", objectFit: "cover", transform: 'scale(1.01)' };
const avatarCenterStyle = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', color: 'rgba(255,255,255,0.1)' };
const tileOverlayStyle = { position: "absolute", bottom: "16px", left: "16px", pointerEvents: "none", zIndex: 5 };
const nameTagStyle = { backgroundColor: "rgba(13, 17, 23, 0.8)", backdropFilter: "blur(12px)", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "6px 14px", borderRadius: "8px", border: '1px solid rgba(255,255,255,0.1)' };
const controlDockWrapper = { position: "absolute", bottom: "40px", width: "100%", display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 100 };
const controlDock = { display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "24px", border: '1px solid rgba(255,255,255,0.1)', pointerEvents: "auto" };
const controlCircle = (active, color) => ({ width: "48px", height: "48px", borderRadius: "16px", backgroundColor: active ? (color || "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.05)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: 'all 0.2s' });

export default VideoChat;
