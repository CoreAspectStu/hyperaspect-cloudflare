/**
 * Pure derivation helpers for the E3-S4 "Detailed Data & Logs Display"
 * (FR-8, ADR-001, ADR-006) on /admin/youtube-pipeline.
 *
 * The grid card expands a `job_id` into five collapsible sections — processing
 * logs, transcript, storyboard scenes, API call details, and a cost breakdown.
 * The raw `GET /videos/{job_id}` payload (the job row + manifest/transcript/
 * storyboard JSON persisted by the Python runner) is verbose and loosely
 * typed, so these helpers turn it into small, render-ready, JSON-stable shapes
 * the React view can map over without branching logic.
 *
 * Everything here is pure and side-effect free so it unit-tests under the
 * Node vitest environment (no DOM) — see youtube-details.test.ts. Mirrors the
 * src/lib/youtube.ts (+ .test.ts) split the integration already follows.
 *
 * Shapes are modelled on the real artifacts the pipeline writes (artifacts/
 * <video_id>/{manifest,transcript,storyboard}.json) and that the runner stores
 * verbatim into PostgreSQL via db.mark_complete (see runner.py).
 */

// --- Input types (the raw JSON the backend persists) ------------------------

/** One stage entry inside manifest.stages.<name>. */
export type ManifestStage = {
  stage?: string;
  status?: string;
  started_at?: string | null;
  completed_at?: string | null;
  duration_seconds?: number | null;
  cost_usd?: number | null;
  error?: string | null;
  artifacts?: string[];
};

/** manifest.json — written by the pipeline, stored on the job row. */
export type Manifest = {
  stages?: Record<string, ManifestStage>;
  total_cost_usd?: number | null;
  final_output?: string;
  video_id?: string;
  url?: string;
  style_template?: string;
  mode?: string;
} | null;

export type TranscriptSegment = { start?: number; end?: number; text?: string };

/** transcript.json — Supadata output, stored on the job row. */
export type Transcript = {
  source?: string;
  language?: string;
  segments?: TranscriptSegment[];
  full_text?: string;
  video_id?: string;
} | null;

/** One scene inside storyboard.scenes. */
export type StoryboardScene = {
  scene_number?: number;
  start_time?: string;
  end_time?: string;
  transcript_excerpt?: string;
  scene_description?: string;
  shot_type?: string;
  mood?: string;
  color_palette?: string;
  visual_prompt?: string;
  on_screen_text?: string | null;
  duration_seconds?: number;
};

/** storyboard.json — LLM scene decomposition, stored on the job row. */
export type Storyboard = {
  title?: string;
  total_scenes?: number;
  style_template?: string;
  scenes?: StoryboardScene[];
  video_id?: string;
} | null;

/** The GET /videos/{job_id} response (job row fields + heavy JSON + comments). */
export type JobDetail = {
  total_cost_usd?: number | null;
  logs?: string | null;
  manifest?: Manifest;
  transcript?: Transcript;
  storyboard?: Storyboard;
};

// --- Output types -----------------------------------------------------------

export type StageStatusKey =
  | "completed"
  | "partial"
  | "skipped"
  | "error"
  | "running"
  | "unknown";

export type StageRow = {
  key: string;
  name: string;
  statusKey: StageStatusKey;
  statusLabel: string;
  durationLabel: string;
  costUsd: number | null;
  error: string | null;
  artifactCount: number;
};

export type CostRow = { name: string; costUsd: number | null };

export type CostBreakdown = {
  totalUsd: number | null;
  rows: CostRow[];
  hasPerStageCost: boolean;
  /** Sum of the per-stage cost rows that carry a value (null when none do). */
  sumUsd: number | null;
};

export type TranscriptView = {
  source: string;
  language: string;
  segments: { time: string; text: string }[];
  fullText: string;
  count: number;
};

export type StoryboardView = {
  title: string;
  styleTemplate: string;
  totalScenes: number;
  scenes: {
    number: number;
    timeRange: string;
    excerpt: string;
    description: string;
    shotType: string;
    mood: string;
    palette: string;
    visualPrompt: string;
    onScreenText: string;
    duration: number;
  }[];
  count: number;
};

export type LogSummary = { lineCount: number; byteLength: number };

// --- Canonical pipeline order ----------------------------------------------
// The pipeline runs stages in this sequence (see runner._STAGE_KEYWORDS /
// pipeline.py). Unknown stages the manifest may add are appended at the end,
// sorted alphabetically, so the table still reads top-to-bottom as a timeline.

