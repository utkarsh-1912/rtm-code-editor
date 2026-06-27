import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Video, VideoOff, Mic, MicOff, Maximize2, Minimize2,
    ScreenShare, ScreenShareOff, LogOut
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
    initialVideoState = true,
    isMobile = false
}) => {
    // --- State Management ---
    const [localStream, setLocalStream] = useState(null);
    const [remoteUsers, setRemoteUsers] = useState({}); // { socketId: { stream, name, isMuted, isVideoOff, isScreenSharing } }
    const [isMuted, setIsMuted] = useState(!initialAudioState);
    const [isVideoOff, setIsVideoOff] = useState(!initialVideoState);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [inCall, setInCall] = useState(false);
    const [activeSpeaker, setActiveSpeaker] = useState(null);

    const [pipPosition, setPipPosition] = useState({ x: window.innerWidth - 240, y: window.innerHeight - 200 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isHoveringMini, setIsHoveringMini] = useState(false);
    const page = 0;
    const pageSize = 6;

    // --- Refs for WebRTC & Audio ---
    const peersRef = useRef({}); // { socketId: RTCPeerConnection }
    const screenStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analysersRef = useRef({}); // { socketId: AnalyserNode }
    const pendingCandidatesRef = useRef({}); // Bug 2: ICE candidate queue per peer

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

    // --- Core Media Logic (Defined first for hoisting) ---
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

    const handleJoinCall = useCallback(async () => {
        if (!socketRef.current || inCall) return;

        try {
            if (user?.isGuest) {
                setInCall(true);
                onCallStateChange(true);
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
            onCallStateChange(true);

            if (initialAudioState) {
                setupAudioAnalysis(stream, 'local');
            }

            socketRef.current.emit('join-video-chat', {
                projectId,
                userId: socketRef.current.id,
                name: user?.name || socketRef.current.userName,
                isSpectator: false
            });

            // Immediate broadcast of current state
            broadcastMediaState({ isMuted, isVideoOff });

        } catch (err) {
            console.error("Camera access denied", err);
            toast.error("Please enable camera & microphone to join.");
        }
    }, [projectId, socketRef, user, setupAudioAnalysis, initialAudioState, initialVideoState, onCallStateChange, inCall, broadcastMediaState, isMuted, isVideoOff]);

    const handleToggleVideo = useCallback(async (e) => {
        if (e) e.stopPropagation();

        const videoTrack = localStream?.getVideoTracks()[0];

        if (!isVideoOff) {
            // Turning OFF
            if (videoTrack) {
                videoTrack.enabled = false;
                videoTrack.stop();
            }
            setIsVideoOff(true);
            broadcastMediaState({ isVideoOff: true });
        } else {
            // Turning ON
            if (!inCall) {
                handleJoinCall();
                return;
            }
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720, frameRate: 30 }
                });
                const newTrack = newStream.getVideoTracks()[0];

                let updatedStream = localStream;
                if (!updatedStream) {
                    updatedStream = new MediaStream();
                }

                if (videoTrack) {
                    updatedStream.removeTrack(videoTrack);
                }
                updatedStream.addTrack(newTrack);

                setLocalStream(new MediaStream(updatedStream.getTracks()));

                Object.values(peersRef.current).forEach(peer => {
                    const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(newTrack);
                    } else {
                        peer.addTrack(newTrack, updatedStream);
                    }
                });

                setIsVideoOff(false);
                broadcastMediaState({ isVideoOff: false });
            } catch (err) {
                console.error("Failed to restart camera", err);
                toast.error("Could not restart camera");
            }
        }
    }, [isVideoOff, localStream, broadcastMediaState, inCall, handleJoinCall]);


    const handleToggleAudio = useCallback(async (e) => {
        if (e) e.stopPropagation();

        let audioTrack = localStream?.getAudioTracks()[0];

        if (!isMuted) {
            // Muting
            if (audioTrack) {
                audioTrack.enabled = false;
            }
            setIsMuted(true);
            broadcastMediaState({ isMuted: true });
        } else {
            // Unmuting
            if (!inCall) {
                handleJoinCall();
                return;
            }
            if (!audioTrack) {
                // Track doesn't exist (joined muted natively), need to get it
                try {
                    const newAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    audioTrack = newAudioStream.getAudioTracks()[0];

                    let updatedStream = localStream;
                    if (!updatedStream) {
                        updatedStream = new MediaStream();
                    }
                    updatedStream.addTrack(audioTrack);
                    setLocalStream(new MediaStream(updatedStream.getTracks()));

                    Object.values(peersRef.current).forEach(peer => {
                        const sender = peer.getSenders().find(s => s.track && s.track.kind === 'audio');
                        if (sender) {
                            sender.replaceTrack(audioTrack);
                        } else {
                            peer.addTrack(audioTrack, updatedStream);
                        }
                    });

                    setupAudioAnalysis(updatedStream, 'local');
                } catch (err) {
                    console.error("Failed to get microphone", err);
                    toast.error("Could not access microphone");
                    return;
                }
            } else {
                audioTrack.enabled = true;
            }

            setIsMuted(false);
            broadcastMediaState({ isMuted: false });
        }
    }, [isMuted, localStream, broadcastMediaState, setupAudioAnalysis, inCall, handleJoinCall]);

    // --- WebRTC Core Functions ---


    const createPeer = useCallback((targetSocketId, name, stream) => {
        const peer = new RTCPeerConnection({
            // Bug 3: Added STUN + Open TURN relay for NAT traversal reliability
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
            ],
            iceTransportPolicy: 'all',
        });

        // Bug 2: Initialize candidate queue for this peer
        if (!pendingCandidatesRef.current[targetSocketId]) {
            pendingCandidatesRef.current[targetSocketId] = [];
        }

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


    const handleLeaveCall = useCallback(() => {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());

        Object.values(peersRef.current).forEach(p => p.close());
        peersRef.current = {};
        analysersRef.current = {};

        setLocalStream(null);
        setRemoteUsers({});
        setInCall(false);
        onCallStateChange(false);
        setIsScreenSharing(false);
        setActiveSpeaker(null);

        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }

        if (socketRef.current) {
            socketRef.current.emit('leave-video-chat', { projectId });
        }
    }, [localStream, projectId, socketRef, onCallStateChange]);

    const hasAutoJoinedRef = useRef(false);

    useEffect(() => {
        if (!inCall && !hasAutoJoinedRef.current) {
            hasAutoJoinedRef.current = true;
            handleJoinCall();
        }
    }, [inCall, handleJoinCall]);

    useEffect(() => {
        if (externalInCall && !inCall && hasAutoJoinedRef.current) {
            // Already handled by auto-join or should be joined
        } else if (!externalInCall && inCall) {
            handleLeaveCall();
        }
    }, [externalInCall, inCall, handleLeaveCall]);

    // Cleanup camera tracks faithfully on hard unmounts (e.g Sidebar routing to Dashboard)
    useEffect(() => {
        const currentSocket = socketRef.current;
        return () => {
            if (localStream) {
                localStream.getTracks().forEach(t => t.stop());
            }
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(t => t.stop());
            }
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => {});
            }
            if (currentSocket) {
                currentSocket.emit('leave-video-chat', { projectId });
            }
            Object.values(peersRef.current).forEach(peer => peer.close());
            peersRef.current = {};
        };
    }, [localStream, projectId, socketRef]);


    // --- Socket Signaling Handlers ---
    useEffect(() => {
        if (!socketRef.current) return;
        const socket = socketRef.current;

        const onUserJoined = async ({ userId, name, isSpectator }) => {
            if (userId === socket.id) return;
            // Spectators don't show joined toast, they just join the mesh
            if (isSpectator) {
                console.log(`${name} is watching`);
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

                // Bug 2: Drain buffered ICE candidates now that remote description is set
                const pending = pendingCandidatesRef.current[from] || [];
                for (const candidate of pending) {
                    try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { }
                }
                pendingCandidatesRef.current[from] = [];

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
                    // Bug 2: Drain buffered ICE candidates now that remote description is set
                    const pending = pendingCandidatesRef.current[from] || [];
                    for (const candidate of pending) {
                        try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { }
                    }
                    pendingCandidatesRef.current[from] = [];
                } catch (err) { console.error("Set remote description error", err); }
            }
        };

        const onIceCandidate = async ({ from, candidate }) => {
            const peer = peersRef.current[from];
            if (!peer) return;
            // Bug 2: If remote description not yet set, buffer the candidate
            if (!peer.remoteDescription || !peer.remoteDescription.type) {
                if (!pendingCandidatesRef.current[from]) pendingCandidatesRef.current[from] = [];
                pendingCandidatesRef.current[from].push(candidate);
            } else {
                try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (err) { }
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

            if (currentSpeaker !== activeSpeaker) {
                setActiveSpeaker(currentSpeaker);
                // "You are muted" speaking detection
                if (currentSpeaker === 'local' && isMuted) {
                    toast("You are muted. Click the microphone to unmute.", {
                        id: 'mute-warning',
                        icon: '🔇',
                        duration: 3000
                    });
                }
            }
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
    const allParticipants = [
        ...(!user?.isGuest ? [{ id: 'local', isLocal: true }] : []),
        ...Object.entries(remoteUsers).map(([id, data]) => ({ id, ...data }))
    ];

    const paginatedParticipants = allParticipants.slice(page * pageSize, (page + 1) * pageSize);


    if (!inCall) {
        return (
            <div
                className="glass-panel"
                style={isMobile ? {
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    left: 0,
                    top: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--bg-card)',
                    border: 'none',
                    borderRadius: 0
                } : {
                    ...minimizedOverlayStyle,
                    left: `${pipPosition.x}px`,
                    top: `${pipPosition.y}px`,
                    bottom: 'auto',
                    right: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--primary)',
                    borderRadius: '12px',
                    width: '240px',
                    height: '140px'
                }}
            >
                <div style={{ color: 'var(--primary)', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '12px', height: '12px',
                        border: '2px solid var(--primary)',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    Connecting Call...
                </div>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    const width = isMinimized ? 240 : 480;
    const height = isMinimized ? 160 : 320;

    return (
        <div
            className="glass-panel"
            style={isMobile ? {
                width: '100%',
                height: '100%',
                position: 'relative',
                left: 0,
                top: 0,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#000',
                border: 'none',
                borderRadius: 0,
                overflow: 'hidden'
            } : {
                ...minimizedOverlayStyle,
                width: `${width}px`,
                height: `${height}px`,
                left: `${pipPosition.x}px`,
                top: `${pipPosition.y}px`,
                bottom: 'auto',
                right: 'auto',
                border: isDragging ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                scale: isDragging ? '1.02' : '1',
                transition: isDragging ? 'none' : 'scale 0.2s, border 0.2s, width 0.3s, height 0.3s'
            }}
            onMouseDown={isMobile ? undefined : startDragging}
            onMouseEnter={isMobile ? undefined : () => setIsHoveringMini(true)}
            onMouseLeave={isMobile ? undefined : () => setIsHoveringMini(false)}
        >
            {isMinimized ? (
                // Minimized: Show active speaker
                <div style={minifiedGridStyle}>
                    {activeSpeaker === 'local' || !activeSpeaker ? (
                        isVideoOff ? (
                            <div style={avatarCenterStyle}>
                                <div style={avatarCircle(48)}>
                                    {(user?.name || socketRef.current?.userName || 'U')[0].toUpperCase()}
                                </div>
                            </div>
                        ) : (
                            <video ref={(el) => { if (el) el.srcObject = localStream }} autoPlay muted playsInline style={miniVideoElement} />
                        )
                    ) : (
                        <RemoteVideo user={remoteUsers[activeSpeaker]} isMini />
                    )}
                </div>
            ) : (
                // Expanded Grid View: Show all participants in a neat layout
                <div style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: paginatedParticipants.length <= 1 ? '1fr' : '1fr 1fr',
                    gridTemplateRows: paginatedParticipants.length <= 2 ? '1fr' : '1fr 1fr',
                    gap: '6px',
                    padding: '6px',
                    backgroundColor: '#000',
                    overflow: 'hidden',
                    height: '100%'
                }}>
                    {paginatedParticipants.map((p) => (
                        <div key={p.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#1f2937' }}>
                            {p.isLocal ? (
                                isVideoOff ? (
                                    <div style={avatarCenterStyle}>
                                        <div style={avatarCircle(32)}>
                                            {(user?.name || socketRef.current?.userName || 'U')[0].toUpperCase()}
                                        </div>
                                    </div>
                                ) : (
                                    <video ref={(el) => { if (el) el.srcObject = localStream }} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                )
                            ) : (
                                <RemoteVideo user={p} isMini />
                            )}
                            <div style={{
                                position: 'absolute', bottom: '6px', left: '6px',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                backgroundColor: 'rgba(0,0,0,0.65)', padding: '4px 8px',
                                borderRadius: '6px', fontSize: '10px', color: 'white',
                                border: '1px solid rgba(255,255,255,0.08)', zIndex: 10
                            }}>
                                {p.isLocal ? (
                                    isMuted ? <MicOff size={10} color="#ef4444" /> : <Mic size={10} color="#10b981" />
                                ) : (
                                    p.isMuted ? <MicOff size={10} color="#ef4444" /> : <Mic size={10} color="#10b981" />
                                )}
                                <span style={{ fontWeight: '600' }}>{p.isLocal ? 'You' : p.name || 'Participant'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Hover Controls Overlay */}
            <div
                onMouseDown={(e) => e.stopPropagation()} // Prevent dragging when clicking controls!
                style={{
                    ...miniControls,
                    opacity: isHoveringMini || isDragging ? 1 : 0,
                    transform: isHoveringMini || isDragging ? 'translate(-50%, 0) scale(1)' : 'translate(-50%, 12px) scale(0.92)',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    pointerEvents: isHoveringMini ? 'auto' : 'none'
                }}
            >
                <button
                    style={{ ...miniBtn, color: isMuted ? '#ef4444' : 'white' }}
                    onClick={handleToggleAudio}
                    title={isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                    {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
                </button>
                <button
                    style={{ ...miniBtn, color: isVideoOff ? '#ef4444' : 'white' }}
                    onClick={handleToggleVideo}
                    title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                >
                    {isVideoOff ? <VideoOff size={13} /> : <Video size={13} />}
                </button>
                {!user?.isGuest && (
                    <button
                        style={{ ...miniBtn, color: isScreenSharing ? '#10b981' : 'white' }}
                        onClick={toggleScreenShare}
                        title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                    >
                        {isScreenSharing ? <ScreenShareOff size={13} /> : <ScreenShare size={13} />}
                    </button>
                )}
                <button
                    style={miniBtn}
                    onClick={(e) => { e.stopPropagation(); onMinimizeToggle(!isMinimized); }}
                    title={isMinimized ? "Grid View" : "Minimize View"}
                >
                    {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                </button>
                <button
                    style={{ ...miniBtn, backgroundColor: '#ef4444', color: 'white' }}
                    onClick={(e) => { e.stopPropagation(); handleLeaveCall(); }}
                    title="Leave Call"
                >
                    <LogOut size={13} />
                </button>
            </div>
        </div>);
}

const RemoteVideo = ({ user, isMini }) => {
    const videoRef = useRef();
    useEffect(() => {
        if (videoRef.current && user?.stream) {
            videoRef.current.srcObject = user.stream;
        }
    }, [user?.stream]);

    if (!user) return null;

    return (
        <>
            {user.isVideoOff ? (
                <div style={avatarCenterStyle}>
                    <div style={avatarCircle(isMini ? 32 : 64)}>
                        {(user.userName || user.name || 'U')[0].toUpperCase()}
                    </div>
                </div>
            ) : (
                <video ref={videoRef} autoPlay playsInline style={isMini ? miniVideoElement : videoElementStyle} />
            )}
            {!isMini ? (
                <div style={tileOverlayStyle}>
                    <div style={nameTagStyle(user.isMuted)}>
                        {user.isMuted ? <MicOff size={14} color="#ef4444" /> : <Mic size={14} color="#10b981" />}
                        <span>{user.name || "Participant"}</span>
                    </div>
                </div>
            ) : (
                user.isMuted && (
                    <div style={miniMuteIcon}>
                        <MicOff size={10} color="white" />
                    </div>
                )
            )}
        </>
    );
};

// --- Styles ---


const minimizedOverlayStyle = {
    position: 'fixed', bottom: '80px', right: '24px', width: '240px', height: '160px',
    borderRadius: '20px', zIndex: 9999, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 50px rgba(0,0,0,0.6)', cursor: 'move', userSelect: 'none',
    border: '2px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)'
};

const minifiedGridStyle = { flex: 1, backgroundColor: '#000', position: 'relative' };
const miniVideoElement = { width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' };
const miniControls = {
    position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
    display: 'flex', gap: '8px', padding: '8px', borderRadius: '14px',
    backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.15)', zIndex: 2
};
const miniBtn = { width: '28px', height: '28px', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' };



const avatarCircle = (size) => ({
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: size > 40 ? '24%' : '10px',
    background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${size / 2.5}px`,
    fontWeight: '800',
    color: 'white',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
});



const videoElementStyle = { width: "100%", height: "100%", objectFit: "cover" };
const avatarCenterStyle = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' };
const tileOverlayStyle = { position: "absolute", bottom: "18px", left: "18px", pointerEvents: "none", zIndex: 5 };
const nameTagStyle = (muted) => ({
    display: 'flex', alignItems: 'center', gap: '8px',
    backgroundColor: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(12px)",
    color: "#fff", fontSize: "12px", fontWeight: "700", padding: "8px 16px",
    borderRadius: "12px", border: muted ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255,255,255,0.12)"
});


const miniMuteIcon = { position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: '5px', borderRadius: '50%', zIndex: 10, boxShadow: '0 4px 8px rgba(0,0,0,0.3)' };


export default VideoChat;
