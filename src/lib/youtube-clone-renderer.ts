/**
 * youtube-clone-renderer.ts — Storyboard-to-Renderer Bridge (Story 6.3)
 *
 * Converts the youtube-ai-video pipeline storyboard JSON into a render plan
 * the client-renderer can consume. Each scene becomes a canvas frame:
 * background image + lower-third caption + Ken Burns effect.
 *
 * The frontend polls GET /api/youtube/extract/{id}/storyboard until status=complete,
 * passes the result to storyboardToScenes(), then feeds the RenderPlan into
 * the existing WebCodecs renderer (client-renderer.ts).
 */

// ─── Types: backend response shape ────────────────────────

export interface StoryboardScene {
  scene_number: number;
  start_time: string;
  end_time: string;
  transcript_excerpt: string;
  scene_description: string;
  shot_type: string;
  mood: string;
  color_palette: string;
  visual_prompt: string;
  on_screen_text: string | null;
  duration_seconds: number;
  image_url: string;
  audio_url: string | null;
}

export interface StoryboardResponse {
  job_id: string;
  status: string;
  video_id?: string;
  style?: string;
  title?: string;
  total_scenes?: number;
  scenes: StoryboardScene[];
}

// ─── Types: render plan ──────────────────────────────────

export type KenBurnsDirection =
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "pan-up"
  | "pan-down";

export interface RenderScene {
  /** Full URL to the scene image (e.g. /api/youtube/extract/{id}/images/1) */
  imageUrl: string;
  /** Full URL to the TTS audio, or null if TTS failed for this scene */
  audioUrl: string | null;
  /** Duration in seconds — from TTS audio if available, else from storyboard */
  durationSeconds: number;
  /** Caption text (narration) displayed as lower-third overlay */
  captionText: string;
  /** Ken Burns direction for this scene */
  kenBurnsDirection: KenBurnsDirection;
  /** Scene number (1-indexed) */
  sceneNumber: number;
}

export interface RenderPlan {
  scenes: RenderScene[];
  /** Total render duration in seconds */
  totalDuration: number;
  /** Crossfade duration between scenes (seconds) */
  transitionDuration: number;
  /** Number of scenes */
  sceneCount: number;
  /** Base URL for resolving relative image/audio URLs */
  apiBaseUrl: string;
}

// ─── Constants ───────────────────────────────────────────

const CROSSFADE_DURATION = 0.5; // seconds
const DEFAULT_SCENE_DURATION = 8; // seconds when no TTS audio
const KEN_BURNS_SEQUENCE: KenBurnsDirection[] = [
  "zoom-in",
  "pan-right",
  "zoom-out",
  "pan-left",
  "pan-up",
  "pan-down",
];

// ─── Functions ───────────────────────────────────────────

/**
 * Convert a storyboard API response into an array of render scenes.
 *
 * Each scene maps to one background image + caption + Ken Burns effect.
 * Scene duration comes from the storyboard's duration_seconds field;
 * if audio_url exists, the renderer should use the actual audio length instead.
 */
export function storyboardToScenes(
  storyboard: StoryboardResponse,
  apiBaseUrl = "",
): RenderScene[] {
  return storyboard.scenes.map((scene, index) => ({
    imageUrl: resolveUrl(scene.image_url, apiBaseUrl),
    audioUrl: scene.audio_url ? resolveUrl(scene.audio_url, apiBaseUrl) : null,
    durationSeconds: scene.duration_seconds || DEFAULT_SCENE_DURATION,
    captionText: scene.transcript_excerpt || scene.on_screen_text || "",
    kenBurnsDirection: KEN_BURNS_SEQUENCE[index % KEN_BURNS_SEQUENCE.length],
    sceneNumber: scene.scene_number,
  }));
}

/**
 * Build a complete render plan from storyboard scenes.
 *
 * The render plan includes crossfade transitions between scenes.
 * Total duration = sum of scene durations (transitions overlap, so they
 * don't add to the total).
 */
export function buildRenderPlan(
  storyboard: StoryboardResponse,
  apiBaseUrl = "",
): RenderPlan {
  const scenes = storyboardToScenes(storyboard, apiBaseUrl);
  const totalDuration = scenes.reduce(
    (sum, scene) => sum + scene.durationSeconds,
    0,
  );

  return {
    scenes,
    totalDuration,
    transitionDuration: CROSSFADE_DURATION,
    sceneCount: scenes.length,
    apiBaseUrl,
  };
}

/**
 * Resolve a relative API URL (e.g. /extract/{id}/images/1) to a full path.
 *
 * The frontend proxy maps /api/youtube/* → localhost:3001/*, so we need
 * to rewrite backend paths to go through the Next.js proxy.
 */
function resolveUrl(path: string, baseUrl: string): string {
  // Backend paths start with /extract/{id}/...
  // Frontend proxy maps /api/youtube/extract/{id}/... → backend
  if (path.startsWith("/extract/")) {
    return `/api/youtube${path}`;
  }
  // Already a full URL or different path
  if (path.startsWith("http") || path.startsWith("/api/")) {
    return path;
  }
  // Fallback: prepend base URL
  return `${baseUrl}${path}`;
}