export const STAGE_ORDER = [
  "ingest",
  "transcript",
  "storyboard",
  "keyframes",
  "vision_enrich",
  "image_gen",
  "tts",
  "video_gen",
  "assemble",
] as const;

const PRETTY_STAGE: Record<string, string> = {
  ingest: "Ingest",
  transcript: "Transcript",
  storyboard: "Storyboard",
  keyframes: "Keyframes",
  vision_enrich: "Vision Enrich",
  image_gen: "Image Gen",
  tts: "TTS",
  video_gen: "Video Gen",
  assemble: "Assembly",
};

// --- Stage status ----------------------------------------------------------

/**
 * Normalize a stage status string (completed/partial/skipped/error/running…)
 * into a stable semantic key the view layer maps to colour + label. Defaults to
 * "unknown" for anything unexpected so partial/never-seen statuses still render
 * a badge rather than disappearing.
 */
export function normalizeStageStatus(status?: string | null): StageStatusKey {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "completed" || s === "complete" || s === "done" || s === "success")
    return "completed";
  if (s === "partial" || s === "incomplete") return "partial";
  if (s === "skipped" || s === "skip") return "skipped";
  if (s === "error" || s === "failed" || s === "failure") return "error";
  if (s === "running" || s === "in_progress" || s === "processing" || s === "started")
    return "running";
  return "unknown";
}

export function stageStatusLabel(status?: string | null): string {
  return STAGE_STATUS_LABEL[normalizeStageStatus(status)];
}

const STAGE_STATUS_LABEL: Record<StageStatusKey, string> = {
  completed: "Done",
  partial: "Partial",
  skipped: "Skipped",
  error: "Error",
  running: "Running",
  unknown: "Unknown",
};

// --- Formatting ------------------------------------------------------------

/**
 * Format a duration in seconds as a compact label: "2.0s", "1.3m", "—" when
 * null/missing. Kept pure so the stage table + cost rows share one formatter.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toFixed(0)}s`;
}

/**
 * Format a USD amount to 4dp (matches the grid card's existing cost precision).
 * Returns "—" for null/missing so absent costs read as unknown rather than $0.
 */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null || Number.isNaN(usd)) return "—";
  return `$${usd.toFixed(4)}`;
}

/**
 * Render a transcript segment timestamp as "MM:SS" for readability. Returns an
 * empty string when there is no usable timing (Supadata segments are often
 * 0.0/0.0). Accepts start+end and shows "start – end" when both differ.
 */
export function formatTimestamp(
  start?: number | null,
  end?: number | null,
): string {
  const hasStart = start != null && start > 0;
  const hasEnd = end != null && end > 0;
  if (!hasStart && !hasEnd) return "";
  const part = (s: number | null | undefined) =>
    s == null || s <= 0 ? "" : clamp(s);
  const a = part(start);
  const b = part(end);
  if (a && b && a !== b) return `${a} – ${b}`;
  return a || b;
}

const clamp = (s: number): string => {
  const total = Math.max(0, Math.floor(s));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/** Human-readable stage name (pretty-cased), with known keys mapped exactly. */
export function prettyStageName(key: string): string {
  if (PRETTY_STAGE[key]) return PRETTY_STAGE[key];
  // snake_case / kebab-case → Title Case, preserving acronyms like tts/svg.
  return key
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || key;
}

// --- Stage table (the "API call details" section) --------------------------

/**
 * Turn manifest.stages into ordered, render-ready rows — one per pipeline
 * stage — for the "API call details" collapsible. Stages sort into canonical
 * pipeline order; unknown stages append alphabetically. Returns [] when the
 * manifest or its stages are absent (job still processing / errored early).
 */
export function stageRows(manifest?: Manifest | null): StageRow[] {
  const stages = manifest?.stages;
  if (!stages || typeof stages !== "object") return [];
  const keys = Object.keys(stages);
  const rank = (k: string): number => {
    const i = STAGE_ORDER.indexOf(
      k as (typeof STAGE_ORDER)[number],
    );
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  keys.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b); // unknown stages stay alphabetical + stable
  });
  return keys.map((key) => {
    const st = stages[key] ?? {};
    return {
      key,
      name: prettyStageName(key),
      statusKey: normalizeStageStatus(st.status),
      statusLabel: stageStatusLabel(st.status),
      durationLabel: formatDuration(st.duration_seconds),
      costUsd: st.cost_usd ?? null,
      error: st.error ?? null,
      artifactCount: Array.isArray(st.artifacts) ? st.artifacts.length : 0,
    };
  });
}

