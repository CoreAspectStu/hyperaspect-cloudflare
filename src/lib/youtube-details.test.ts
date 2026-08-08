import { describe, it, expect } from "vitest";
import {
  stageRows,
  costBreakdown,
  transcriptView,
  storyboardView,
  logSummary,
  normalizeStageStatus,
  stageStatusLabel,
  formatDuration,
  formatCost,
  formatTimestamp,
  prettyStageName,
  STAGE_ORDER,
  type Manifest,
  type Transcript,
  type Storyboard,
  type JobDetail,
} from "./youtube-details";

/**
 * Real-behavior unit tests for the E3-S4 detail-derivation helpers.
 *
 * Fixtures mirror the actual JSON the pipeline writes (artifacts/<video_id>/
 * {manifest,transcript,storyboard}.json) and that runner.py stores verbatim
 * onto the job row via db.mark_complete — so these exercise the real shapes
 * the /admin/youtube-pipeline grid card will receive from GET /videos/{job_id}.
 *
 * All inputs are pure data; no DOM or fetch required (Node vitest env).
 */

// --- Fixtures (trimmed from artifacts/dxW_TfPpL5E/*.json) -------------------

const FULL_MANIFEST: Manifest = {
  video_id: "dxW_TfPpL5E",
  total_cost_usd: 0.8123,
  final_output: "/data/projects/youtube-ai-video/artifacts/dxW_TfPpL5E/final_video.mp4",
  stages: {
    ingest: {
      stage: "ingest",
      status: "completed",
      started_at: "2026-06-25T09:13:09.972027",
      completed_at: "2026-06-25T09:13:13.127634",
      duration_seconds: null,
      cost_usd: null,
      error: null,
      artifacts: ["/data/projects/youtube-ai-video/artifacts/dxW_TfPpL5E/thumbnail.jpg"],
    },
    transcript: {
      stage: "transcript",
      status: "completed",
      duration_seconds: 1.996784,
      cost_usd: 0.002,
      error: null,
      artifacts: ["/data/projects/youtube-ai-video/artifacts/dxW_TfPpL5E/transcript.json"],
    },
    storyboard: {
      stage: "storyboard",
      status: "completed",
      duration_seconds: 32.74,
      cost_usd: 0.018,
      error: null,
      artifacts: [".../storyboard.json"],
    },
    image_gen: {
      stage: "image_gen (3/10)",
      status: "partial",
      duration_seconds: 64.09,
      cost_usd: 0.5,
      error: null,
      artifacts: [".../scene_001.png", ".../scene_005.png", ".../scene_007.png"],
    },
    vision_enrich: {
      stage: "vision_enrich (0/1)",
      status: "skipped",
      duration_seconds: 3.93,
      cost_usd: null,
      error: null,
      artifacts: [".../enriched_descriptions.json"],
    },
    tts: { stage: "tts", status: "completed", cost_usd: 0.04 },
    video_gen: { stage: "video_gen", status: "error", cost_usd: 0.25, error: "SVD timeout" },
    assemble: { stage: "assemble", status: "running", cost_usd: null },
    // An unknown future stage should append at the end, sorted alpha vs other unknowns.
    upscales: { stage: "upscales", status: "completed" },
  },
};

const FULL_TRANSCRIPT: Transcript = {
  video_id: "dxW_TfPpL5E",
  source: "supadata",
  language: "en",
  segments: [
    { start: 0.0, end: 0.0, text: "Introducing Sakana Fugu, a full" },
    { start: 0.0, end: 0.0, text: "multi-agent orchestration system" },
    { start: 25.4, end: 95.2, text: "A segment with real timing" },
    { start: 0, end: 0, text: "   " }, // whitespace-only → dropped
    { start: 0, end: 0, text: "" }, // empty → dropped
  ],
  full_text: "Introducing Sakana Fugu, a full multi-agent orchestration system",
};

