/**
 * client-renderer.ts — Browser-side video rendering orchestrator
 *
 * Uses Web Workers × OffscreenCanvas × WebCodecs to render video frames
 * in parallel, encode them as H.264, and mux into a downloadable MP4.
 *
 * This is the core of the "render in browser" feature. When a user's
 * browser supports WebCodecs + OffscreenCanvas, we skip the server
 * render queue entirely — zero server cost, instant results.
 *
 * The server render pipeline remains as a fallback for unsupported browsers.
 */

// mp4-muxer provides the Muxer class and ArrayBufferTarget
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

// ─── Types ────────────────────────────────────────────────

export interface ClientRenderConfig {
  duration: number; // seconds
  fps: number;
  width: number;
  height: number;
  workerCount?: number; // auto-detected if omitted
  onProgress?: (frame: number, total: number) => void;
}

export interface ClientRenderResult {
  blob: Blob;
  duration: number; // render time in seconds
  framesEncoded: number;
  workerCount: number;
  codec: string;
  hardwareAccelerated: boolean;
}

interface EncodedChunkData {
  data: ArrayBuffer;
  type: "key" | "delta";
  timestamp: number;
  duration: number;
  meta: { decoderConfig?: unknown; description?: unknown } | null;
}

interface WorkerState {
  frameStart: number;
  frameEnd: number;
  chunks: EncodedChunkData[];
  done: boolean;
}

// ─── Feature Detection ────────────────────────────────────

/**
 * Check if the current browser supports client-side rendering.
 * Requires: WebCodecs (VideoEncoder, VideoFrame, EncodedVideoChunk)
 *           OffscreenCanvas (for worker-based parallel rendering)
 */
export function isClientRenderSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof EncodedVideoChunk !== "undefined" &&
    typeof OffscreenCanvas !== "undefined"
  );
}

/**
 * Detect optimal worker count based on available CPU cores.
 * Caps at 8 to avoid overwhelming low-end machines.
 */
export function detectOptimalWorkers(): number {
  if (typeof navigator === "undefined") return 4;
  const cores = navigator.hardwareConcurrency || 4;
  // Use 75% of cores, capped at 8, minimum 2
  return Math.min(8, Math.max(2, Math.floor(cores * 0.75)));
}

/**
 * Detect the best available codec + hardware acceleration mode.
 * Tries hardware H.264 first, falls back to software.
 */
export async function detectBestCodec(): Promise<{
  codec: string;
  hardwareAccel: HardwareAcceleration;
}> {
  const configs: { codec: string; hardwareAcceleration: HardwareAcceleration }[] =
    [
      { codec: "avc1.640034", hardwareAcceleration: "prefer-hardware" }, // H.264 High 5.2
      { codec: "avc1.640028", hardwareAcceleration: "prefer-hardware" }, // H.264 High 5.0
      { codec: "avc1.42E01E", hardwareAcceleration: "prefer-software" }, // H.264 Baseline
    ];

  for (const cfg of configs) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        ...cfg,
        width: 1920,
        height: 1080,
      } as VideoEncoderConfig);
      if (support.supported) {
        return {
          codec: cfg.codec,
          hardwareAccel: cfg.hardwareAcceleration,
        };
      }
    } catch {
      // continue to next config
    }
  }

  // Ultimate fallback
  return { codec: "avc1.42E01E", hardwareAccel: "prefer-software" };
}

// ─── Main Render Function ─────────────────────────────────

/**
 * Render a video entirely in the browser using Web Workers.
 *
 * Splits the frame range across N workers. Each worker:
 * 1. Creates an OffscreenCanvas
 * 2. Draws frames via GSAP timeline + Canvas 2D API
 * 3. Encodes each frame via WebCodecs VideoEncoder
 * 4. Returns encoded H.264 chunks
 *
 * The main thread collects all chunks, sorts by timestamp,
 * and muxes them into a final MP4 via mp4-muxer.
 */
