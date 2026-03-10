import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import toast from 'react-hot-toast';

const VideoChat = ({ socketRef, projectId, user }) => {
    const [stream, setStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: stream }
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [inCall, setInCall] = useState(false);
    const peersRef = useRef({}); // { socketId: RTCPeerConnection }
    const localVideoRef = useRef();

    const startCall = async () => {
        try {
            const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setStream(localStream);
            if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
            setInCall(true);

            // Notify others that we joined the call
            socketRef.current.emit('join-video-chat', { projectId, userId: socketRef.current.id, name: user.name });
        } catch (err) {
            console.error("Failed to get media", err);
            toast.error("Could not access camera/microphone");
        }
    };

    const endCall = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        setStream(null);
        setInCall(false);
        Object.values(peersRef.current).forEach(peer => peer.close());
        peersRef.current = {};
        setRemoteStreams({});
        socketRef.current.emit('leave-video-chat', { projectId });
    };

    const addPeer = useCallback((userId, myId, localStream) => {
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
            setRemoteStreams(prev => ({ ...prev, [userId]: event.streams[0] }));
        };

        return peer;
    }, [socketRef, setRemoteStreams]);

    const createPeer = useCallback((userId, myId, localStream) => {
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
            setRemoteStreams(prev => ({ ...prev, [userId]: event.streams[0] }));
        };

        peer.createOffer().then(offer => {
            peer.setLocalDescription(offer);
            socketRef.current.emit('video-offer', { to: userId, offer });
        });

        return peer;
    }, [socketRef, setRemoteStreams]);

    useEffect(() => {
        if (!socketRef.current) return;

        const socket = socketRef.current;

        const handleUserJoined = async ({ userId, name }) => {
            if (userId === socket.id) return;
            toast(`${name} joined the call`);
            createPeer(userId, socket.id, stream);
        };

        const handleOffer = async ({ from, offer }) => {
            const peer = addPeer(from, socket.id, stream);
            await peer.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit('video-answer', { to: from, answer });
        };

        const handleAnswer = async ({ from, answer }) => {
            const peer = peersRef.current[from];
            if (peer) {
                await peer.setRemoteDescription(new RTCSessionDescription(answer));
            }
        };

        const handleCandidate = async ({ from, candidate }) => {
            const peer = peersRef.current[from];
            if (peer) {
                await peer.addIceCandidate(new RTCIceCandidate(candidate));
            }
        };

        socket.on('user-joined-video', handleUserJoined);
        socket.on('video-offer', handleOffer);
        socket.on('video-answer', handleAnswer);
        socket.on('new-ice-candidate', handleCandidate);
        socket.on('user-left-video', ({ userId }) => {
            if (peersRef.current[userId]) {
                peersRef.current[userId].close();
                delete peersRef.current[userId];
                setRemoteStreams(prev => {
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                });
            }
        });

        return () => {
            socket.off('user-joined-video');
            socket.off('video-offer');
            socket.off('video-answer');
            socket.off('new-ice-candidate');
            socket.off('user-left-video');
        };
    }, [stream, socketRef, projectId, createPeer, addPeer]);

    return (
        <div style={containerStyle}>
            {!inCall ? (
                <button onClick={startCall} style={joinButtonStyle}>
                    <Video size={18} /> Join Video Call
                </button>
            ) : (
                <div style={callWorkspaceStyle}>
                    <div style={videoGridStyle}>
                        <div style={videoWrapperStyle}>
                            <video ref={localVideoRef} autoPlay muted playsInline style={videoStyle} />
                            <span style={labelStyle}>You</span>
                        </div>
                        {Object.entries(remoteStreams).map(([id, remoteStream]) => (
                            <div key={id} style={videoWrapperStyle}>
                                <VideoElement stream={remoteStream} />
                                <span style={labelStyle}>Partner</span>
                            </div>
                        ))}
                    </div>
                    <div style={controlsStyle}>
                        <button onClick={() => {
                            const audioTrack = stream.getAudioTracks()[0];
                            audioTrack.enabled = !audioTrack.enabled;
                            setIsMuted(!audioTrack.enabled);
                        }} style={controlButtonStyle}>
                            {isMuted ? <MicOff size={20} color="#f87171" /> : <Mic size={20} />}
                        </button>
                        <button onClick={() => {
                            const videoTrack = stream.getVideoTracks()[0];
                            videoTrack.enabled = !videoTrack.enabled;
                            setIsVideoOff(!videoTrack.enabled);
                        }} style={controlButtonStyle}>
                            {isVideoOff ? <VideoOff size={20} color="#f87171" /> : <Video size={20} />}
                        </button>
                        <button onClick={endCall} style={{ ...controlButtonStyle, backgroundColor: "#ef4444" }}>
                            <PhoneOff size={20} color="white" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const VideoElement = ({ stream }) => {
    const ref = useRef();
    useEffect(() => {
        if (ref.current) ref.current.srcObject = stream;
    }, [stream]);
    return <video ref={ref} autoPlay playsInline style={videoStyle} />;
};

const containerStyle = {
    padding: "12px",
    backgroundColor: "var(--bg-card)",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    marginBottom: "12px"
};

const joinButtonStyle = {
    width: "100%",
    padding: "10px",
    backgroundColor: "var(--primary)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: "700",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px"
};

const callWorkspaceStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
};

const videoGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "8px"
};

const videoWrapperStyle = {
    position: "relative",
    borderRadius: "8px",
    overflow: "hidden",
    backgroundColor: "#000",
    aspectRatio: "4/3"
};

const videoStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover"
};

const labelStyle = {
    position: "absolute",
    bottom: "4px",
    left: "4px",
    backgroundColor: "rgba(0,0,0,0.5)",
    color: "white",
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px"
};

const controlsStyle = {
    display: "flex",
    justifyContent: "center",
    gap: "10px"
};

const controlButtonStyle = {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "var(--bg-dark)",
    border: "1px solid var(--border-color)",
    color: "var(--text-main)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s"
};

export default VideoChat;