// --- Cost breakdown --------------------------------------------------------

/**
 * Derive the detailed cost breakdown: the job total plus one row per stage that
 * carries a cost figure. `totalUsd` prefers the job-row total (set by the
 * runner from manifest.total_cost_usd) and falls back to the manifest's copy.
 * `hasPerStageCost` is false when no stage reports a per-stage cost — the view
 * shows the total alone in that case rather than a table of "—" rows.
 */
export function costBreakdown(detail?: JobDetail | null): CostBreakdown {
  const manifest = detail?.manifest ?? null;
  const totalRaw = detail?.total_cost_usd ?? manifest?.total_cost_usd ?? null;
  const totalUsd =
    totalRaw == null || Number.isNaN(totalRaw) ? null : totalRaw;

  const rows: CostRow[] = stageRows(manifest)
    .filter((r) => r.costUsd != null)
    .map((r) => ({ name: r.name, costUsd: r.costUsd }));

  const hasPerStageCost = rows.length > 0;
  const sumUsd = hasPerStageCost
    ? rows.reduce((acc, r) => acc + (r.costUsd ?? 0), 0)
    : null;

  return { totalUsd, rows, hasPerStageCost, sumUsd };
}

// --- Transcript ------------------------------------------------------------

/**
 * Shape the transcript into a readable view: a list of {time, text} segments
 * plus the joined full text. Degrades to empty when the transcript is absent
 * (job errored before transcript extraction). Empty/whitespace segments are
 * dropped so the section never shows a wall of blank lines.
 */
export function transcriptView(transcript?: Transcript | null): TranscriptView {
  const raw = transcript?.segments ?? [];
  const segments = raw
    .map((s) => ({
      time: formatTimestamp(s?.start, s?.end),
      text: (s?.text ?? "").trim(),
    }))
    .filter((s) => s.text.length > 0);
  return {
    source: transcript?.source ?? "—",
    language: transcript?.language ?? "—",
    segments,
    fullText: (transcript?.full_text ?? "").trim(),
    count: segments.length,
  };
}

// --- Storyboard / scenes (the "storyboard keyframes" section) --------------

/**
 * Shape the storyboard into a list of scene cards for the collapsible. The
 * pipeline's LLM decomposition (scene_description, visual_prompt, shot_type,
 * mood, palette, on-screen text) is what an admin inspects to debug a scene.
 * Returns an empty view when the storyboard is absent. Scenes are kept in their
 * stored order (scene_number order from the LLM).
 */
export function storyboardView(storyboard?: Storyboard | null): StoryboardView {
  const scenes = (storyboard?.scenes ?? []).map((sc) => {
    const start = (sc.start_time ?? "").trim();
    const end = (sc.end_time ?? "").trim();
    const timeRange =
      start && end ? `${start} – ${end}` : start || end || "";
    return {
      number: sc.scene_number ?? 0,
      timeRange,
      excerpt: (sc.transcript_excerpt ?? "").trim(),
      description: (sc.scene_description ?? "").trim(),
      shotType: (sc.shot_type ?? "").trim(),
      mood: (sc.mood ?? "").trim(),
      palette: (sc.color_palette ?? "").trim(),
      visualPrompt: (sc.visual_prompt ?? "").trim(),
      onScreenText: (sc.on_screen_text ?? "").trim(),
      duration: sc.duration_seconds ?? 0,
    };
  });
  return {
    title: storyboard?.title ?? "",
    styleTemplate: storyboard?.style_template ?? "",
    totalScenes: storyboard?.total_scenes ?? scenes.length,
    scenes,
    count: scenes.length,
  };
}

// --- Logs ------------------------------------------------------------------

/**
 * Summarize the raw logs buffer for the section badge (line count + byte
 * length). The full text is rendered verbatim in a scrollable <pre>; this just
 * feeds the collapsible's "Logs · N lines" chip without duplicating render
 * logic in the component.
 */
export function logSummary(logs?: string | null): LogSummary {
  const text = logs ?? "";
  if (text.length === 0) return { lineCount: 0, byteLength: 0 };
  // Count newlines like wc -l, +1 if there's a trailing partial line.
  const matches = text.match(/\n/g);
  const lineBreaks = matches ? matches.length : 0;
  const lineCount = text.endsWith("\n") ? lineBreaks : lineBreaks + 1;
  return { lineCount, byteLength: text.length };
}
