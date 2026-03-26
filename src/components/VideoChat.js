import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Video, VideoOff, Mic, MicOff, Maximize2, Minimize2,
    ChevronDown, User, ScreenShare, ScreenShareOff, LogOut, Radio, StopCircle
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
    const [isStreaming, setIsStreaming] = useState(false);
    const [rtmpKey, setRtmpKey] = useState('');
    const [showStreamModal, setShowStreamModal] = useState(false);
    const mediaRecorderRef = useRef(null);
    const [pipPosition, setPipPosition] = useState({ x: window.innerWidth - 240, y: window.innerHeight - 200 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isHoveringMini, setIsHoveringMini] = useState(false);
    const [page, setPage] = useState(0);
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
    const startStreaming = useCallback(() => {
        if (!localStream || !rtmpKey) return;
        
        try {
            const options = { mimeType: 'video/webm; codecs=vp8,opus' };
            const recorder = new MediaRecorder(localStream, options);
            mediaRecorderRef.current = recorder;

            socketRef.current.emit(ACTIONS.START_STREAMING, {
                projectId,
                rtmpKey,
                platform: rtmpKey.startsWith('rtmp://a.rtmp.youtube.com') ? 'youtube' : 'twitch'
            });

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    socketRef.current.emit(ACTIONS.STREAM_DATA, {
                        projectId,
                        chunk: event.data
                    });
                }
            };

            recorder.start(1000); // 1-second chunks
            setIsStreaming(true);
            setShowStreamModal(false);
            toast.success("Streaming started!");
        } catch (err) {
            console.error("Streaming error:", err);
            toast.error("Failed to start streaming. Browser might not support this format.");
        }
    }, [localStream, rtmpKey, projectId, socketRef]);

    const stopStreaming = useCallback(() => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }
        socketRef.current.emit(ACTIONS.STOP_STREAMING, { projectId });
        setIsStreaming(false);
        toast("Streaming stopped.");
    }, [projectId, socketRef]);

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
    const totalPeople = allParticipants.length;
    const paginatedParticipants = allParticipants.slice(page * pageSize, (page + 1) * pageSize);
    const totalPages = Math.ceil(totalPeople / pageSize);

    if (!inCall) {
        if (isMinimized) {
            return (
                <div style={{ ...minimizedOverlayStyle, left: `${pipPosition.x}px`, top: `${pipPosition.y}px`, bottom: 'auto', right: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', border: '1px solid var(--primary)', borderRadius: '12px' }}>
                    <div style={{ color: 'var(--primary)', fontSize: '10px', fontWeight: 'bold' }}>JOINING...</div>
                </div>
            );
        }
        return (
            <div style={{ ...containerStyle(isExpanded), display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ 
                        width: '80px', height: '80px', borderRadius: '50%', 
                        background: 'linear-gradient(135deg, var(--primary), #a855f7)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        margin: '0 auto 24px',
                        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)'
                    }}>
                        <Video size={40} color="white" />
                    </div>
                    <h2 style={{ color: 'white', marginBottom: '12px', fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em' }}>
                        Joining Video Conference...
                    </h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '300px', lineHeight: '1.6', margin: '0 auto' }}>
                        Connecting you to the room and requesting media access.
                    </p>
                </div>
            </div>
        );
    }

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
                        onClick={handleToggleVideo}
                        title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                    >
                        {isVideoOff ? <VideoOff size={12} /> : <Video size={12} />}
                    </button>
                    <button
                        style={{ ...miniBtn, color: isMuted ? '#ef4444' : 'white' }}
                        onClick={handleToggleAudio}
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
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                        <div style={gridStyle(paginatedParticipants.length)}>
                            {paginatedParticipants.map((p) => (
                                <div key={p.id} style={{ ...videoTileStyle(activeSpeaker === p.id), position: 'relative' }}>
                                    {p.isLocal ? (
                                        <>
                                            {isVideoOff ? (
                                                <div style={avatarCenterStyle}>
                                                    <div style={avatarCircle(64)}>
                                                        {(user?.name || socketRef.current?.userName || 'U')[0].toUpperCase()}
                                                    </div>
                                                </div>
                                            ) : (
                                                <video ref={(el) => { if (el) el.srcObject = localStream }} autoPlay muted playsInline style={videoElementStyle} />
                                            )}
                                            <div style={tileOverlayStyle}>
                                                <div style={nameTagStyle(isMuted)}>
                                                    {isMuted ? <MicOff size={14} color="#ef4444" /> : <Mic size={14} color="#10b981" />}
                                                    <span>You</span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <RemoteVideo user={p} />
                                    )}
                                </div>
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div style={paginationWrapper}>
                                {[...Array(totalPages)].map((_, i) => (
                                    <div
                                        key={i}
                                        onClick={() => setPage(i)}
                                        style={paginationDot(page === i)}
                                    />
                                ))}
                            </div>
                        )}

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
                                                <div style={avatarCircle(32)}>
                                                    {(client.userName || client.name || 'U')[0].toUpperCase()}
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
                        <div style={controlDock}>
                            {!user?.isGuest && (
                                <>
                                    <button style={controlCircle(isMuted, '#ef4444')} onClick={handleToggleAudio} title={isMuted ? "Unmute" : "Mute"}>
                                        {isMuted ? <MicOff size={20} color="white" /> : <Mic size={20} color="white" />}
                                    </button>
                                    <button style={controlCircle(isVideoOff, '#ef4444')} onClick={handleToggleVideo} title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}>
                                        {isVideoOff ? <VideoOff size={20} color="white" /> : <Video size={20} color="white" />}
                                    </button>
                                    <button style={controlCircle(isScreenSharing, 'var(--primary)')} onClick={toggleScreenShare} title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
                                        {isScreenSharing ? <ScreenShareOff size={20} color="white" /> : <ScreenShare size={20} color="white" />}
                                    </button>
                                </>
                            )}
                            <div style={dividerStyle} />
                            <button style={controlCircle(false)} onClick={() => onMinimizeToggle(true)} title="Minimize">
                                <ChevronDown size={20} color="white" />
                            </button>
                            <button style={controlCircle(false)} onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? "Collapse" : "Expand"}>
                                {isExpanded ? <Minimize2 size={20} color="white" /> : <Maximize2 size={20} color="white" />}
                            </button>
                            <button 
                                style={controlCircle(isStreaming, '#3b82f6')} 
                                onClick={isStreaming ? stopStreaming : () => setShowStreamModal(true)} 
                                title={isStreaming ? "Stop Streaming" : "Go Live"}
                            >
                                {isStreaming ? <StopCircle size={20} color="white" /> : <Radio size={20} color="white" />}
                            </button>
                            <button style={controlCircle(true, '#ef4444')} onClick={handleLeaveCall} title="Leave Meeting">
                                <LogOut size={20} color="white" />
                            </button>
                        </div>
                    </div>

                    {showStreamModal && (
                        <div style={modalOverlay}>
                            <div className="glass-panel" style={modalContent}>
                                <h3 style={{ margin: '0 0 16px', color: 'white' }}>Stream Setup</h3>
                                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
                                    Enter your RTMP URL + Stream Key (e.g. rtmp://a.rtmp.youtube.com/live2/XXXX)
                                </p>
                                <input 
                                    style={inputStyle}
                                    type="text" 
                                    placeholder="RTMP Endpoint / Key" 
                                    value={rtmpKey}
                                    onChange={(e) => setRtmpKey(e.target.value)}
                                />
                                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                                    <button style={cancelBtn} onClick={() => setShowStreamModal(false)}>Cancel</button>
                                    <button style={startBtn} onClick={startStreaming}>Go Live</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

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
const containerStyle = (isExpanded) => ({
    backgroundColor: "#0d1117",
    height: isExpanded ? "100%" : "400px",
    display: "flex", flexDirection: "column",
    transition: "height 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    position: "relative", overflow: "hidden",
});

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

const callWorkspaceStyle = { flex: 1, display: "flex", flexDirection: "column", position: 'relative' };

const gridStyle = (count) => {
    let cols = 1;
    if (count === 2) cols = 2;
    else if (count <= 4) cols = 2;
    else cols = 3;

    return {
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoRows: count > 2 ? '1fr' : 'auto',
        gap: '20px',
        padding: '30px',
        flex: 1,
        width: '100%',
        height: '100%',
        margin: '0 auto',
        overflow: 'hidden',
        alignContent: 'center'
    };
};

const participantsSidebarStyle = {
    width: '300px',
    backgroundColor: 'rgba(13, 17, 23, 0.8)',
    backdropFilter: 'blur(20px)',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    zIndex: 10
};

const sidebarHeaderStyle = {
    padding: '28px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
};

const sidebarTitleStyle = {
    margin: 0,
    fontSize: '12px',
    fontWeight: '800',
    color: 'var(--primary)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
};

const participantsListStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px'
};

const participantItemStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '14px',
    borderRadius: '16px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: '10px',
    gap: '14px',
    border: '1px solid rgba(255,255,255,0.05)',
    transition: 'transform 0.2s ease'
};

const avatarCircle = (size) => ({
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: size > 40 ? '24%' : '10px',
    background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${size/2.5}px`,
    fontWeight: '800',
    color: 'white',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
});

const participantNameStyle = {
    flex: 1,
    fontSize: '14px',
    fontWeight: '600',
    color: '#f1f5f9',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
};

const participantStatusStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    opacity: 0.9
};

const videoTileStyle = (active) => ({
    borderRadius: "24px",
    overflow: "hidden",
    backgroundColor: "#1e293b",
    aspectRatio: "16/9",
    border: active ? "3px solid var(--primary)" : "1px solid rgba(255,255,255,0.08)",
    boxShadow: active ? "0 0 30px rgba(59, 130, 246, 0.5)" : "0 12px 24px rgba(0,0,0,0.3)",
    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    position: 'relative'
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

const controlDockWrapper = { position: "absolute", bottom: "40px", width: "100%", display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 100 };
const controlDock = {
    display: "flex", alignItems: "center", gap: "10px", padding: "10px",
    borderRadius: "24px", backgroundColor: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(16px)",
    border: '1px solid rgba(255,255,255,0.15)', pointerEvents: "auto",
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
};

const controlCircle = (active, color) => ({
    width: "44px", height: "44px", borderRadius: "14px",
    backgroundColor: active ? (color || "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.08)",
    color: "#fff", border: "none", cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center", transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    transform: active ? 'scale(1.05)' : 'scale(1)'
});

const dividerStyle = { width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 4px' };
const miniMuteIcon = { position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: '5px', borderRadius: '50%', zIndex: 10, boxShadow: '0 4px 8px rgba(0,0,0,0.3)' };
const paginationWrapper = { position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10 };
const paginationDot = (active) => ({
    width: '10px', height: '10px', borderRadius: '50%',
    backgroundColor: active ? 'var(--primary)' : 'rgba(255,255,255,0.25)',
    cursor: 'pointer', transition: 'all 0.3s',
    transform: active ? 'scale(1.3)' : 'scale(1)'
});

const modalOverlay = { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent = { width: '400px', padding: '30px', borderRadius: '24px', backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)' };
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '14px' };
const cancelBtn = { flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: 'white', cursor: 'pointer' };
const startBtn = { flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '700', cursor: 'pointer' };

export default VideoChat;