const FULL_STORYBOARD: Storyboard = {
  video_id: "dxW_TfPpL5E",
  title: "Sakana Fugu: Multi-Agent AI Orchestration System Analysis",
  total_scenes: 2,
  style_template: "cyberpunk-neon",
  scenes: [
    {
      scene_number: 1,
      start_time: "00:00",
      end_time: "00:25",
      transcript_excerpt: "Introducing Sakana Fugu…",
      scene_description: "Opening scene introducing Sakana Fugu.",
      shot_type: "establishing_wide",
      mood: "mysterious, intriguing",
      color_palette: "electric blues and purples",
      visual_prompt: "cyberpunk style, neon lights, dark atmosphere…",
      on_screen_text: "SAKANA FUGU",
      duration_seconds: 8,
    },
    {
      scene_number: 2,
      start_time: "00:25",
      end_time: "01:15",
      transcript_excerpt: "A new player altogether.",
      scene_description: "Analyst speaking to camera.",
      shot_type: "medium_shot",
      mood: "analytical",
      color_palette: "cool blues",
      visual_prompt: "Tech analyst in cyberpunk setting…",
      on_screen_text: null,
      duration_seconds: 12,
    },
  ],
};

// --- normalizeStageStatus / label ------------------------------------------

describe("normalizeStageStatus", () => {
  it("maps the pipeline's known statuses to stable keys", () => {
    expect(normalizeStageStatus("completed")).toBe("completed");
    expect(normalizeStageStatus("Complete")).toBe("completed");
    expect(normalizeStageStatus("partial")).toBe("partial");
    expect(normalizeStageStatus("skipped")).toBe("skipped");
    expect(normalizeStageStatus("error")).toBe("error");
    expect(normalizeStageStatus("failed")).toBe("error");
    expect(normalizeStageStatus("running")).toBe("running");
    expect(normalizeStageStatus("in_progress")).toBe("running");
  });

  it("collapses anything unexpected to 'unknown' (never drops a badge)", () => {
    expect(normalizeStageStatus(undefined)).toBe("unknown");
    expect(normalizeStageStatus(null)).toBe("unknown");
    expect(normalizeStageStatus("")).toBe("unknown");
    expect(normalizeStageStatus("weird-new-status")).toBe("unknown");
  });
});

describe("stageStatusLabel", () => {
  it("returns the human label for each key", () => {
    expect(stageStatusLabel("completed")).toBe("Done");
    expect(stageStatusLabel("partial")).toBe("Partial");
    expect(stageStatusLabel("skipped")).toBe("Skipped");
    expect(stageStatusLabel("error")).toBe("Error");
    expect(stageStatusLabel("running")).toBe("Running");
  });
});

// --- formatters ------------------------------------------------------------

describe("formatDuration", () => {
  it("renders sub-minute durations to 1dp with an 's' suffix", () => {
    expect(formatDuration(1.996784)).toBe("2.0s");
    expect(formatDuration(0.5)).toBe("0.5s");
  });
  it("renders >= 60s as m + s", () => {
    expect(formatDuration(64.09)).toBe("1m 4s");
    expect(formatDuration(125)).toBe("2m 5s");
  });
  it("returns '—' for null/missing/NaN", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
  });
});

describe("formatCost", () => {
  it("formats to 4dp with a $ prefix, matching the grid card precision", () => {
    expect(formatCost(0.8123)).toBe("$0.8123");
    expect(formatCost(0.002)).toBe("$0.0020");
  });
  it("returns '—' for null/missing (not $0.0000)", () => {
    expect(formatCost(null)).toBe("—");
    expect(formatCost(undefined)).toBe("—");
  });
});

describe("formatTimestamp", () => {
  it("returns '' when there is no usable timing (Supadata 0.0/0.0 case)", () => {
    expect(formatTimestamp(0, 0)).toBe("");
    expect(formatTimestamp(0.0, 0.0)).toBe("");
    expect(formatTimestamp(undefined, undefined)).toBe("");
  });
  it("renders MM:SS for a single positive bound", () => {
    expect(formatTimestamp(25.4, 0)).toBe("0:25");
    expect(formatTimestamp(0, 95.2)).toBe("1:35");
  });
  it("renders a 'start – end' range when both bounds differ", () => {
    expect(formatTimestamp(25.4, 95.2)).toBe("0:25 – 1:35");
  });
  it("collapses to a single bound when start === end", () => {
    expect(formatTimestamp(30, 30)).toBe("0:30");
  });
});

describe("prettyStageName", () => {
  it("uses the exact canonical mapping for known stages", () => {
    expect(prettyStageName("vision_enrich")).toBe("Vision Enrich");
    expect(prettyStageName("image_gen")).toBe("Image Gen");
    expect(prettyStageName("tts")).toBe("TTS");
    expect(prettyStageName("video_gen")).toBe("Video Gen");
  });
  it("title-cases unknown snake/kebab keys", () => {
    expect(prettyStageName("upscales")).toBe("Upscales");
    expect(prettyStageName("color_grade_v2")).toBe("Color Grade V2");
  });
});

