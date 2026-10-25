import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Video, VideoOff, Mic, MicOff, Maximize2, Maximize, Minimize, Minus,
    ScreenShare, ScreenShareOff, PhoneOff, Pencil, Eraser, Expand, Shrink,
    Pin, PinOff, LayoutGrid, PanelTop, GripHorizontal, PictureInPicture2, LayoutPanelLeft, ChevronDown
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
    isMinimized: minimizedProp,
    onMinimizeToggle,
    dock = null, // { left, top, width, height }: sit over the Call card of the room layout
    onDockToggle,
    dockHandle = null, // grip that moves the Call card when docked
    externalInCall,
    onCallStateChange,
    clients = [],
    mediaStates = {},
    initialAudioState = true,
    initialVideoState = true,
    isMobile = false
}) => {
    // Docked: the window covers the layout's Call card instead of floating. It is the same
    // component either way, so docking or popping out never restarts the call.
    const docked = !!dock && !isMobile;
    const isMinimized = minimizedProp && !docked;
    // On phones the call fills the screen; minimised it becomes a small floating window over
    // the room so you can get back to the code while the call keeps going.
    const fullMobile = isMobile && !isMinimized;
    const canShareScreen = !!navigator.mediaDevices?.getDisplayMedia;
    const dockStyle = docked ? { left: dock.left, top: dock.top, width: dock.width, height: dock.height } : null;

    // --- State Management ---
    const [localStream, setLocalStream] = useState(null);
    const [remoteUsers, setRemoteUsers] = useState({}); // { socketId: { stream, name, isMuted, isVideoOff, isScreenSharing } }
    const [isMuted, setIsMuted] = useState(!initialAudioState);
    const [isVideoOff, setIsVideoOff] = useState(!initialVideoState);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [inCall, setInCall] = useState(false);
    const [activeSpeaker, setActiveSpeaker] = useState(null); // who is talking right now (tile ring)
    // Who holds the stage in spotlight view: the last remote person who talked. Like Meet/Zoom it
    // survives pauses and only moves when someone else has talked for a moment (no flicker).
    const [stageSpeaker, setStageSpeaker] = useState(null);
    const stageCandidate = useRef({ id: null, since: 0 });
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
    const remoteMediaRef = useRef({}); // { socketId: MediaStream } one stream per person, all their tracks
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

            localStreamRef.current = stream; // signalling reads this before React re-renders
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


    const createPeer = useCallback((targetSocketId, name, stream, { offerer = false } = {}) => {
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
                peer.__makingOffer = true;
                await peer.setLocalDescription(await peer.createOffer());
                socketRef.current.emit('video-offer', { to: targetSocketId, offer: peer.localDescription });
            } catch (e) { /* next change retries */ } finally {
                peer.__makingOffer = false;
            }
        };

        // Bug 2: Initialize candidate queue for this peer
        if (!pendingCandidatesRef.current[targetSocketId]) {
            pendingCandidatesRef.current[targetSocketId] = [];
        }

        if (stream) {
            stream.getTracks().forEach(track => peer.addTrack(track, stream));
        }
        // The side making the offer always asks to receive audio and video, even with no
        // camera or mic of its own; turning ours on later reuses these slots (addTrack) and
        // renegotiates. The answering side gets its slots from that offer.
        if (offerer) ['audio', 'video'].forEach((kind) => {
            if (!peer.getTransceivers().some((t) => t.receiver.track?.kind === kind)) {
                peer.addTransceiver(kind, { direction: 'recvonly' });
            }
        });
        setTimeout(() => tuneSenders(), 0);

        peer.onicecandidate = (event) => {
            if (event.candidate && socketRef.current) {
                socketRef.current.emit('new-ice-candidate', {
                    to: targetSocketId,
                    candidate: event.candidate
                });
            }
        };

        // Collect every incoming track into one stream per person (tracks can arrive in
        // separate events and, after renegotiation, under different stream ids).
        peer.ontrack = (event) => {
            let remoteStream = remoteMediaRef.current[targetSocketId];
            if (!remoteStream) {
                remoteStream = new MediaStream();
                remoteMediaRef.current[targetSocketId] = remoteStream;
            }
            remoteStream.getTracks()
                .filter((t) => t.kind === event.track.kind && t !== event.track)
                .forEach((t) => remoteStream.removeTrack(t));
            if (!remoteStream.getTracks().includes(event.track)) remoteStream.addTrack(event.track);
            setRemoteUsers(prev => ({
                ...prev,
                [targetSocketId]: { ...prev[targetSocketId], stream: remoteStream, name: prev[targetSocketId]?.name || name, tracks: remoteStream.getTracks().length }
            }));
            if (event.track.kind === 'audio') setupAudioAnalysis(new MediaStream([event.track]), targetSocketId);
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


    // Server restart / network drop: the socket comes back with a new id and in no rooms.
    // Re-enter the call room so people joining later can still reach us.
    const inCallRef = useRef(false);
    useEffect(() => { inCallRef.current = inCall; }, [inCall]);
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return undefined;
        const onReconnect = () => {
            if (inCallRef.current) socket.emit('rejoin-video-chat', { projectId });
        };
        socket.on('connect', onReconnect);
        return () => socket.off('connect', onReconnect);
    }, [socketRef, projectId]);

    // --- Socket Signaling Handlers ---
    // Who offers: only the person joining. They get the participant list and offer to each
    // existing member; members just wait for that offer. (When both sides offered at once,
    // each rejected the other's offer and video flowed one way or not at all.)
    // Renegotiation later (camera/mic turned on) uses "polite peer" rules to settle clashes.
    useEffect(() => {
        if (!socketRef.current) return;
        const socket = socketRef.current;

        const getPeer = (userId, name, offerer = false) => {
            let peer = peersRef.current[userId];
            if (!peer || peer.signalingState === 'closed') {
                peer = createPeer(userId, name, localStreamRef.current, { offerer });
                peersRef.current[userId] = peer;
            }
            return peer;
        };

        const drainCandidates = async (userId, peer) => {
            const pending = pendingCandidatesRef.current[userId] || [];
            pendingCandidatesRef.current[userId] = [];
            for (const candidate of pending) {
                try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { /* stale */ }
            }
        };

        // We joined: offer to someone already in the call.
        const connectTo = async (userId, name) => {
            if (userId === socket.id) return;
            setRemoteUsers(prev => ({ ...prev, [userId]: { ...prev[userId], name: name || prev[userId]?.name } }));
            const peer = getPeer(userId, name, true);
            try {
                peer.__makingOffer = true;
                await peer.setLocalDescription(await peer.createOffer());
                socket.emit('video-offer', { to: userId, offer: peer.localDescription });
            } catch (err) {
                console.error("Offer error", err);
            } finally {
                peer.__makingOffer = false;
            }
            socket.emit(ACTIONS.MEDIA_STATE_CHANGE, { roomId: `call:${projectId}`, state: mediaStateRef.current });
        };

        // Someone joined after us: show their tile; their offer arrives next.
        const onUserJoined = ({ userId, name }) => {
            if (userId === socket.id) return;
            setRemoteUsers(prev => ({ ...prev, [userId]: { ...prev[userId], name: name || prev[userId]?.name || "Guest" } }));
        };

        const onParticipantsList = ({ clients }) => {
            clients.forEach(c => connectTo(c.userId, c.name));
        };

        const onVideoOffer = async ({ from, offer }) => {
            const peer = getPeer(from, remoteUsersRef.current[from]?.name || "Guest");
            const collision = peer.__makingOffer || peer.signalingState !== 'stable';
            const polite = socket.id > from; // both sides agree on who yields
            if (collision && !polite) return; // they will accept ours instead
            try {
                if (collision) {
                    await peer.setLocalDescription({ type: 'rollback' }).catch(() => { });
                }
                await peer.setRemoteDescription(new RTCSessionDescription(offer));
                await peer.setLocalDescription(await peer.createAnswer());
                socket.emit('video-answer', { to: from, answer: peer.localDescription });
                peer.__negotiated = true;
                await drainCandidates(from, peer);
                socket.emit(ACTIONS.MEDIA_STATE_CHANGE, { roomId: `call:${projectId}`, state: mediaStateRef.current });
            } catch (err) { console.error("Answer error", err); }
        };

        const onVideoAnswer = async ({ from, answer }) => {
            const peer = peersRef.current[from];
            if (!peer || peer.signalingState !== 'have-local-offer') return;
            try {
                await peer.setRemoteDescription(new RTCSessionDescription(answer));
                peer.__negotiated = true;
                await drainCandidates(from, peer);
            } catch (err) { console.error("Set remote description error", err); }
        };

        const onIceCandidate = async ({ from, candidate }) => {
            const peer = peersRef.current[from];
            if (!peer || !peer.remoteDescription || !peer.remoteDescription.type) {
                // Not ready yet: keep it until the remote description is set.
                (pendingCandidatesRef.current[from] = pendingCandidatesRef.current[from] || []).push(candidate);
                return;
            }
            try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (err) { /* stale */ }
        };

        // Kept for older clients that ask us to (re)connect to them.
        const onRequestStreams = ({ from }) => connectTo(from, remoteUsersRef.current[from]?.name);

        const onUserLeft = ({ userId }) => {
            if (peersRef.current[userId]) {
                setTimeout(() => tuneSenders(), 0);
                peersRef.current[userId].close();
                delete peersRef.current[userId];
            }
            delete analysersRef.current[userId];
            delete remoteMediaRef.current[userId];
            delete pendingCandidatesRef.current[userId];
            setRemoteUsers(prev => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
        };

        const onMediaStateChange = ({ userId, state }) => {
            if (userId === socket.id) return;
            setRemoteUsers(prev => ({
                ...prev,
                [userId]: { ...prev[userId], ...state }
            }));
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
    }, [socketRef, createPeer, projectId, tuneSenders]);

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

            const cand = currentSpeaker && currentSpeaker !== 'local' ? currentSpeaker : null;
            if (!cand) stageCandidate.current = { id: null, since: 0 };
            else if (stageCandidate.current.id !== cand) stageCandidate.current = { id: cand, since: Date.now() };
            else if (Date.now() - stageCandidate.current.since >= 900) setStageSpeaker((cur) => (cur === cand ? cur : cand));

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
        if (fullMobile || docked || e.button !== 0 || e.target.closest('button')) return;
        e.preventDefault();
        setIsDragging(true);
        setDragOffset({ x: e.clientX - pipPosition.x, y: e.clientY - pipPosition.y });
    };

    // --- Grid area size (for 16:9 tiles) ---
    const [gridBox, setGridBox] = useState({ w: 0, h: 0 });
    const gridObserverRef = useRef(null);
    const gridRef = useCallback((node) => {
        gridObserverRef.current?.disconnect();
        if (!node) return;
        const measure = () => {
            const cs = getComputedStyle(node);
            const w = node.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            const h = node.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
            setGridBox((b) => (Math.abs(b.w - w) < 1 && Math.abs(b.h - h) < 1 ? b : { w, h }));
        };
        measure();
        gridObserverRef.current = new ResizeObserver(measure);
        gridObserverRef.current.observe(node);
    }, []);

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
    const layoutBeforePin = useRef('grid');
    // Pin puts someone on the stage; unpin returns to the view you had before pinning.
    const togglePin = (id) => {
        if (pinned === id) {
            setPinned(null);
            setLayout(layoutBeforePin.current);
            return;
        }
        if (!pinned) layoutBeforePin.current = layout;
        setPinned(id);
        setLayout('speaker');
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

    // Stage: the person you picked (pin, or a click in the strip), else a shared screen, else
    // whoever is talking. Picking someone during a share keeps the screen in the strip, one
    // click away ("Back to shared screen").
    const sharer = allParticipants.find((p) => (p.isLocal ? isScreenSharing : p.isScreenSharing));
    const pinnedP = count > 1 ? allParticipants.find((p) => p.id === pinned) : null;
    const spotlight = pinnedP
        || sharer
        || (layout === 'speaker' && count > 1
            ? allParticipants.find((p) => p.id === pinned) || allParticipants.find((p) => p.id === stageSpeaker && !p.isLocal) || allParticipants.find((p) => !p.isLocal)
            : null);
    const strip = spotlight ? allParticipants.filter((p) => p.id !== spotlight.id) : [];

    const mutedOf = (p) => (p.isLocal ? isMuted : !!p.isMuted);
    const cameraOn = (p) => (p.isLocal ? (!isVideoOff || isScreenSharing) && !!localStream : (!p.isVideoOff || p.isScreenSharing) && !!p.stream);

    const renderTile = (p, variant, style) => {
        const stage = variant === 'stage';
        const isScreen = p.id === sharer?.id;
        const presenting = stage && isScreen;
        const name = nameFor(p);
        const label = isScreen ? (p.isLocal ? 'Your screen' : `${name}'s screen`) : p.isLocal ? `${name} (you)` : name;
        const avatarSize = variant === 'strip' || variant === 'mini' ? 34 : stage ? 84 : count > 4 ? 44 : 64;
        return (
            <div
                key={`${variant}-${p.id}`}
                className={`vc-tile vc-tile--${variant}${activeSpeaker === p.id && !mutedOf(p) ? ' is-speaking' : ''}${pinned === p.id ? ' is-pinned' : ''}`}
                style={style}
                onDoubleClick={() => !presenting && variant !== 'strip' && togglePin(p.id)}
                onClick={variant === 'strip' ? () => (isScreen ? pinned && togglePin(pinned) : togglePin(p.id)) : undefined}
                title={variant === 'strip' ? (isScreen ? 'Back to the shared screen' : `Show ${name} on the stage`) : undefined}
            >
                {cameraOn(p) ? (
                    <StreamVideo
                        stream={p.isLocal ? localStream : p.stream}
                        muted
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
                {variant === 'stage' && pinned === p.id && (
                    <button className="vc-unpin" onClick={() => togglePin(p.id)} title="Unpin" aria-label={`Unpin ${name}`}>
                        <PinOff size={13} /> Unpin
                    </button>
                )}
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
            const p = allParticipants.find((x) => x.id === (sharer?.id || stageSpeaker)) || allParticipants.find((x) => !x.isLocal) || allParticipants[0];
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
                        {sharer && !presenting && (
                            <div className="vc-banner">
                                <span className="vc-live-dot" />
                                <span>{sharer.isLocal ? "You're presenting" : `${nameFor(sharer)} is presenting`}</span>
                                <span className="vc-banner-actions">
                                    <button className="vc-back" onClick={() => togglePin(pinned)}><ScreenShare size={13} /> Back to shared screen</button>
                                </span>
                            </div>
                        )}
                        {renderTile(spotlight, 'stage')}
                    </div>
                    {strip.length > 0 && <div className="vc-strip">{strip.map((p) => renderTile(p, 'strip'))}</div>}
                </div>
            );
        }
        // Pick the column count that gives the biggest 16:9 tiles for this window (Meet/Zoom
        // style): wide tiles side by side, centred, instead of tall strips.
        const GAP = 8;
        let best = { w: 0, h: 0 };
        for (let cols = 1; cols <= count; cols++) {
            const rows = Math.ceil(count / cols);
            const maxW = (gridBox.w - GAP * (cols - 1)) / cols;
            const maxH = (gridBox.h - GAP * (rows - 1)) / rows;
            const w = Math.max(0, Math.min(maxW, maxH * (16 / 9)));
            if (w > best.w) best = { w: Math.floor(w), h: Math.floor(w * (9 / 16)) };
        }
        const tileStyle = best.w ? { width: best.w, height: best.h } : undefined;
        return (
            <div className="vc-body vc-body--grid" ref={gridRef}>
                {allParticipants.map((p) => renderTile(p, 'grid', tileStyle))}
                {count === 1 && !spectator && (
                    <div className="vc-alone" title="Others join from the call button in this room">Waiting for others to join…</div>
                )}
            </div>
        );
    };

    // --- Joining ---
    if (!inCall) {
        return (
            <div className={`vc vc--joining${isMobile ? ' vc--mobile' : ''}${docked ? ' vc--docked' : ''}`} style={isMobile ? undefined : dockStyle || { left: Math.max(8, Math.min(pipPosition.x, viewport.w - 300)), top: Math.max(8, Math.min(pipPosition.y, viewport.h - 190)) }}>
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
    const size = isMinimized ? (isMobile ? { w: 168, h: 112 } : { w: 280, h: 176 })
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
            className={`vc${isMinimized ? ' vc--mini' : ''}${isMinimized && isMobile ? ' vc--mini-sm' : ''}${fullMobile ? ' vc--mobile' : ''}${docked ? ' vc--docked' : ''}${isDragging ? ' is-dragging' : ''}`}
            style={fullMobile ? undefined : dockStyle || { width, height, left, top }}
            role="region"
            aria-label="Call"
        >
            {!isMinimized && (
                <header className="vc-head" onPointerDown={startDragging}>
                    {docked ? dockHandle : !isMobile && <GripHorizontal size={14} className="vc-grip" aria-hidden="true" />}
                    <span className="vc-live-dot" />
                    <strong>Call</strong>
                    <span className="vc-meta">{count} {count === 1 ? 'person' : 'people'} · {clock}</span>
                    <span className="vc-head-actions">
                        {count > 1 && !sharer && (
                            <button onClick={() => { setLayout((l) => (l === 'grid' ? 'speaker' : 'grid')); setPinned(null); }} title={layout === 'grid' ? 'Spotlight view' : 'Grid view'} aria-label={layout === 'grid' ? 'Spotlight view' : 'Grid view'}>
                                {layout === 'grid' ? <PanelTop size={15} /> : <LayoutGrid size={15} />}
                            </button>
                        )}
                        {!isMobile && onDockToggle && (
                            <button onClick={onDockToggle} title={docked ? 'Pop out (floating window)' : 'Dock in the layout'} aria-label={docked ? 'Pop out call' : 'Dock call in the layout'}>
                                {docked ? <PictureInPicture2 size={15} /> : <LayoutPanelLeft size={15} />}
                            </button>
                        )}
                        {!isMobile && !docked && (
                            <button onClick={() => setIsLarge((l) => !l)} title={isLarge ? 'Smaller' : 'Larger'} aria-label={isLarge ? 'Smaller window' : 'Larger window'}>
                                {isLarge ? <Shrink size={15} /> : <Expand size={15} />}
                            </button>
                        )}
                        <button onClick={toggleFullscreen} title="Full screen" aria-label="Full screen"><Maximize2 size={15} /></button>
                        {!docked && onMinimizeToggle && (
                            <button onClick={() => onMinimizeToggle(true)} title={isMobile ? 'Back to the room (call keeps going)' : 'Minimise'} aria-label={isMobile ? 'Back to the room' : 'Minimise call'}>{isMobile ? <ChevronDown size={18} /> : <Minus size={15} />}</button>
                        )}
                    </span>
                </header>
            )}

            {renderBody()}
            <div className="vc-audio" aria-hidden="true">
                {Object.entries(remoteUsers).map(([id, u]) => (u.stream ? <RemoteAudio key={id} stream={u.stream} /> : null))}
            </div>

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
                        <Btn on={!isMuted} warn={isMuted} onClick={handleToggleAudio} label={isMuted ? 'Unmute' : 'Mute'}>{isMuted ? <MicOff size={16} /> : <Mic size={16} />}</Btn>
                        <Btn on={!isVideoOff} warn={isVideoOff} onClick={handleToggleVideo} label={isVideoOff ? 'Start video' : 'Stop video'}>{isVideoOff ? <VideoOff size={16} /> : <Video size={16} />}</Btn>
                        {canShareScreen && (
                            <Btn on={isScreenSharing} onClick={toggleScreenShare} label={isScreenSharing ? 'Stop presenting' : 'Present'}>{isScreenSharing ? <ScreenShareOff size={16} /> : <ScreenShare size={16} />}</Btn>
                        )}
                        {sharer && !isMinimized && (
                            <Btn on={isDrawing} onClick={() => setIsDrawing((d) => !d)} label="Draw">{<Pencil size={16} />}</Btn>
                        )}
                    </>
                )}
                <Btn danger wide onClick={handleLeaveCall} label="Leave"><PhoneOff size={16} /></Btn>
            </footer>
        </div>
    );
};

// Call control button: a round icon button; the label is the tooltip and the accessible name.
const Btn = ({ on, danger, warn, onClick, label, children, wide }) => (
    <button
        className={`vc-btn${on ? ' on' : ''}${danger ? ' vc-btn--danger' : ''}${warn ? ' vc-btn--warn' : ''}${wide ? ' vc-btn--wide' : ''}`}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        title={label}
        aria-label={label}
        aria-pressed={on === undefined ? undefined : !!on}
    >
        {children}
    </button>
);

// Plays a MediaStream; keeps the element when the stream object changes.
const StreamVideo = ({ stream, muted, mirror, fit }) => {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const attach = () => {
            if (el.srcObject !== stream) el.srcObject = stream || null;
            if (stream) el.play?.().catch(() => { /* retried on the next track */ });
        };
        attach();
        // Tracks can arrive after the element mounted (renegotiation): re-attach and play.
        stream?.addEventListener?.('addtrack', attach);
        return () => stream?.removeEventListener?.('addtrack', attach);
    }, [stream]);
    return <video ref={ref} autoPlay playsInline muted={muted} className={`vc-video${mirror ? ' is-mirror' : ''}`} style={{ objectFit: fit }} />;
};

// A person's sound, separate from their video tile so it keeps playing with the camera off.
const RemoteAudio = ({ stream }) => {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const attach = () => {
            if (el.srcObject !== stream) el.srcObject = stream || null;
            el.play?.().catch(() => { /* autoplay blocked until the next click; call UI has one */ });
        };
        attach();
        stream?.addEventListener?.('addtrack', attach);
        return () => stream?.removeEventListener?.('addtrack', attach);
    }, [stream]);
    return <audio ref={ref} autoPlay playsInline />;
};

export default VideoChat;
