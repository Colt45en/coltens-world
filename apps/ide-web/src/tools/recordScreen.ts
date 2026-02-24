/**
 * apps/ide-web/src/tools/recordScreen.ts
 *
 * Browser-based screen recording via getDisplayMedia + MediaRecorder.
 * Supports optional audio, duration limit, and locking to prevent overlaps.
 */

export type RecordScreenArgs = {
    durationSeconds?: number; // e.g. 12; default 10
    withAudio?: boolean;      // include system audio where supported; default false
    timeoutMs?: number;       // handler timeout; default 60000
};

export type RecordScreenResult = {
    mimeType: string;  // e.g. "video/webm"
    byteLength: number; // blob size in bytes
};

let recordingLock = false;

/**
 * Record screen using getDisplayMedia + MediaRecorder.
 *
 * Returns metadata about the recording (not the blob itself - too large for WS).
 * In a real app, you'd upload the blob to a server and return a URL/artifact ID.
 *
 * @throws Error if recording is already in progress or user denies permission
 */
export async function recordScreen(args: RecordScreenArgs): Promise<RecordScreenResult> {
    if (recordingLock) {
        throw new Error("record_screen blocked: recording already in progress");
    }
    recordingLock = true;

    try {
        const durationMs = Math.max(1, Number(args.durationSeconds ?? 10)) * 1000;
        const withAudio = Boolean(args.withAudio ?? false);

        console.log(`[recordScreen] Starting ${durationMs}ms capture with audio=${withAudio}`);

        // Request display media (screen/window share)
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({
            video: {
                cursor: "always" as const,
            },
            audio: withAudio,
        });

        const chunks: BlobPart[] = [];

        // Choose best MIME type
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
            ? "video/webm;codecs=vp9"
            : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
                ? "video/webm;codecs=vp8"
                : "video/webm";

        const rec = new MediaRecorder(stream, { mimeType });

        const stopPromise = new Promise<void>((resolve) => {
            rec.onstop = () => {
                console.log(`[recordScreen] Recording stopped`);
                resolve();
            };
        });

        rec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                chunks.push(e.data);
                console.log(`[recordScreen] Chunk: ${e.data.size} bytes`);
            }
        };

        rec.start(250); // push data every 250ms
        console.log(`[recordScreen] Recorder started`);

        // Auto-stop after duration
        const timer = setTimeout(() => {
            console.log(`[recordScreen] Auto-stopping after ${durationMs}ms`);
            try {
                rec.stop();
            } catch (e) {
                console.warn(`[recordScreen] Error stopping recorder:`, e);
            }
        }, durationMs);

        // Stop if user ends screen share early
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.onended = () => {
                console.log(`[recordScreen] User ended screen share`);
                try {
                    rec.stop();
                } catch (e) {
                    console.warn(`[recordScreen] Error stopping recorder:`, e);
                }
            };
        }

        // Wait for recorder to stop
        await stopPromise;
        clearTimeout(timer);

        // Stop all tracks
        for (const track of stream.getTracks()) {
            track.stop();
        }

        const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
        console.log(`[recordScreen] Finished. Total size: ${blob.size} bytes, MIME: ${blob.type}`);

        return {
            mimeType: blob.type,
            byteLength: blob.size,
        };
    } finally {
        recordingLock = false;
    }
}