// --- stageRows (the API-call-details table) --------------------------------

describe("stageRows", () => {
  it("orders stages into canonical pipeline order, unknown stages last", () => {
    // The fixture has no 'keyframes' stage, so the canonical set renders
    // minus that one; the unknown 'upscales' stage appends at the end.
    const keys = stageRows(FULL_MANIFEST).map((r) => r.key);
    expect(keys).toEqual([
      "ingest",
      "transcript",
      "storyboard",
      "vision_enrich",
      "image_gen",
      "tts",
      "video_gen",
      "assemble",
      "upscales",
    ]);
  });

  it("reports per-stage status, duration, cost, error and artifact count", () => {
    const rows = stageRows(FULL_MANIFEST);
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName["Ingest"].statusKey).toBe("completed");
    expect(byName["Ingest"].durationLabel).toBe("—"); // null duration
    expect(byName["Ingest"].costUsd).toBeNull();
    expect(byName["Ingest"].artifactCount).toBe(1);
    expect(byName["Transcript"].durationLabel).toBe("2.0s");
    expect(byName["Image Gen"].statusLabel).toBe("Partial");
    expect(byName["Image Gen"].artifactCount).toBe(3);
    expect(byName["Video Gen"].statusKey).toBe("error");
    expect(byName["Video Gen"].error).toBe("SVD timeout");
    expect(byName["Assembly"].statusKey).toBe("running");
  });

  it("returns [] when the manifest or its stages are absent", () => {
    expect(stageRows(null)).toEqual([]);
    expect(stageRows(undefined)).toEqual([]);
    expect(stageRows({ stages: undefined })).toEqual([]);
    expect(stageRows({})).toEqual([]);
  });

  it("preserves unknown stages by appending them after the canonical set", () => {
    const rows = stageRows({
      stages: {
        assemble: { status: "completed" },
        zeta_extra: { status: "completed" },
        alpha_extra: { status: "completed" },
        ingest: { status: "completed" },
      },
    });
    expect(rows.map((r) => r.key)).toEqual([
      "ingest",
      "assemble",
      "alpha_extra",
      "zeta_extra",
    ]);
  });
});

// --- costBreakdown ---------------------------------------------------------

describe("costBreakdown", () => {
  it("prefers the job-row total and lists only stages that report a cost", () => {
    const cb = costBreakdown({
      total_cost_usd: 0.8123,
      manifest: FULL_MANIFEST,
    } as JobDetail);
    expect(cb.totalUsd).toBe(0.8123);
    expect(cb.hasPerStageCost).toBe(true);
    // Only the 5 stages with a non-null cost_usd appear as rows.
    expect(cb.rows.map((r) => r.name)).toEqual([
      "Transcript",
      "Storyboard",
      "Image Gen",
      "TTS",
      "Video Gen",
    ]);
    // sumUsd sums the per-stage rows.
    expect(cb.sumUsd).toBeCloseTo(0.002 + 0.018 + 0.5 + 0.04 + 0.25, 6);
  });

  it("falls back to manifest.total_cost_usd when the job-row total is absent", () => {
    const cb = costBreakdown({ manifest: FULL_MANIFEST } as JobDetail);
    expect(cb.totalUsd).toBe(0.8123);
  });

  it("flags no per-stage cost when all stage costs are null", () => {
    const cb = costBreakdown({
      total_cost_usd: 0.81,
      manifest: {
        stages: { ingest: { cost_usd: null }, transcript: { cost_usd: null } },
      },
    } as JobDetail);
    expect(cb.hasPerStageCost).toBe(false);
    expect(cb.rows).toEqual([]);
    expect(cb.sumUsd).toBeNull();
    expect(cb.totalUsd).toBe(0.81);
  });

  it("returns total null and no rows when nothing is set (early-failure job)", () => {
    const cb = costBreakdown(null);
    expect(cb.totalUsd).toBeNull();
    expect(cb.rows).toEqual([]);
    expect(cb.hasPerStageCost).toBe(false);
  });

  it("treats NaN totals as null", () => {
    const cb = costBreakdown({
      total_cost_usd: Number.NaN,
      manifest: null,
    } as JobDetail);
    expect(cb.totalUsd).toBeNull();
  });
});

