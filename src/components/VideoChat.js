import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Video, VideoOff, Mic, MicOff, Maximize2, Maximize, Minimize, Minus,
    ScreenShare, ScreenShareOff, PhoneOff, Pencil, Eraser, Expand, Shrink,
    Pin, PinOff, LayoutGrid, PanelTop, GripHorizontal
} from 'lucide-react';
import { Avatar } from './clients';
import CallAnnotations from './CallAnnotations';
import toast from 'react-hot-toast';
import ACTIONS from '../Action';

// Camera sized for a mesh call: plenty for a tile, a fraction of 720p30's bandwidth.
const CAM = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } };
const MIC = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const SCREEN = { video: { frameRate: { ideal: 15, max: 30 } }, audio: true };

// STUN plus TURN. Set REACT_APP_TURN_URL / _USERNAME / _CREDENTIAL for your own relay;
// the public Open Relay is only a fallback.
const ICE_SERVERS = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ...(process.env.REACT_APP_TURN_URL
        ? [{ urls: process.env.REACT_APP_TURN_URL.split(','), username: process.env.REACT_APP_TURN_USERNAME, credential: process.env.REACT_APP_TURN_CREDENTIAL }]
        : [{ urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'], username: 'openrelayproject', credential: 'openrelayproject' }]),
];

// Per-peer video budget: every extra person in the mesh means another upload of our video.
const videoBitrate = (peerCount, screen) => (screen ? 1500000 : peerCount <= 1 ? 1200000 : peerCount <= 3 ? 700000 : 350000);

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
    const [isDrawing, setIsDrawing] = useState(false);
    const [isLarge, setIsLarge] = useState(false);

    const [pipPosition, setPipPosition] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('call-pos'));
            if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
        } catch { /* storage blocked */ }
        return { x: window.innerWidth - 540, y: window.innerHeight - 420 };
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // --- Refs for WebRTC & Audio ---
    const peersRef = useRef({}); // { socketId: RTCPeerConnection }
    const screenStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analysersRef = useRef({}); // { socketId: AnalyserNode }
    const pendingCandidatesRef = useRef({}); // Bug 2: ICE candidate queue per peer
    const localStreamRef = useRef(null);
    useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

    // Cap each video sender's bitrate for the current call size and content.
    const tuneSenders = useCallback((screen = mediaStateRef.current.isScreenSharing) => {
        const peers = Object.values(peersRef.current);
        const max = videoBitrate(peers.length, screen);
        peers.forEach((peer) => {
            peer.getSenders().forEach((sender) => {
                if (!sender.track || sender.track.kind !== 'video' || !sender.getParameters) return;
                const params = sender.getParameters();
                if (!params.encodings || !params.encodings.length) params.encodings = [{}];
                params.encodings[0].maxBitrate = max;
                params.encodings[0].maxFramerate = screen ? 15 : 24;
                params.degradationPreference = screen ? 'maintain-resolution' : 'balanced';
                sender.setParameters(params).catch(() => { });
            });
        });
    }, []);

    const mediaStateRef = useRef({ isMuted, isVideoOff, isScreenSharing });
    const remoteUsersRef = useRef({});
    useEffect(() => { remoteUsersRef.current = remoteUsers; }, [remoteUsers]);
    useEffect(() => {
        mediaStateRef.current = { isMuted, isVideoOff, isScreenSharing };
    }, [isMuted, isVideoOff, isScreenSharing]);

    // --- Media Action Helper ---
    const broadcastMediaState = useCallback((state) => {
        if (!socketRef.current) return;
        socketRef.current.emit(ACTIONS.MEDIA_STATE_CHANGE, {
            roomId: `call:${projectId}`,
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
                    video: CAM
                });
                const camTrack = newStream.getVideoTracks()[0];
                if ('contentHint' in camTrack) camTrack.contentHint = 'motion';

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
            tuneSenders(false);
            broadcastMediaState({ ...mediaStateRef.current, isScreenSharing: false });
        } catch (err) {
            console.error("Return to camera failed", err);
            toast.error("Could not restore camera");
            setIsScreenSharing(false);
            broadcastMediaState({ ...mediaStateRef.current, isScreenSharing: false });
        }
    }, [isVideoOff, localStream, broadcastMediaState, tuneSenders]);

    const toggleScreenShare = useCallback(async () => {
        if (!isScreenSharing) {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia(SCREEN);
                const screenTrack = screenStream.getVideoTracks()[0];
                if ('contentHint' in screenTrack) screenTrack.contentHint = 'detail';
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
                tuneSenders(true);
                broadcastMediaState({ ...mediaStateRef.current, isScreenSharing: true });

            } catch (err) {
                console.error("Screen share failed", err);
            }
        } else {
            await stopScreenShare();
        }
    }, [isScreenSharing, localStream, stopScreenShare, broadcastMediaState, tuneSenders]);

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

    const [joinError, setJoinError] = useState(null);

    // noDevices: join with no camera or mic (permission denied, no hardware, or by choice).
    const handleJoinCall = useCallback(async ({ noDevices = false } = {}) => {
        if (!socketRef.current || inCall) return;
        setJoinError(null);

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
            if (noDevices) {
                stream = new MediaStream();
                setIsMuted(true);
                setIsVideoOff(true);
            } else if (!initialVideoState && !initialAudioState) {
                // If both are false, avoid getUserMedia throwing an error. Create an empty stream.
                stream = new MediaStream();
            } else {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: initialVideoState ? CAM : false,
                    audio: initialAudioState ? MIC : false
                });
            }

            setLocalStream(stream);
            setInCall(true);
            onCallStateChange(true);

            if (initialAudioState && !noDevices) {
                setupAudioAnalysis(stream, 'local');
            }

            socketRef.current.emit('join-video-chat', {
                projectId,
                userId: socketRef.current.id,
                name: user?.name || socketRef.current.userName,
                isSpectator: false
            });

            // Immediate broadcast of current state
            broadcastMediaState(noDevices ? { isMuted: true, isVideoOff: true } : { isMuted, isVideoOff });

        } catch (err) {
            console.error("Camera access denied", err);
            const name = err?.name || '';
            setJoinError(
                name === 'NotAllowedError' || name === 'SecurityError' ? 'Camera and microphone are blocked for this site.'
                    : name === 'NotFoundError' ? 'No camera or microphone was found.'
                        : name === 'NotReadableError' ? 'Your camera or microphone is in use by another app.'
                            : 'Could not start your camera or microphone.'
            );
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
                    video: CAM
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
                    const newAudioStream = await navigator.mediaDevices.getUserMedia({ audio: MIC });
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
        const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 2 });

        // Recover from dropped networks (Wi-Fi to mobile, VPN changes) with an ICE restart.
        peer.onconnectionstatechange = async () => {
            if (peer.connectionState !== 'failed' || !socketRef.current) return;
            try {
                peer.restartIce?.();
                const offer = await peer.createOffer({ iceRestart: true });
                await peer.setLocalDescription(offer);
                socketRef.current.emit('video-offer', { to: targetSocketId, offer });
            } catch (e) { /* the peer will be re-created when they rejoin */ }
        };

        // Tracks added after the first handshake (camera or mic turned on later) need a new
        // offer. The first offer/answer is sent explicitly, so only renegotiate after it.
        peer.onnegotiationneeded = async () => {
            if (!peer.__negotiated || peer.signalingState !== 'stable' || !socketRef.current) return;
            try {
                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                socketRef.current.emit('video-offer', { to: targetSocketId, offer });
            } catch (e) { /* next change retries */ }
        };

        // Bug 2: Initialize candidate queue for this peer
        if (!pendingCandidatesRef.current[targetSocketId]) {
            pendingCandidatesRef.current[targetSocketId] = [];
        }

        if (stream) {
            stream.getTracks().forEach(track => peer.addTrack(track, stream));
        }
        setTimeout(() => tuneSenders(), 0);

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
    }, [socketRef, setupAudioAnalysis, tuneSenders]);


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

    // Release camera, mic and connections when the call UI unmounts. Uses refs so that
    // changing tracks (camera on/off, screen share) never tears down the call.
    useEffect(() => {
        const currentSocket = socketRef.current;
        return () => {
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            audioContextRef.current?.close().catch(() => { });
            currentSocket?.emit('leave-video-chat', { projectId });
            Object.values(peersRef.current).forEach(peer => peer.close());
            peersRef.current = {};
        };
    }, [projectId, socketRef]);


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
                        roomId: `call:${projectId}`,
                        state: mediaStateRef.current
                    });
                } catch (err) { console.error("Offer error", err); }
            } else {
                socket.emit('request-streams', { to: userId });
            }
        };

        const onVideoOffer = async ({ from, offer }) => {
            let peer = peersRef.current[from];
            if (!peer || peer.signalingState === 'closed') {
                peer = createPeer(from, remoteUsersRef.current[from]?.name || "User", localStream);
                peersRef.current[from] = peer;
            }

            try {
                await peer.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                socket.emit('video-answer', { to: from, answer });
                peer.__negotiated = true;

                // Bug 2: Drain buffered ICE candidates now that remote description is set
                const pending = pendingCandidatesRef.current[from] || [];
                for (const candidate of pending) {
                    try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { }
                }
                pendingCandidatesRef.current[from] = [];

                // Also broadcast our media state back so they have ours
                socket.emit(ACTIONS.MEDIA_STATE_CHANGE, {
                    roomId: `call:${projectId}`,
                    state: mediaStateRef.current
                });
            } catch (err) { console.error("Answer error", err); }
        };

        const onVideoAnswer = async ({ from, answer }) => {
            const peer = peersRef.current[from];
            if (peer) {
                try {
                    await peer.setRemoteDescription(new RTCSessionDescription(answer));
                    peer.__negotiated = true;
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
                setTimeout(() => tuneSenders(), 0);
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
    }, [localStream, socketRef, createPeer, projectId, tuneSenders]);

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

    // --- Window: drag by the title bar, position remembered per browser ---
    const rootRef = useRef(null);
    const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
    useEffect(() => {
        const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (!isDragging) return undefined;
        const move = (e) => setPipPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
        const up = () => {
            setIsDragging(false);
            setPipPosition((p) => {
                try { localStorage.setItem('call-pos', JSON.stringify(p)); } catch { /* storage blocked */ }
                return p;
            });
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
    }, [isDragging, dragOffset]);

    const startDragging = (e) => {
        if (isMobile || e.button !== 0 || e.target.closest('button')) return;
        e.preventDefault();
        setIsDragging(true);
        setDragOffset({ x: e.clientX - pipPosition.x, y: e.clientY - pipPosition.y });
    };

    // --- Call clock ---
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!inCall) { setElapsed(0); return undefined; }
        const started = Date.now();
        const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
        return () => clearInterval(id);
    }, [inCall]);
    const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

    // --- Layout ---
    const [layout, setLayout] = useState('grid'); // 'grid' | 'speaker'
    const [pinned, setPinned] = useState(null);
    const [fitStage, setFitStage] = useState(true); // contain (true) or fill the stage
    const [clearKey, setClearKey] = useState(0);
    const togglePin = (id) => {
        setPinned((cur) => (cur === id ? null : id));
        setLayout((l) => (pinned === id ? l : 'speaker'));
    };
    const toggleFullscreen = () => {
        const el = rootRef.current;
        if (!el) return;
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
        else el.requestFullscreen?.().catch(() => { });
    };

    const spectator = !!(user?.isGuest || user?.isSpectator);
    const myName = user?.name || socketRef.current?.userName || 'You';
    const photoFor = (id) => (id === 'local' ? user?.photoURL : clients.find((c) => c.socketId === id)?.photoURL) || null;
    const nameFor = (p) => (p.isLocal ? myName : p.name || clients.find((c) => c.socketId === p.id)?.userName || 'Participant');

    const allParticipants = [
        ...(!spectator ? [{ id: 'local', isLocal: true }] : []),
        ...Object.entries(remoteUsers).map(([id, data]) => ({ id, ...data })),
    ];
    const count = allParticipants.length;

    // Stage: a shared screen always wins; otherwise the pinned person, then whoever is talking.
    const sharer = allParticipants.find((p) => (p.isLocal ? isScreenSharing : p.isScreenSharing));
    const spotlight = sharer
        || (layout === 'speaker' && count > 1
            ? allParticipants.find((p) => p.id === pinned) || allParticipants.find((p) => p.id === activeSpeaker && !p.isLocal) || allParticipants.find((p) => !p.isLocal)
            : null);
    const strip = spotlight ? allParticipants.filter((p) => p.id !== spotlight.id) : [];

    const mutedOf = (p) => (p.isLocal ? isMuted : !!p.isMuted);
    const cameraOn = (p) => (p.isLocal ? (!isVideoOff || isScreenSharing) && !!localStream : (!p.isVideoOff || p.isScreenSharing) && !!p.stream);

    const renderTile = (p, variant) => {
        const stage = variant === 'stage';
        const presenting = stage && p.id === sharer?.id;
        const name = nameFor(p);
        const label = presenting ? (p.isLocal ? 'Your screen' : `${name}'s screen`) : p.isLocal ? `${name} (you)` : name;
        const avatarSize = variant === 'strip' || variant === 'mini' ? 34 : stage ? 84 : count > 4 ? 44 : 64;
        return (
            <div
                key={`${variant}-${p.id}`}
                className={`vc-tile vc-tile--${variant}${activeSpeaker === p.id && !mutedOf(p) ? ' is-speaking' : ''}${pinned === p.id ? ' is-pinned' : ''}`}
                onDoubleClick={() => !presenting && togglePin(p.id)}
            >
                {cameraOn(p) ? (
                    <StreamVideo
                        stream={p.isLocal ? localStream : p.stream}
                        muted={p.isLocal}
                        mirror={p.isLocal && !isScreenSharing}
                        fit={presenting ? (fitStage ? 'contain' : 'cover') : 'cover'}
                    />
                ) : (
                    <div className="vc-off">
                        <Avatar name={name} photoURL={photoFor(p.id)} size={avatarSize} />
                        {!p.isLocal && !p.stream && p.isVideoOff === undefined && variant !== 'strip' && <span className="vc-sub">Connecting…</span>}
                    </div>
                )}
                <div className="vc-tag">
                    {mutedOf(p) ? <MicOff size={12} className="vc-red" /> : <Mic size={12} />}
                    <span>{label}</span>
                </div>
                {variant === 'grid' && count > 1 && (
                    <button className="vc-pin" onClick={() => togglePin(p.id)} title={pinned === p.id ? 'Unpin' : 'Pin to spotlight'} aria-label={pinned === p.id ? `Unpin ${name}` : `Pin ${name}`}>
                        {pinned === p.id ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>
                )}
                {presenting && (
                    <CallAnnotations socketRef={socketRef} projectId={projectId} drawing={isDrawing} userName={user?.name} clearKey={clearKey} />
                )}
            </div>
        );
    };

    const renderBody = () => {
        if (isMinimized) {
            const p = allParticipants.find((x) => x.id === (sharer?.id || activeSpeaker)) || allParticipants.find((x) => !x.isLocal) || allParticipants[0];
            return <div className="vc-body vc-body--mini">{p && renderTile(p, 'mini')}</div>;
        }
        if (spotlight) {
            const presenting = spotlight.id === sharer?.id;
            return (
                <div className="vc-body vc-body--stage">
                    <div className="vc-stage">
                        {presenting && (
                            <div className="vc-banner">
                                <span className="vc-live-dot" />
                                <span>{spotlight.isLocal ? "You're presenting" : `${nameFor(spotlight)} is presenting`}</span>
                                <span className="vc-banner-actions">
                                    <button className={isDrawing ? 'on' : ''} onClick={() => setIsDrawing((d) => !d)} title="Draw on the shared screen. Everyone sees it; strokes fade.">
                                        <Pencil size={13} /> {isDrawing ? 'Drawing' : 'Draw'}
                                    </button>
                                    {isDrawing && <button onClick={() => setClearKey((k) => k + 1)} title="Clear drawings for everyone"><Eraser size={13} /> Clear</button>}
                                    <button onClick={() => setFitStage((f) => !f)} title={fitStage ? 'Fill the stage' : 'Fit the whole screen'}>
                                        {fitStage ? <Maximize size={13} /> : <Minimize size={13} />} {fitStage ? 'Fill' : 'Fit'}
                                    </button>
                                    {spotlight.isLocal && <button className="vc-stop" onClick={toggleScreenShare}><ScreenShareOff size={13} /> Stop presenting</button>}
                                </span>
                            </div>
                        )}
                        {renderTile(spotlight, 'stage')}
                    </div>
                    {strip.length > 0 && <div className="vc-strip">{strip.map((p) => renderTile(p, 'strip'))}</div>}
                </div>
            );
        }
        const cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;
        return (
            <div className="vc-body vc-body--grid" style={{ '--cols': cols }}>
                {allParticipants.map((p) => renderTile(p, 'grid'))}
                {count === 1 && !spectator && (
                    <div className="vc-alone">Waiting for others to join. They join from the call button in this room.</div>
                )}
            </div>
        );
    };

    // --- Joining ---
    if (!inCall) {
        return (
            <div className={`vc vc--joining${isMobile ? ' vc--mobile' : ''}`} style={isMobile ? undefined : { left: Math.max(8, Math.min(pipPosition.x, viewport.w - 300)), top: Math.max(8, Math.min(pipPosition.y, viewport.h - 190)) }}>
                {joinError ? (
                    <div className="vc-joining">
                        <VideoOff size={22} className="vc-red" aria-hidden="true" />
                        <strong>Can't use your camera</strong>
                        <span className="vc-sub">{joinError} You can still join, listen and watch, and turn devices on later.</span>
                        <div className="vc-join-actions">
                            <button className="vc-btn vc-btn--ghost vc-btn--primary" onClick={() => handleJoinCall({ noDevices: true })}>Join without camera or mic</button>
                            <button className="vc-btn vc-btn--ghost" onClick={() => handleJoinCall()}>Try again</button>
                            <button className="vc-btn vc-btn--ghost" onClick={() => onCallStateChange(false)}>Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="vc-joining">
                        <span className="vc-spinner" aria-hidden="true" />
                        <strong>Joining the call</strong>
                        <span className="vc-sub">Allow camera and microphone if your browser asks.</span>
                        <button className="vc-btn vc-btn--ghost" onClick={() => onCallStateChange(false)}>Cancel</button>
                    </div>
                )}
            </div>
        );
    }

    // --- Window size ---
    const size = isMinimized ? { w: 280, h: 176 }
        : isLarge ? { w: 1040, h: 680 }
            : spotlight ? { w: 800, h: 520 }
                : count > 4 ? { w: 640, h: 440 } : { w: 520, h: 380 };
    const width = Math.min(viewport.w - 16, size.w);
    const height = Math.min(viewport.h - 16, size.h);
    const left = Math.max(8, Math.min(pipPosition.x, viewport.w - width - 8));
    const top = Math.max(8, Math.min(pipPosition.y, viewport.h - height - 8));


    return (
        <div
            ref={rootRef}
            className={`vc${isMinimized ? ' vc--mini' : ''}${isMobile ? ' vc--mobile' : ''}${isDragging ? ' is-dragging' : ''}`}
            style={isMobile ? undefined : { width, height, left, top }}
            role="region"
            aria-label="Call"
        >
            {!isMinimized && (
                <header className="vc-head" onPointerDown={startDragging}>
                    {!isMobile && <GripHorizontal size={14} className="vc-grip" aria-hidden="true" />}
                    <span className="vc-live-dot" />
                    <strong>Call</strong>
                    <span className="vc-meta">{count} {count === 1 ? 'person' : 'people'} · {clock}</span>
                    <span className="vc-head-actions">
                        {count > 1 && !sharer && (
                            <button onClick={() => { setLayout((l) => (l === 'grid' ? 'speaker' : 'grid')); setPinned(null); }} title={layout === 'grid' ? 'Spotlight view' : 'Grid view'} aria-label={layout === 'grid' ? 'Spotlight view' : 'Grid view'}>
                                {layout === 'grid' ? <PanelTop size={15} /> : <LayoutGrid size={15} />}
                            </button>
                        )}
                        {!isMobile && (
                            <button onClick={() => setIsLarge((l) => !l)} title={isLarge ? 'Smaller' : 'Larger'} aria-label={isLarge ? 'Smaller window' : 'Larger window'}>
                                {isLarge ? <Shrink size={15} /> : <Expand size={15} />}
                            </button>
                        )}
                        <button onClick={toggleFullscreen} title="Full screen" aria-label="Full screen"><Maximize2 size={15} /></button>
                        {!isMobile && (
                            <button onClick={() => onMinimizeToggle(true)} title="Minimise" aria-label="Minimise call"><Minus size={15} /></button>
                        )}
                    </span>
                </header>
            )}

            {renderBody()}

            {isMinimized && (
                <div className="vc-mini-top" onPointerDown={startDragging}>
                    <span className="vc-live-dot" /> <span>{clock}</span>
                    <button onClick={() => onMinimizeToggle(false)} title="Expand" aria-label="Expand call"><Maximize2 size={13} /></button>
                </div>
            )}

            <footer className="vc-bar">
                {spectator ? (
                    <span className="vc-watching">Watching as a guest</span>
                ) : (
                    <>
                        <Btn compact={isMinimized} on={!isMuted} warn={isMuted} onClick={handleToggleAudio} label={isMuted ? 'Unmute' : 'Mute'}>{isMuted ? <MicOff size={17} /> : <Mic size={17} />}</Btn>
                        <Btn compact={isMinimized} on={!isVideoOff} warn={isVideoOff} onClick={handleToggleVideo} label={isVideoOff ? 'Start video' : 'Stop video'}>{isVideoOff ? <VideoOff size={17} /> : <Video size={17} />}</Btn>
                        {!isMobile && (
                            <Btn compact={isMinimized} on={isScreenSharing} onClick={toggleScreenShare} label={isScreenSharing ? 'Stop presenting' : 'Present'}>{isScreenSharing ? <ScreenShareOff size={17} /> : <ScreenShare size={17} />}</Btn>
                        )}
                        {sharer && !isMinimized && (
                            <Btn compact={isMinimized} on={isDrawing} onClick={() => setIsDrawing((d) => !d)} label="Draw">{<Pencil size={17} />}</Btn>
                        )}
                    </>
                )}
                <Btn compact={isMinimized} danger wide onClick={handleLeaveCall} label="Leave"><PhoneOff size={17} /></Btn>
            </footer>
        </div>
    );
};

// Call control button: icon plus a short label (hidden in the mini window).
const Btn = ({ on, danger, warn, onClick, label, children, wide, compact }) => (
    <button
        className={`vc-btn${on ? ' on' : ''}${danger ? ' vc-btn--danger' : ''}${warn ? ' vc-btn--warn' : ''}${wide ? ' vc-btn--wide' : ''}`}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        title={label}
        aria-label={label}
        aria-pressed={on === undefined ? undefined : !!on}
    >
        {children}
        {!compact && <span className="vc-btn-label">{label}</span>}
    </button>
);

// Plays a MediaStream; keeps the element when the stream object changes.
const StreamVideo = ({ stream, muted, mirror, fit }) => {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
    }, [stream]);
    return <video ref={ref} autoPlay playsInline muted={muted} className={`vc-video${mirror ? ' is-mirror' : ''}`} style={{ objectFit: fit }} />;
};

export default VideoChat;