export async function renderInBrowser(
  config: ClientRenderConfig,
): Promise<ClientRenderResult> {
  const {
    duration,
    fps,
    width,
    height,
    onProgress,
  } = config;

  const totalFrames = Math.round(duration * fps);

  // Detect capabilities
  const { codec, hardwareAccel } = await detectBestCodec();
  const workerCount = config.workerCount || detectOptimalWorkers();
  const isHardware = hardwareAccel === "prefer-hardware";

  const startTime = performance.now();

  // Split frames across workers
  const framesPerWorker = Math.ceil(totalFrames / workerCount);
  const workerStates: WorkerState[] = [];

  for (let i = 0; i < workerCount; i++) {
    const frameStart = i * framesPerWorker;
    const frameEnd = Math.min((i + 1) * framesPerWorker, totalFrames);
    workerStates.push({ frameStart, frameEnd, chunks: [], done: false });
  }

  // Launch workers
  const renderPromises: Promise<void>[] = [];

  for (let i = 0; i < workerCount; i++) {
    const ws = workerStates[i];

    const promise = new Promise<void>((resolve, reject) => {
      const worker = new Worker("/render-worker.js");

      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;

        if (msg.type === "progress" && onProgress) {
          // Calculate overall progress across all workers
          let totalRendered = 0;
          for (let j = 0; j < workerStates.length; j++) {
            if (j === msg.workerId) {
              totalRendered += msg.rendered;
            } else {
              const w = workerStates[j];
              if (w.done) {
                totalRendered += w.frameEnd - w.frameStart;
              }
            }
          }
          onProgress(totalRendered, totalFrames);
        }

        if (msg.type === "complete") {
          workerStates[msg.workerId].chunks = msg.chunks;
          workerStates[msg.workerId].done = true;
          worker.terminate();
          resolve();
        }

        if (msg.type === "error") {
          worker.terminate();
          reject(new Error(`Worker ${msg.workerId}: ${msg.error}`));
        }
      };

      worker.onerror = (e: ErrorEvent) => {
        worker.terminate();
        reject(new Error(`Worker ${i} fatal: ${e.message}`));
      };

      // Send render task
      worker.postMessage({
        type: "render",
        workerId: i,
        frameStart: ws.frameStart,
        frameEnd: ws.frameEnd,
        fps,
        width,
        height,
        codec,
        hardwareAccel,
      });
    });

    renderPromises.push(promise);
  }

  // Wait for all workers to complete
  await Promise.all(renderPromises);

  // Assemble chunks into final MP4
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height },
    fastStart: "in-memory",
  });

  // Collect and sort all chunks by timestamp (frame order)
  const allChunks: EncodedChunkData[] = [];
  for (const ws of workerStates) {
    allChunks.push(...ws.chunks);
  }
  allChunks.sort((a, b) => a.timestamp - b.timestamp);

  // Extract decoder config from first chunk's metadata
  let firstMeta: EncodedChunkData["meta"] = null;
  for (const ws of workerStates) {
    if (ws.chunks.length > 0 && ws.chunks[0].meta) {
      firstMeta = ws.chunks[0].meta;
      break;
    }
  }

  let totalEncoded = 0;

  for (const c of allChunks) {
    const chunk = new EncodedVideoChunk({
      type: c.type,
      timestamp: c.timestamp,
      duration: c.duration,
      data: new Uint8Array(c.data),
    });

    const meta = totalEncoded === 0 && firstMeta ? firstMeta : undefined;
    muxer.addVideoChunk(chunk, meta as any);
    totalEncoded++;
  }

  muxer.finalize();

  const { buffer } = muxer.target as ArrayBufferTarget;
  const blob = new Blob([buffer], { type: "video/mp4" });

  const renderElapsed = (performance.now() - startTime) / 1000;

  return {
    blob,
    duration: renderElapsed,
    framesEncoded: totalEncoded,
    workerCount,
    codec,
    hardwareAccelerated: isHardware,
  };
}
