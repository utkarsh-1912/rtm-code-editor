const { spawn } = require('child_process');

const streamingProcesses = {};

function startStream(projectId, rtmpKey) {
    if (!rtmpKey) return false;

    console.log(`[StreamService] Starting RTMP stream for project ${projectId}`);

    if (streamingProcesses[projectId]) {
        stopStream(projectId);
    }

    const ffmpeg = spawn('ffmpeg', [
        '-i', '-', // Input from stdin
        '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '3000k',
        '-maxrate', '3000k', '-bufsize', '6000k',
        '-pix_fmt', 'yuv420p', '-g', '50',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
        '-f', 'flv', rtmpKey
    ]);

    ffmpeg.on('close', (code) => {
        console.log(`[StreamService] FFmpeg process for ${projectId} closed with code ${code}`);
        delete streamingProcesses[projectId];
    });

    ffmpeg.stderr.on('data', (data) => {
        // Output stream logs if needed
    });

    streamingProcesses[projectId] = ffmpeg;
    return true;
}

function writeStreamChunk(projectId, chunk) {
    const ffmpeg = streamingProcesses[projectId];
    if (ffmpeg && ffmpeg.stdin.writable) {
        ffmpeg.stdin.write(chunk);
        return true;
    }
    return false;
}

function stopStream(projectId) {
    if (streamingProcesses[projectId]) {
        try {
            streamingProcesses[projectId].stdin.end();
            streamingProcesses[projectId].kill();
        } catch (e) { }
        delete streamingProcesses[projectId];
        console.log(`[StreamService] Streaming stopped for ${projectId}`);
        return true;
    }
    return false;
}

module.exports = {
    startStream,
    writeStreamChunk,
    stopStream
};