// --- transcriptView --------------------------------------------------------

describe("transcriptView", () => {
  it("shapes segments and drops whitespace/empty entries", () => {
    const tv = transcriptView(FULL_TRANSCRIPT);
    // 5 raw segments, 2 dropped (empty + whitespace) → 3 kept.
    expect(tv.count).toBe(3);
    expect(tv.source).toBe("supadata");
    expect(tv.language).toBe("en");
    expect(tv.fullText).toBe(
      "Introducing Sakana Fugu, a full multi-agent orchestration system",
    );
    expect(tv.segments[0]).toEqual({ time: "", text: "Introducing Sakana Fugu, a full" });
    expect(tv.segments[2]).toEqual({ time: "0:25 – 1:35", text: "A segment with real timing" });
  });

  it("degrades to an empty view when the transcript is absent", () => {
    const tv = transcriptView(null);
    expect(tv.count).toBe(0);
    expect(tv.segments).toEqual([]);
    expect(tv.fullText).toBe("");
    expect(tv.source).toBe("—");
    expect(tv.language).toBe("—");
  });

  it("trims surrounding whitespace from segment text", () => {
    const tv = transcriptView({
      segments: [{ start: 0, end: 0, text: "  hello world  " }],
    });
    expect(tv.segments[0].text).toBe("hello world");
  });
});

// --- storyboardView --------------------------------------------------------

describe("storyboardView", () => {
  it("shapes scenes with a normalized 'start – end' time range", () => {
    const sv = storyboardView(FULL_STORYBOARD);
    expect(sv.title).toBe("Sakana Fugu: Multi-Agent AI Orchestration System Analysis");
    expect(sv.styleTemplate).toBe("cyberpunk-neon");
    expect(sv.totalScenes).toBe(2);
    expect(sv.count).toBe(2);
    expect(sv.scenes[0].number).toBe(1);
    expect(sv.scenes[0].timeRange).toBe("00:00 – 00:25");
    expect(sv.scenes[0].shotType).toBe("establishing_wide");
    expect(sv.scenes[0].onScreenText).toBe("SAKANA FUGU");
    expect(sv.scenes[1].onScreenText).toBe(""); // null → ""
    expect(sv.scenes[1].timeRange).toBe("00:25 – 01:15");
  });

  it("degrades to an empty view when the storyboard is absent", () => {
    const sv = storyboardView(null);
    expect(sv.count).toBe(0);
    expect(sv.scenes).toEqual([]);
    expect(sv.title).toBe("");
  });

  it("derives totalScenes from the scene list when the field is missing", () => {
    const sv = storyboardView({
      scenes: [{ scene_number: 1 }, { scene_number: 2 }, { scene_number: 3 }],
    });
    expect(sv.totalScenes).toBe(3);
    expect(sv.count).toBe(3);
  });

  it("handles a single-sided time range", () => {
    const sv = storyboardView({
      scenes: [{ scene_number: 1, start_time: "00:10" }],
    });
    expect(sv.scenes[0].timeRange).toBe("00:10");
  });
});

// --- logSummary ------------------------------------------------------------

describe("logSummary", () => {
  it("counts newline-terminated lines", () => {
    const s = logSummary("line1\nline2\nline3\n");
    expect(s.lineCount).toBe(3);
    expect(s.byteLength).toBe(18);
  });
  it("counts a trailing partial line (no final newline)", () => {
    expect(logSummary("a\nb\nc").lineCount).toBe(3);
  });
  it("returns zeros for empty/missing logs", () => {
    expect(logSummary("")).toEqual({ lineCount: 0, byteLength: 0 });
    expect(logSummary(null)).toEqual({ lineCount: 0, byteLength: 0 });
    expect(logSummary(undefined)).toEqual({ lineCount: 0, byteLength: 0 });
  });
  it("counts a single line with no newline", () => {
    expect(logSummary("only line").lineCount).toBe(1);
  });
});

// --- module exports sanity -------------------------------------------------

describe("STAGE_ORDER export", () => {
  it("lists the canonical pipeline sequence", () => {
    expect(STAGE_ORDER[0]).toBe("ingest");
    expect(STAGE_ORDER[STAGE_ORDER.length - 1]).toBe("assemble");
    expect(STAGE_ORDER).toContain("image_gen");
    expect(STAGE_ORDER).toContain("vision_enrich");
  });
});
