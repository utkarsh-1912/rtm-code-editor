import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PhoneOff, Video, VideoOff, Mic, MicOff, User } from 'lucide-react';
import toast from 'react-hot-toast';

const VideoChat = ({ socketRef, projectId, user }) => {
    const [stream, setStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: { stream, name } }
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
            setRemoteStreams(prev => ({
                ...prev,
                [userId]: { stream: event.streams[0], name: remoteName }
            }));
        };

        return peer;
    }, [socketRef, setRemoteStreams]);

    const createPeer = useCallback((userId, myId, localStream, remoteName) => {
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
            setRemoteStreams(prev => ({
                ...prev,
                [userId]: { stream: event.streams[0], name: remoteName }
            }));
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

        const handleUserJoined = ({ userId, name }) => {
            if (userId === socket.id) return;
            toast(`${name} joined video`);
            if (stream) {
                // We are the existing user, we create an offer to the new user
                createPeer(userId, socket.id, stream, name);
            }
        };

        const handleOffer = async ({ from, offer }) => {
            // We are the new user receiving an offer from an existing user
            const peer = addPeer(from, socket.id, stream, "User"); // Name gets updated on track/join
            try {
                await peer.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                socket.emit('video-answer', { to: from, answer });
            } catch (err) {
                console.error("Error handling offer", err);
            }
        };

        const handleAnswer = async ({ from, answer }) => {
            const peer = peersRef.current[from];
            if (peer) {
                try {
                    await peer.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (err) {
                    console.error("Error handling answer", err);
                }
            }
        };

        const handleCandidate = async ({ from, candidate }) => {
            const peer = peersRef.current[from];
            if (peer) {
                try {
                    await peer.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    // ICE candidate errors are common during teardown
                }
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
            socket.off('user-joined-video', handleUserJoined);
            socket.off('video-offer', handleOffer);
            socket.off('video-answer', handleAnswer);
            socket.off('new-ice-candidate', handleCandidate);
            socket.off('user-left-video');
        };
    }, [stream, socketRef, createPeer, addPeer]);

    return (
        <div style={containerStyle}>
            {!inCall ? (
                <div style={{ textAlign: 'center', padding: '10px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>Join the community call</p>
                    <button onClick={startCall} style={joinButtonStyle}>
                        <Video size={16} /> Join Call
                    </button>
                </div>
            ) : (
                <div style={callWorkspaceStyle}>
                    <div style={videoGridStyle}>
                        <div style={videoWrapperStyle}>
                            {isVideoOff ? (
                                <div style={avatarPlaceholderStyle}><User size={32} /></div>
                            ) : (
                                <video ref={localVideoRef} autoPlay muted playsInline style={videoStyle} />
                            )}
                            <span style={labelStyle}>You</span>
                        </div>
                        {Object.entries(remoteStreams).map(([id, remote]) => (
                            <div key={id} style={videoWrapperStyle}>
                                <VideoElement stream={remote.stream} />
                                <span style={labelStyle}>{remote.name || "Participant"}</span>
                            </div>
                        ))}
                    </div>
                    <div style={controlsStyle}>
                        <button onClick={() => {
                            const audioTrack = stream.getAudioTracks()[0];
                            audioTrack.enabled = !audioTrack.enabled;
                            setIsMuted(!audioTrack.enabled);
                        }} style={controlButtonStyle}>
                            {isMuted ? <MicOff size={16} color="#ef4444" /> : <Mic size={16} />}
                        </button>
                        <button onClick={() => {
                            const videoTrack = stream.getVideoTracks()[0];
                            videoTrack.enabled = !videoTrack.enabled;
                            setIsVideoOff(!videoTrack.enabled);
                        }} style={controlButtonStyle}>
                            {isVideoOff ? <VideoOff size={16} color="#ef4444" /> : <Video size={16} />}
                        </button>
                        <button onClick={endCall} style={{ ...controlButtonStyle, backgroundColor: "#ef4444", borderColor: "transparent" }}>
                            <PhoneOff size={16} color="white" />
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
    backgroundColor: "var(--bg-dark)",
    borderBottom: "1px solid var(--border-color)",
    padding: "16px",
};

const joinButtonStyle = {
    width: "100%",
    padding: "8px",
    backgroundColor: "var(--primary)",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontWeight: "700",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontSize: "13px",
    transition: "all 0.2s"
};

const callWorkspaceStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
};

const videoGridStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px"
};

const videoWrapperStyle = {
    position: "relative",
    borderRadius: "12px",
    overflow: "hidden",
    backgroundColor: "#111",
    aspectRatio: "1/1",
    border: "1px solid rgba(255,255,255,0.05)"
};

const avatarPlaceholderStyle = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.2)"
};

const videoStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover"
};

const labelStyle = {
    position: "absolute",
    bottom: "6px",
    left: "6px",
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "white",
    fontSize: "9px",
    fontWeight: "700",
    padding: "2px 6px",
    borderRadius: "4px",
    maxWidth: "80%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
};

const controlsStyle = {
    display: "flex",
    justifyContent: "center",
    gap: "8px"
};

const controlButtonStyle = {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "var(--text-main)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s"
};

export default VideoChat;
