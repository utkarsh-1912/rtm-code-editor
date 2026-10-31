import React, { useEffect, useRef, useState, useCallback } from 'react';
import Icon from './icons/Icon';
import { getCallPrefs, saveCallPrefs } from '../utils/callPrefs';
import { Avatar } from './clients';
import CallAnnotations from './CallAnnotations';
import toast from 'react-hot-toast';
import ACTIONS from '../Action';

// Camera sized for a mesh call: plenty for a tile, a fraction of 720p30's bandwidth.
const CAM = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } };
const MIC = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
// cursor: show the presenter's mouse in the shared screen (where the browser supports it).
const SCREEN = { video: { frameRate: { ideal: 15, max: 30 }, cursor: 'always' }, audio: true };

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
    initialAudioState, // omit to use the remembered choice (off the first time)
    initialVideoState,
    isMobile = false,
    returnTo = null, // { label, onClick }: shown when the call carries on away from its page
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
    const [prefs] = useState(getCallPrefs);
    const startAudio = initialAudioState ?? prefs.mic;
    const startVideo = initialVideoState ?? prefs.cam;
    const [isMuted, setIsMuted] = useState(!startAudio);
    const [isVideoOff, setIsVideoOff] = useState(!startVideo);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [screenStream, setScreenStream] = useState(null); // our shared screen (sent beside the camera)
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
    // { socketId: { cam: MediaStream, screen: MediaStream, sids: { trackId: streamId } } }: each
    // person's camera + mic, and their shared screen, kept apart by the stream they arrive in.
    const remoteMediaRef = useRef({});
    const remoteScreenIdRef = useRef({}); // { socketId: id of the stream that carries their screen }
    const screenStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analysersRef = useRef({}); // { socketId: AnalyserNode }
    const pendingCandidatesRef = useRef({}); // Bug 2: ICE candidate queue per peer
    const localStreamRef = useRef(null);
    useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

    // Senders per peer: camera and mic (`__videoSender`, `__audioSender`) and the shared screen
    // (`__screenSenders`). Camera and screen are separate tracks, so people see the presenter's
    // face next to their screen, and the camera can be turned off without touching the share.
    const senderFor = (peer, kind) => peer[`__${kind}Sender`]
        || peer.getSenders().find((x) => x.track?.kind === kind && !(peer.__screenSenders || []).includes(x));
    // Put our camera or mic track (or null: send nothing) on every connection.
    const putTrack = (kind, track, stream) => {
        Object.values(peersRef.current).forEach((peer) => {
            const sender = senderFor(peer, kind);
            if (sender) sender.replaceTrack(track).catch(() => { });
            else if (track) peer[`__${kind}Sender`] = peer.addTrack(track, stream);
        });
    };
    const addScreenTo = (peer) => {
        const screen = screenStreamRef.current;
        if (!screen || peer.__screenSenders) return;
        peer.__screenSenders = screen.getTracks().map((t) => peer.addTrack(t, screen));
    };

    // Cap each video sender's bitrate for the call size and content. While presenting, the
    // screen gets the bandwidth and the camera drops to a thumbnail.
    const tuneSenders = useCallback((screen = mediaStateRef.current.isScreenSharing) => {
        const peers = Object.values(peersRef.current);
        peers.forEach((peer) => {
            peer.getSenders().forEach((sender) => {
                if (!sender.track || sender.track.kind !== 'video' || !sender.getParameters) return;
                const isScreen = (peer.__screenSenders || []).includes(sender);
                const params = sender.getParameters();
                if (!params.encodings || !params.encodings.length) params.encodings = [{}];
                params.encodings[0].maxBitrate = isScreen ? videoBitrate(peers.length, true) : screen ? 250000 : videoBitrate(peers.length, false);
                params.encodings[0].maxFramerate = isScreen ? 15 : 24;
                params.degradationPreference = isScreen ? 'maintain-resolution' : 'balanced';
                sender.setParameters(params).catch(() => { });
            });
        });
    }, []);

    const mediaStateRef = useRef({ isMuted, isVideoOff, isScreenSharing, screenStreamId: null });
    const remoteUsersRef = useRef({});
    useEffect(() => { remoteUsersRef.current = remoteUsers; }, [remoteUsers]);
    useEffect(() => {
        mediaStateRef.current = { ...mediaStateRef.current, isMuted, isVideoOff, isScreenSharing };
    }, [isMuted, isVideoOff, isScreenSharing]);

    // --- Media Action Helper ---
    const broadcastMediaState = useCallback((state) => {
        mediaStateRef.current = { ...mediaStateRef.current, ...state };
        if (!socketRef.current) return;
        socketRef.current.emit(ACTIONS.MEDIA_STATE_CHANGE, {
            roomId: `call:${projectId}`,
            state: mediaStateRef.current,
        });
    }, [projectId, socketRef]);

    // --- Screen Sharing Logic ---
    // Stopping ends the capture (the browser's "sharing" bar goes away) and removes it from
    // every connection; the camera carries on as it was.
    const stopScreenShare = useCallback(() => {
        const screen = screenStreamRef.current;
        screenStreamRef.current = null;
        if (screen) screen.getTracks().forEach((t) => { t.onended = null; t.stop(); });
        Object.values(peersRef.current).forEach((peer) => {
            (peer.__screenSenders || []).forEach((sender) => { try { peer.removeTrack(sender); } catch { /* closed */ } });
            peer.__screenSenders = null;
        });
        setScreenStream(null);
        setIsScreenSharing(false);
        broadcastMediaState({ isScreenSharing: false, screenStreamId: null });
        tuneSenders(false);
    }, [broadcastMediaState, tuneSenders]);

    const toggleScreenShare = useCallback(async () => {
        if (screenStreamRef.current) { stopScreenShare(); return; }
        let screen;
        try {
            screen = await navigator.mediaDevices.getDisplayMedia(SCREEN);
        } catch (err) {
            return; // picker closed
        }
        const track = screen.getVideoTracks()[0];
        if (track && 'contentHint' in track) track.contentHint = 'detail';
        // "Stop sharing" in the browser's own bar.
        if (track) track.onended = () => stopScreenShare();
        screenStreamRef.current = screen;
        setScreenStream(screen);
        setIsScreenSharing(true);
        // Say which stream is the screen before it arrives, so others place it on the stage.
        broadcastMediaState({ isScreenSharing: true, screenStreamId: screen.id });
        Object.values(peersRef.current).forEach(addScreenTo);
        setTimeout(() => tuneSenders(true), 0);
    }, [stopScreenShare, broadcastMediaState, tuneSenders]);

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
            } else if (!startVideo && !startAudio) {
                // If both are false, avoid getUserMedia throwing an error. Create an empty stream.
                stream = new MediaStream();
            } else {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: startVideo ? CAM : false,
                    audio: startAudio ? MIC : false
                });
            }

            localStreamRef.current = stream; // signalling reads this before React re-renders
            setLocalStream(stream);
            setInCall(true);
            onCallStateChange(true);

            if (startAudio && !noDevices) {
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
    }, [projectId, socketRef, user, setupAudioAnalysis, startAudio, startVideo, onCallStateChange, inCall, broadcastMediaState, isMuted, isVideoOff]);

    // Remember mic and camera so the next call (this page or another) starts the same way.
    useEffect(() => {
        if (inCall) saveCallPrefs({ mic: !isMuted, cam: !isVideoOff });
    }, [inCall, isMuted, isVideoOff]);

    // Camera off stops the camera itself (the light goes out and the browser stops showing it
    // in use); turning it on asks for it again.
    const handleToggleVideo = useCallback(async (e) => {
        if (e) e.stopPropagation();
        const current = localStreamRef.current;

        if (!isVideoOff) {
            current?.getVideoTracks().forEach((t) => t.stop());
            const rest = new MediaStream((current?.getTracks() || []).filter((t) => t.kind !== 'video'));
            localStreamRef.current = rest;
            setLocalStream(rest);
            putTrack('video', null);
            setIsVideoOff(true);
            broadcastMediaState({ isVideoOff: true });
            return;
        }
        if (!inCall) {
            handleJoinCall();
            return;
        }
        try {
            const camStream = await navigator.mediaDevices.getUserMedia({ video: CAM });
            const camTrack = camStream.getVideoTracks()[0];
            if ('contentHint' in camTrack) camTrack.contentHint = 'motion';
            const next = new MediaStream([...(localStreamRef.current?.getTracks() || []).filter((t) => t.kind !== 'video'), camTrack]);
            localStreamRef.current = next;
            setLocalStream(next);
            putTrack('video', camTrack, next);
            setIsVideoOff(false);
            broadcastMediaState({ isVideoOff: false });
            setTimeout(() => tuneSenders(), 0);
        } catch (err) {
            console.error("Failed to restart camera", err);
            toast.error(err?.name === 'NotAllowedError' ? 'Camera is blocked for this site. Allow it in the address bar.' : 'Could not start your camera');
        }
    }, [isVideoOff, broadcastMediaState, inCall, handleJoinCall, tuneSenders]); // eslint-disable-line react-hooks/exhaustive-deps


    const handleToggleAudio = useCallback(async (e) => {
        if (e) e.stopPropagation();

        let audioTrack = localStreamRef.current?.getAudioTracks()[0];

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

                    const updatedStream = new MediaStream([...(localStreamRef.current?.getTracks() || []).filter((t) => t.kind !== 'audio'), audioTrack]);
                    localStreamRef.current = updatedStream;
                    setLocalStream(updatedStream);
                    putTrack('audio', audioTrack, updatedStream);

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
    }, [isMuted, broadcastMediaState, setupAudioAnalysis, inCall, handleJoinCall]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- WebRTC Core Functions ---
    const remoteMedia = (id) => {
        if (!remoteMediaRef.current[id]) remoteMediaRef.current[id] = { cam: new MediaStream(), screen: new MediaStream(), sids: {} };
        return remoteMediaRef.current[id];
    };
    const placeTrack = (media, track, toScreen) => {
        const into = toScreen ? media.screen : media.cam;
        const other = toScreen ? media.cam : media.screen;
        if (other.getTracks().includes(track)) other.removeTrack(track);
        into.getTracks().filter((t) => t.kind === track.kind && t !== track).forEach((t) => into.removeTrack(t));
        if (!into.getTracks().includes(track)) into.addTrack(track);
    };
    const publishRemote = (id, name) => {
        const media = remoteMediaRef.current[id];
        if (!media) return;
        setRemoteUsers((prev) => ({
            ...prev,
            [id]: { ...prev[id], stream: media.cam, screen: media.screen, name: prev[id]?.name || name, tracks: media.cam.getTracks().length + media.screen.getTracks().length * 10 },
        }));
    };


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
            stream.getTracks().forEach((track) => { peer[`__${track.kind}Sender`] = peer.addTrack(track, stream); });
        }
        addScreenTo(peer); // joining while someone here presents
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

        // Sort incoming tracks: the stream they came in tells camera + mic apart from a shared
        // screen (its id is announced in the media state). Each kind keeps one track per stream.
        peer.ontrack = (event) => {
            const media = remoteMedia(targetSocketId);
            media.sids[event.track.id] = event.streams[0]?.id || '';
            const toScreen = !!media.sids[event.track.id] && media.sids[event.track.id] === remoteScreenIdRef.current[targetSocketId];
            placeTrack(media, event.track, toScreen);
            publishRemote(targetSocketId, name);
            if (event.track.kind === 'audio' && !toScreen) setupAudioAnalysis(new MediaStream([event.track]), targetSocketId);
        };

        return peer;
    }, [socketRef, setupAudioAnalysis, tuneSenders]); // eslint-disable-line react-hooks/exhaustive-deps


    // Leave always works, presenting or not: the share and the camera stop with the call.
    const handleLeaveCall = useCallback(() => {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        const screen = screenStreamRef.current;
        screenStreamRef.current = null;
        screen?.getTracks().forEach((t) => { t.onended = null; t.stop(); });

        Object.values(peersRef.current).forEach(p => p.close());
        peersRef.current = {};
        analysersRef.current = {};
        remoteMediaRef.current = {};
        remoteScreenIdRef.current = {};

        setLocalStream(null);
        setScreenStream(null);
        setRemoteUsers({});
        setInCall(false);
        onCallStateChange(false);
        setIsScreenSharing(false);
        setIsDrawing(false);
        setActiveSpeaker(null);
        mediaStateRef.current = { ...mediaStateRef.current, isScreenSharing: false, screenStreamId: null };

        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }

        if (socketRef.current) {
            socketRef.current.emit('leave-video-chat', { projectId });
        }
    }, [projectId, socketRef, onCallStateChange]);

    const hasAutoJoinedRef = useRef(false);

    // Join as soon as the page's socket exists; it may still be connecting when the call opens.
    // No dependency list: the socket lives in a ref, so check again on every render.
    useEffect(() => {
        if (!inCall && !hasAutoJoinedRef.current && socketRef.current) {
            hasAutoJoinedRef.current = true;
            handleJoinCall();
        }
    });

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
            delete remoteScreenIdRef.current[userId];
            delete pendingCandidatesRef.current[userId];
            setRemoteUsers(prev => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
        };

        const onMediaStateChange = ({ userId, state }) => {
            if (userId === socket.id) return;
            // Their screen stream id: move any tracks that already arrived to the right place.
            if (state && 'screenStreamId' in state) {
                remoteScreenIdRef.current[userId] = state.screenStreamId || null;
                const media = remoteMediaRef.current[userId];
                if (media) {
                    [...media.cam.getTracks(), ...media.screen.getTracks()].forEach((t) => {
                        placeTrack(media, t, !!state.screenStreamId && media.sids[t.id] === state.screenStreamId);
                    });
                    publishRemote(userId);
                }
            }
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
    }, [socketRef, createPeer, projectId, tuneSenders]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const people = [
        ...(!spectator ? [{ id: 'local', isLocal: true }] : []),
        ...Object.entries(remoteUsers).map(([id, data]) => ({ id, ...data })),
    ];
    const count = people.length;
    // A shared screen is a tile of its own; the presenter keeps their own tile (camera or
    // avatar) in the strip, so you see who is presenting as well as what.
    const screens = [
        ...(isScreenSharing && screenStream ? [{ id: 'local:screen', owner: 'local', isLocal: true, isScreen: true, stream: screenStream }] : []),
        ...people.filter((p) => !p.isLocal && p.isScreenSharing && p.screen?.getVideoTracks().length)
            .map((p) => ({ id: `${p.id}:screen`, owner: p.id, isScreen: true, name: p.name, stream: p.screen })),
    ];
    const allParticipants = [...screens, ...people];

    // Stage: the tile you picked (pin, or a click in the strip), else a shared screen, else
    // whoever is talking. Picking someone during a share keeps the screen in the strip, one
    // click away ("Back to shared screen").
    const sharer = screens[0] || null;
    const pinnedP = allParticipants.length > 1 ? allParticipants.find((p) => p.id === pinned) : null;
    const spotlight = pinnedP
        || sharer
        || (layout === 'speaker' && count > 1
            ? people.find((p) => p.id === stageSpeaker && !p.isLocal) || people.find((p) => !p.isLocal)
            : null);
    const strip = spotlight ? allParticipants.filter((p) => p.id !== spotlight.id) : [];
    const ownerName = (p) => nameFor(p.owner === 'local' ? { isLocal: true } : people.find((x) => x.id === p.owner) || p);

    const mutedOf = (p) => (p.isLocal ? isMuted : !!p.isMuted);
    const cameraOn = (p) => {
        if (p.isScreen) return !!p.stream;
        if (p.isLocal) return !isVideoOff && !!localStream?.getVideoTracks().some((t) => t.readyState === 'live');
        return !p.isVideoOff && !!p.stream?.getVideoTracks().length;
    };

    const renderTile = (p, variant, style) => {
        const stage = variant === 'stage';
        const isScreen = !!p.isScreen;
        const presenting = stage && isScreen;
        const name = isScreen ? ownerName(p) : nameFor(p);
        const label = isScreen ? (p.isLocal ? 'Your screen' : `${name}'s screen`) : p.isLocal ? `${name} (you)` : name;
        const avatarSize = variant === 'strip' || variant === 'mini' ? 34 : stage ? 84 : count > 4 ? 44 : 64;
        return (
            <div
                key={`${variant}-${p.id}`}
                className={`vc-tile vc-tile--${variant}${activeSpeaker === p.id && !mutedOf(p) ? ' is-speaking' : ''}${pinned === p.id ? ' is-pinned' : ''}`}
                style={style}
                onDoubleClick={() => !presenting && variant !== 'strip' && togglePin(p.id)}
                onClick={variant === 'strip' ? () => (isScreen && sharer?.id === p.id ? pinned && togglePin(pinned) : togglePin(p.id)) : undefined}
                title={variant === 'strip' ? (isScreen ? 'Back to the shared screen' : `Show ${name} on the stage`) : undefined}
            >
                {cameraOn(p) ? (
                    <StreamVideo
                        stream={isScreen ? p.stream : p.isLocal ? localStream : p.stream}
                        muted
                        mirror={p.isLocal && !isScreen}
                        fit={presenting ? (fitStage ? 'contain' : 'cover') : 'cover'}
                    />
                ) : (
                    <div className="vc-off">
                        <Avatar name={name} photoURL={photoFor(isScreen ? p.owner : p.id)} size={avatarSize} />
                        {!p.isLocal && !p.stream && p.isVideoOff === undefined && variant !== 'strip' && <span className="vc-sub">Connecting…</span>}
                    </div>
                )}
                <div className="vc-tag">
                    {isScreen ? <Icon name="screen-share" size={12} /> : mutedOf(p) ? <Icon name="mic-off" size={12} className="vc-red" /> : <Icon name="mic" size={12} />}
                    <span>{label}</span>
                </div>
                {variant === 'stage' && pinned === p.id && (
                    <button className="vc-unpin" onClick={() => togglePin(p.id)} title="Unpin" aria-label={`Unpin ${name}`}>
                        <Icon name="unpin" size={14} /> Unpin
                    </button>
                )}
                {variant === 'grid' && allParticipants.length > 1 && (
                    <button className="vc-pin" onClick={() => togglePin(p.id)} title={pinned === p.id ? 'Unpin' : 'Pin to spotlight'} aria-label={pinned === p.id ? `Unpin ${name}` : `Pin ${name}`}>
                        <Icon name="pin" size={14} filled={pinned === p.id} />
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
            const p = sharer || people.find((x) => x.id === stageSpeaker) || people.find((x) => !x.isLocal) || people[0];
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
                                <span>{spotlight.isLocal ? "You're presenting" : `${ownerName(spotlight)} is presenting`}</span>
                                <span className="vc-banner-actions">
                                    <button className={isDrawing ? 'on' : ''} onClick={() => setIsDrawing((d) => !d)} title="Draw on the shared screen. Everyone sees it; strokes fade.">
                                        <Icon name="draw" size={14} filled={isDrawing} /> {isDrawing ? 'Drawing' : 'Draw'}
                                    </button>
                                    {isDrawing && <button onClick={() => setClearKey((k) => k + 1)} title="Clear drawings for everyone"><Icon name="erase" size={14} /> Clear</button>}
                                    <button onClick={() => setFitStage((f) => !f)} title={fitStage ? 'Fill the stage' : 'Fit the whole screen'}>
                                        <Icon name={fitStage ? 'scale-fill' : 'scale-fit'} size={14} /> {fitStage ? 'Fill' : 'Fit'}
                                    </button>
                                    {spotlight.isLocal && <button className="vc-stop" onClick={toggleScreenShare}><Icon name="screen-share-stop" size={14} /> Stop presenting</button>}
                                </span>
                            </div>
                        )}
                        {sharer && !presenting && (
                            <div className="vc-banner">
                                <span className="vc-live-dot" />
                                <span>{sharer.isLocal ? "You're presenting" : `${ownerName(sharer)} is presenting`}</span>
                                <span className="vc-banner-actions">
                                    <button className="vc-back" onClick={() => togglePin(pinned)}><Icon name="screen-share" size={14} /> Back to shared screen</button>
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
                {people.map((p) => renderTile(p, 'grid', tileStyle))}
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
                        <Icon name="video-off" size={24} className="vc-red" />
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
                    {docked ? dockHandle : !isMobile && <Icon name="grip" size={14} className="vc-grip" />}
                    <span className="vc-live-dot" />
                    <strong>Call</strong>
                    <span className="vc-meta">{count} {count === 1 ? 'person' : 'people'} · {clock}</span>
                    <span className="vc-head-actions">
                        {returnTo && (
                            <button onClick={returnTo.onClick} title={returnTo.label} aria-label={returnTo.label}><Icon name="back" size={16} /></button>
                        )}
                        {count > 1 && !sharer && (
                            <button onClick={() => { setLayout((l) => (l === 'grid' ? 'speaker' : 'grid')); setPinned(null); }} title={layout === 'grid' ? 'Spotlight view' : 'Grid view'} aria-label={layout === 'grid' ? 'Spotlight view' : 'Grid view'}>
                                <Icon name={layout === 'grid' ? 'layout-speaker' : 'layout-grid'} size={16} />
                            </button>
                        )}
                        {!isMobile && onDockToggle && (
                            <button onClick={onDockToggle} title={docked ? 'Pop out (floating window)' : 'Dock in the layout'} aria-label={docked ? 'Pop out call' : 'Dock call in the layout'}>
                                <Icon name={docked ? 'pop-out' : 'dock'} size={16} />
                            </button>
                        )}
                        {!isMobile && !docked && (
                            <button onClick={() => setIsLarge((l) => !l)} title={isLarge ? 'Smaller' : 'Larger'} aria-label={isLarge ? 'Smaller window' : 'Larger window'}>
                                <Icon name={isLarge ? 'shrink' : 'enlarge'} size={16} />
                            </button>
                        )}
                        <button onClick={toggleFullscreen} title="Full screen" aria-label="Full screen"><Icon name="full-screen" size={16} /></button>
                        {!docked && onMinimizeToggle && (
                            <button onClick={() => onMinimizeToggle(true)} title={isMobile ? 'Back to the room (call keeps going)' : 'Minimise'} aria-label={isMobile ? 'Back to the room' : 'Minimise call'}>{isMobile ? <Icon name="collapse" size={20} /> : <Icon name="minimize" size={16} />}</button>
                        )}
                    </span>
                </header>
            )}

            {renderBody()}
            <div className="vc-audio" aria-hidden="true">
                {Object.entries(remoteUsers).map(([id, u]) => (u.stream ? <RemoteAudio key={id} stream={u.stream} /> : null))}
                {Object.entries(remoteUsers).map(([id, u]) => (u.isScreenSharing && u.screen?.getAudioTracks().length ? <RemoteAudio key={`${id}-screen`} stream={u.screen} /> : null))}
            </div>

            {isMinimized && (
                <div className="vc-mini-top" onPointerDown={startDragging}>
                    <span className="vc-live-dot" /> <span>{clock}</span>
                    {returnTo && <button onClick={returnTo.onClick} title={returnTo.label} aria-label={returnTo.label}><Icon name="back" size={14} /></button>}
                    <button onClick={() => onMinimizeToggle(false)} title="Expand" aria-label="Expand call"><Icon name="enlarge" size={14} /></button>
                </div>
            )}

            <footer className="vc-bar">
                {spectator ? (
                    <span className="vc-watching">Watching as a guest</span>
                ) : (
                    <>
                        <Btn on={!isMuted} warn={isMuted} onClick={handleToggleAudio} label={isMuted ? 'Unmute' : 'Mute'}>{isMuted ? <Icon name="mic-off" size={16} /> : <Icon name="mic" size={16} filled />}</Btn>
                        <Btn on={!isVideoOff} warn={isVideoOff} onClick={handleToggleVideo} label={isVideoOff ? 'Start video' : 'Stop video'}>{isVideoOff ? <Icon name="video-off" size={16} /> : <Icon name="video" size={16} filled />}</Btn>
                        {canShareScreen && (
                            <Btn on={isScreenSharing} onClick={toggleScreenShare} label={isScreenSharing ? 'Stop presenting' : 'Present'}>{isScreenSharing ? <Icon name="screen-share-stop" size={16} filled /> : <Icon name="screen-share" size={16} />}</Btn>
                        )}
                        {sharer && !isMinimized && (
                            <Btn on={isDrawing} onClick={() => setIsDrawing((d) => !d)} label="Draw"><Icon name="draw" size={16} filled={isDrawing} /></Btn>
                        )}
                    </>
                )}
                <Btn danger wide onClick={handleLeaveCall} label="Leave"><Icon name="call-leave" size={16} /></Btn>
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
