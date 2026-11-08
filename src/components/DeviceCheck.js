import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Mic, MicOff, Video, VideoOff, ShieldAlert } from "lucide-react";
import { getCallPrefs, saveCallPrefs } from "../utils/callPrefs";
import { getBackendUrl } from "../utils/api";

// A few round trips to the server: how much delay a call through it would have.
function useConnectionCheck() {
    const [net, setNet] = useState(null); // { ms, grade } | { offline: true }
    useEffect(() => {
        let live = true;
        (async () => {
            const times = [];
            for (let i = 0; i < 4 && live; i++) {
                const t0 = performance.now();
                try { await fetch(`${getBackendUrl()}/api/ping`, { cache: "no-store" }); times.push(performance.now() - t0); } catch { /* counted as missing */ }
            }
            if (!live) return;
            if (!times.length) return setNet({ offline: true });
            times.sort((a, b) => a - b);
            const ms = Math.round(times[Math.floor(times.length / 2)]);
            const slowLink = navigator.connection?.downlink && navigator.connection.downlink < 1.5;
            setNet({ ms, grade: ms > 300 || slowLink ? "weak" : ms > 150 ? "ok" : "good" });
        })();
        return () => { live = false; };
    }, []);
    return net;
}

// Before a meeting: ask for camera and microphone, show a preview and a mic level, and let
// people pick whether each starts on. The choice is saved, so the call starts that way.
// Parent calls `ref.current.prepare()` on Join: it asks for permission if not done yet, saves
// the choice and releases the devices (the call opens them again a moment later).
const DeviceCheck = forwardRef(function DeviceCheck({ name }, ref) {
    // Last choice if there is one; otherwise both on (it's a meeting).
    const [prefs] = useState(() => {
        let saved = false;
        try { saved = !!localStorage.getItem("call-media"); } catch { /* storage blocked */ }
        return saved ? getCallPrefs() : { cam: true, mic: true };
    });
    const [cam, setCam] = useState(!!prefs.cam);
    const [mic, setMic] = useState(!!prefs.mic);
    const [status, setStatus] = useState("idle"); // idle | asking | ready | blocked | missing
    const [level, setLevel] = useState(0);
    const streamRef = useRef(null);
    const videoRef = useRef(null);
    const meterRef = useRef(null);

    const release = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (meterRef.current) { cancelAnimationFrame(meterRef.current.raf); meterRef.current.ctx.close().catch(() => { }); meterRef.current = null; }
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    const ask = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia) { setStatus("missing"); return false; }
        setStatus("asking");
        release();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 } }, audio: true });
            streamRef.current = stream;
            if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play?.().catch(() => { }); }
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                ctx.createMediaStreamSource(stream).connect(analyser);
                const data = new Uint8Array(analyser.frequencyBinCount);
                const tick = () => {
                    analyser.getByteFrequencyData(data);
                    setLevel(Math.min(1, data.reduce((a, b) => a + b, 0) / data.length / 60));
                    meterRef.current.raf = requestAnimationFrame(tick);
                };
                meterRef.current = { ctx, raf: requestAnimationFrame(tick) };
            } catch { /* no level meter */ }
            setStatus("ready");
            return true;
        } catch (err) {
            setStatus(err?.name === "NotFoundError" ? "missing" : "blocked");
            return false;
        }
    }, [release]);

    // Already allowed on an earlier visit: show the preview straight away, no prompt.
    useEffect(() => {
        let live = true;
        Promise.all(["camera", "microphone"].map((n) => navigator.permissions?.query({ name: n }).catch(() => null)))
            .then((res) => { if (live && res.every((r) => r?.state === "granted")) ask(); })
            .catch(() => { });
        return () => { live = false; release(); };
    }, [ask, release]);

    useEffect(() => { streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = cam; }); }, [cam, status]);
    useEffect(() => { streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = mic; }); }, [mic, status]);

    useImperativeHandle(ref, () => ({
        async prepare() {
            const ok = status === "ready" || (status === "idle" && await ask());
            saveCallPrefs(ok ? { cam, mic } : { cam: false, mic: false });
            release();
            return ok;
        },
    }), [status, ask, cam, mic, release]);

    return (
        <div className="devc">
            <div className="devc-preview">
                <video ref={videoRef} autoPlay playsInline muted className={cam && status === "ready" ? "" : "is-hidden"} />
                {!(cam && status === "ready") && (
                    <div className="devc-off">
                        {status === "blocked" ? <ShieldAlert size={22} /> : <VideoOff size={22} />}
                        <span>{status === "ready" ? "Camera off" : status === "asking" ? "Waiting for your browser…" : status === "blocked" ? "Camera and mic are blocked" : status === "missing" ? "No camera or mic found" : "Camera and mic not checked yet"}</span>
                    </div>
                )}
                {name && <span className="devc-name">{name}</span>}
            </div>
            <ConnectionLine />
            <div className="devc-row">
                <button type="button" className={`devc-toggle${mic ? " on" : ""}`} onClick={() => setMic((v) => !v)} disabled={status !== "ready"} aria-pressed={mic} title={mic ? "Join with mic on" : "Join muted"}>
                    {mic ? <Mic size={16} /> : <MicOff size={16} />}
                    {status === "ready" && mic && <span className="devc-level" style={{ transform: `scaleX(${level})` }} />}
                </button>
                <button type="button" className={`devc-toggle${cam ? " on" : ""}`} onClick={() => setCam((v) => !v)} disabled={status !== "ready"} aria-pressed={cam} title={cam ? "Join with camera on" : "Join with camera off"}>
                    {cam ? <Video size={16} /> : <VideoOff size={16} />}
                </button>
                {status !== "ready" && (
                    <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={ask} disabled={status === "asking"}>
                        {status === "blocked" ? "Try again" : "Allow camera & mic"}
                    </button>
                )}
                <span className="devc-hint">
                    {status === "blocked" ? "Allow them from the lock icon in the address bar. You can still join to listen and watch."
                        : status === "ready" ? "Pick what starts on. You can change it in the call."
                            : "Your browser will ask once."}
                </span>
            </div>
        </div>
    );
});

function ConnectionLine() {
    const net = useConnectionCheck();
    if (!net) return <span className="devc-net">Checking your connection…</span>;
    if (net.offline) return <span className="devc-net is-weak"><i /> Can’t reach the server. Check your internet before joining.</span>;
    const text = net.grade === "good" ? "Good for video" : net.grade === "ok" ? "Fine for video; a little delay" : "Weak: turn your camera off if the call stutters";
    return <span className={`devc-net is-${net.grade}`}><i /> Connection · {net.ms} ms · {text}</span>;
}

export default DeviceCheck;