/**
 * Canvas frame renderer for a single scene with Ken Burns effect.
 *
 * Called by client-renderer.ts at each frame tick. Draws the background
 * image with a slow zoom/pan based on the scene's Ken Burns direction,
 * then overlays the caption text as a lower-third.
 *
 * @param ctx - Canvas 2D rendering context
 * @param image - Loaded HTMLImageElement for the scene
 * @param t - Time within this scene (0 to durationSeconds)
 * @param scene - Render scene config
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 */
export function renderSceneFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  t: number,
  scene: RenderScene,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const progress = scene.durationSeconds > 0
    ? Math.min(t / scene.durationSeconds, 1)
    : 0;

  // ── Ken Burns: compute source crop based on direction ──
  const maxZoom = 0.15; // 15% zoom range
  const zoom = getKenBurnsZoom(scene.kenBurnsDirection, progress, maxZoom);
  const panX = getKenBurnsPanX(scene.kenBurnsDirection, progress, maxZoom);
  const panY = getKenBurnsPanY(scene.kenBurnsDirection, progress, maxZoom);

  // Draw image with "cover" behavior + Ken Burns transform
  drawImageCover(
    ctx,
    image,
    canvasWidth,
    canvasHeight,
    zoom,
    panX,
    panY,
  );

  // ── Lower-third caption ──
  if (scene.captionText) {
    drawCaption(ctx, scene.captionText, canvasWidth, canvasHeight);
  }
}

/**
 * Draw an image with "object-fit: cover" behavior + zoom/pan offset.
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cw: number,
  ch: number,
  zoom: number,
  panX: number,
  panY: number,
): void {
  const imgRatio = image.width / image.height;
  const canvasRatio = cw / ch;

  let drawW: number;
  let drawH: number;

  if (imgRatio > canvasRatio) {
    // Image wider than canvas — fit height, crop width
    drawH = ch * (1 + zoom);
    drawW = drawH * imgRatio;
  } else {
    // Image taller than canvas — fit width, crop height
    drawW = cw * (1 + zoom);
    drawH = drawW / imgRatio;
  }

  const dx = (cw - drawW) / 2 + panX;
  const dy = (ch - drawH) / 2 + panY;

  ctx.drawImage(image, dx, dy, drawW, drawH);
}

/**
 * Draw lower-third caption with semi-transparent background.
 */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  cw: number,
  ch: number,
): void {
  const fontSize = Math.round(ch * 0.035); // ~3.5% of canvas height
  const padding = fontSize * 0.8;
  const barHeight = fontSize * 3.5; // up to 2 lines + padding
  const y = ch - barHeight;

  // Semi-transparent background gradient
  const gradient = ctx.createLinearGradient(0, y, 0, ch);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, y, cw, barHeight);

  // Text
  ctx.fillStyle = "#ffffff";
  ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";

  // Word-wrap into max 2 lines
  const maxWidth = cw - padding * 2;
  const lines = wrapText(ctx, text, maxWidth, 2);
  const lineHeight = fontSize * 1.4;
  const startY = ch - padding - (lines.length - 1) * lineHeight;

  lines.forEach((line, i) => {
    ctx.fillText(line, padding, startY + i * lineHeight);
  });
}

/**
 * Simple word-wrap helper for captions.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = test;
    }
  }

  if (current) {
    if (lines.length >= maxLines) {
      // Truncate last line with ellipsis
      const last = lines[lines.length - 1];
      const truncated = last + "…";
      while (
        ctx.measureText(truncated).width > maxWidth &&
        truncated.length > 1
      ) {
        truncated.slice(0, -2);
        truncated + "…";
      }
      lines[lines.length - 1] = truncated;
    } else {
      lines.push(current);
    }
  }

  return lines.slice(0, maxLines);
}

// ─── Ken Burns math ──────────────────────────────────────

function getKenBurnsZoom(
  direction: KenBurnsDirection,
  progress: number,
  maxZoom: number,
): number {
  if (direction === "zoom-in") return progress * maxZoom;
  if (direction === "zoom-out") return maxZoom * (1 - progress);
  // Pan directions use a fixed slight zoom
  return maxZoom * 0.3;
}

function getKenBurnsPanX(
  direction: KenBurnsDirection,
  progress: number,
  maxPan: number,
): number {
  const range = maxPan * 100; // pixels
  if (direction === "pan-left") return -progress * range;
  if (direction === "pan-right") return progress * range;
  return 0;
}

function getKenBurnsPanY(
  direction: KenBurnsDirection,
  progress: number,
  maxPan: number,
): number {
  const range = maxPan * 100;
  if (direction === "pan-up") return -progress * range;
  if (direction === "pan-down") return progress * range;
  return 0;
}
