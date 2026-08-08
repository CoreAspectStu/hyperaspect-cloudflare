"use client";

/**
 * TimelineEditor — Full-screen visual video editor modal.
 *
 * Loads a render-job manifest, shows beats (scenes) on a proportional
 * timeline bar, lets the user edit individual beats (headline, subtext,
 * duration, layout, caption style, transition), reorder / add / delete
 * beats, adjust global style + audio settings, and trigger a render via the
 * render bridge (POST /api/studio/template/[id]/render → poll .../render/[jobId]).
 *
 * Neo-brutalist styling: cream bg, 4px black borders, hard shadows.
 * Uses createPortal for a true full-screen overlay.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Film,
  Layers,
  Palette,
  Music,
  Scissors,
  RefreshCw,
  AlertCircle,
  Check,
  Clock,
  Type,
  Zap,
  Move,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Wand2,
  Bot,
  ArrowRight,
} from "lucide-react";
import type { Slot, Track } from "@/lib/template-store/types";

/* ════════════════════════════════════════════════════════════════════════════
 * Types
 * ════════════════════════════════════════════════════════════════════════════ */

export interface TimelineBeat {
  id: string;
  headline: string;
  subtext: string;
  duration: number;        // seconds (2–10)
  layout: BeatLayout;
  caption_style: CaptionStyle;
  transition: BeatTransition;
  /** Original scene metadata, preserved if present. */
  type?: string;
  slots?: Record<string, unknown>;
  /** Native template model: the scene this beat mirrors + its typed media tracks. */
  sceneId?: string;
  tracks?: Track[];
}

export interface TimelineManifest {
  jobId?: string;
  title?: string;
  aspect_ratio?: string;
  style_preset: StylePreset;
  primary_color: string;
  background_color: string;
  narration_voice: NarrationVoice;
  music_track: MusicTrack;
  sfx_enabled: boolean;
  beats: TimelineBeat[];
  /** Native template model (D3): per-client editable values + their schema. */
  templateId?: string;
  slots?: Slot[];
  slotValues?: Record<string, string | number>;
  /** Preserve any unknown top-level keys from the server. */
  [key: string]: unknown;
}

export interface TimelineEditorProps {
  /** Render-job id (post-generation). Optional: a bare templateId also loads a template. */
  jobId?: string;
  /** Template id to load via native /api/studio/template/[id]. Falls back to jobId. */
  templateId?: string;
  onClose: () => void;
}

type BeatLayout = "hero" | "quote" | "stats-grid" | "feature-list" | "cta";
type CaptionStyle =
  | "highlight"
  | "kinetic-slam"
  | "neon-glow"
  | "pill-karaoke"
  | "glitch-rgb"
  | "gradient-fill";
type BeatTransition =
  | "glitch"
  | "cinematic-zoom"
  | "blur"
  | "push"
  | "cover"
  | "dissolve"
  | "scale"
  | "fade";
type StylePreset =
  | "dark-pro"
  | "bold-light"
  | "navy-gold"
  | "glassmorphism"
  | "warm-cream"
  | "vscode-dark"
  | "editorial-warm"
  | "swiss-grid";
type NarrationVoice =
  | "none"
  | "narrator-male"
  | "narrator-female"
  | "energetic-male"
  | "calm-female"
  | "ai-host";
type MusicTrack =
  | "none"
  | "upbeat-electronic"
  | "cinematic-epic"
  | "lofi-chill"
  | "corporate-uplifting"
  | "ambient-pad"
  | "hiphop-grit"
  | "acoustic-warm";

type TabKey = "beats" | "style" | "audio" | "slots";

/* ── HyperFrames Inspector issue shape (from `hyperframes inspect --json`) ── */
interface InspectIssue {
  severity?: "error" | "warning" | "info" | string;
  message?: string;
  category?: string;
  selector?: string;
  sample?: number;
  [key: string]: unknown;
}

interface InspectReport {
  ok?: boolean;
  videoName?: string;
  duration?: number | null;
  samples?: number[] | null;
  issueCount?: number;
  errorCount?: number;
  warningCount?: number;
  infoCount?: number;
  truncated?: boolean;
  issues?: InspectIssue[];
}

/* ── Lint gate report (from `hyperframes lint --json` via /api/.../check) ── */
interface CheckFinding {
  severity?: "error" | "warning" | "info" | string;
  code?: string;
  message?: string;
  selector?: string;
  [key: string]: unknown;
}

interface CheckReport {
  ok?: boolean; // lint.ok && validate.ok
  lint?: {
    ok?: boolean;
    errorCount?: number;
    warningCount?: number;
    infoCount?: number;
    findings?: CheckFinding[];
  };
  validate?: {
    ok?: boolean; // renders without error
    errorCount?: number;
    warningCount?: number;
    contrastFailures?: number;
    errors?: Array<{ message?: string; [k: string]: unknown }>;
    warnings?: Array<{ message?: string; [k: string]: unknown }>;
  };
}

/* ── Vision-QA report (from hf-adversarial-review.py via /api/.../review) ── */
interface ReviewReport {
  video?: string; // mp4 path the review scored (basename used for approval keying)
  average_score?: number; // 0-10
  passed?: boolean;
  threshold?: number;
  frames_reviewed?: number;
  per_frame?: Array<{ score?: number; issues?: string[]; fix_needed?: boolean }>;
  all_issues?: string[];
  fixes?: Array<{ priority?: string; issue?: string; fix?: string }>;
}

/* ── Human-approve state (D5 step 4) ── */
interface ApprovalState {
  status: "approved" | "rejected" | "pending";
  mp4?: string | null;
  score?: number | null;
  at?: string | null;
  current: boolean; // approval is for the latest render
}

/* ── Gate orchestration (D5: chain lint→render→vision-QA→approve) ── */
type GateStepStatus = "pending" | "running" | "pass" | "fail";
interface GateSteps {
  check: GateStepStatus;
  render: GateStepStatus;
  review: GateStepStatus;
  approve: "pending" | "approved" | "rejected";
}
type Gate =
  | { phase: "idle" }
  | {
      phase: "checking" | "rendering" | "reviewing" | "awaiting" | "failed";
      progress?: number; // render % during "rendering"
      steps: GateSteps;
      error?: string;
    };

/* ── LLM-proposal (D4: the gate's caller) ── */
interface ProposalChange {
  slotId: string;
  label: string;
  type: string;
  from: string | number;
  to: string | number;
  reason: string;
}
interface ProposalResult {
  changes: ProposalChange[];
  rejected: Array<{ slotId: string; reason: string }>;
  summary: string;
}

/* ════════════════════════════════════════════════════════════════════════════
 * Static config / option lists
 * ════════════════════════════════════════════════════════════════════════════ */

const LAYOUT_OPTIONS: { value: BeatLayout; label: string; icon: string }[] = [
  { value: "hero", label: "Hero", icon: "🎬" },
  { value: "quote", label: "Quote", icon: "💬" },
  { value: "stats-grid", label: "Stats Grid", icon: "📊" },
  { value: "feature-list", label: "Feature List", icon: "📋" },
  { value: "cta", label: "Call to Action", icon: "🚀" },
];

const CAPTION_OPTIONS: { value: CaptionStyle; label: string }[] = [
  { value: "highlight", label: "Highlight" },
  { value: "kinetic-slam", label: "Kinetic Slam" },
  { value: "neon-glow", label: "Neon Glow" },
  { value: "pill-karaoke", label: "Pill Karaoke" },
  { value: "glitch-rgb", label: "Glitch RGB" },
  { value: "gradient-fill", label: "Gradient Fill" },
];

const TRANSITION_OPTIONS: { value: BeatTransition; label: string }[] = [
  { value: "glitch", label: "Glitch" },
  { value: "cinematic-zoom", label: "Cinematic Zoom" },
  { value: "blur", label: "Blur" },
  { value: "push", label: "Push" },
  { value: "cover", label: "Cover" },
  { value: "dissolve", label: "Dissolve" },
  { value: "scale", label: "Scale" },
  { value: "fade", label: "Fade" },
];

const STYLE_PRESETS: { value: StylePreset; label: string; swatch: string }[] = [
  { value: "dark-pro", label: "Dark Pro", swatch: "#0a0a0a" },
  { value: "bold-light", label: "Bold Light", swatch: "#f5f5f5" },
  { value: "navy-gold", label: "Navy Gold", swatch: "#0a1a3a" },
  { value: "glassmorphism", label: "Glassmorphism", swatch: "#a0c4e8" },
  { value: "warm-cream", label: "Warm Cream", swatch: "#fef6e4" },
  { value: "vscode-dark", label: "VSCode Dark", swatch: "#1e1e2e" },
  { value: "editorial-warm", label: "Editorial Warm", swatch: "#3d2817" },
  { value: "swiss-grid", label: "Swiss Grid", swatch: "#e63946" },
];

const VOICE_OPTIONS: { value: NarrationVoice; label: string }[] = [
  { value: "none", label: "No Narration" },
  { value: "narrator-male", label: "Narrator (Male)" },
  { value: "narrator-female", label: "Narrator (Female)" },
  { value: "energetic-male", label: "Energetic Male" },
  { value: "calm-female", label: "Calm Female" },
  { value: "ai-host", label: "AI Host" },
];

const MUSIC_OPTIONS: { value: MusicTrack; label: string }[] = [
  { value: "none", label: "No Music" },
  { value: "upbeat-electronic", label: "Upbeat Electronic" },
  { value: "cinematic-epic", label: "Cinematic Epic" },
  { value: "lofi-chill", label: "Lo-Fi Chill" },
  { value: "corporate-uplifting", label: "Corporate Uplifting" },
  { value: "ambient-pad", label: "Ambient Pad" },
  { value: "hiphop-grit", label: "Hip-Hop Grit" },
  { value: "acoustic-warm", label: "Acoustic Warm" },
];

/** Emoji per native track type (template-store/types TrackType). */
const TRACK_ICON: Record<string, string> = {
  video: "🎞️",
  image: "🖼️",
  text: "🔤",
  speech: "🗣️",
  audio: "🎵",
  transition: "✂️",
};

/* ════════════════════════════════════════════════════════════════════════════
 * Style constants (neo-brutalist design system)
 * ════════════════════════════════════════════════════════════════════════════ */

const COLORS = {
  bg: "#fef6e4",
  surface: "#ffffff",
  border: "#0a0a0a",
  accent: "#ff3b30",
  accent2: "#b8ff00",
  text: "#0a0a0a",
  textMuted: "#6b6b6b",
  danger: "#ff4444",
  success: "#22c55e",
};

const BORDER = `4px solid ${COLORS.border}`;
const BORDER_SM = `3px solid ${COLORS.border}`;
const SHADOW = "6px 6px 0 #0a0a0a";
const SHADOW_SM = "3px 3px 0 #0a0a0a";
const SHADOW_LG = "8px 8px 0 #0a0a0a";

/* ════════════════════════════════════════════════════════════════════════════
 * Default factory
 * ════════════════════════════════════════════════════════════════════════════ */

let _beatSeq = 0;
function defaultBeat(): TimelineBeat {
  _beatSeq += 1;
  return {
    id: `beat-new-${Date.now()}-${_beatSeq}`,
    headline: "New Beat",
    subtext: "",
    duration: 4,
    layout: "hero",
    caption_style: "highlight",
    transition: "fade",
  };
}

function defaultManifest(): TimelineManifest {
  return {
    title: "Untitled Project",
    aspect_ratio: "16:9",
    style_preset: "dark-pro",
    primary_color: "#ff3b30",
    background_color: "#0a0a0a",
    narration_voice: "none",
    music_track: "upbeat-electronic",
    sfx_enabled: true,
    beats: [defaultBeat(), defaultBeat(), defaultBeat()],
  };
}



/**
 * Map a native Template (GET /api/studio/template/[id]) into our editor shape.
 * The template carries scenes (typed tracks) + slots (the per-client DEAL block).
 * We project scenes → beats with real durations and surface slots/slotValues for
 * the Slots tab. Style/audio keep editor defaults until the edit route persists
 * them (brick 5).
 */
function normalizeTemplate(raw: unknown): TimelineManifest {
  const def = defaultManifest();
  if (!raw || typeof raw !== "object") return def;
  const t = raw as Record<string, unknown>;

  const rawScenes = Array.isArray(t.scenes) ? (t.scenes as Record<string, unknown>[]) : [];
  const beats: TimelineBeat[] = rawScenes.length
    ? rawScenes.map((s, i) => {
        const duration = typeof s.duration === "number" ? s.duration : 4;
        const tracks = Array.isArray(s.tracks) ? (s.tracks as Track[]) : [];
        const id = (s.id as string) || `scene-${i + 1}`;
        return {
          id,
          sceneId: id,
          headline: `Scene ${i + 1}`,
          subtext: "",
          duration,
          layout: "hero" as BeatLayout,
          caption_style: "highlight" as CaptionStyle,
          transition: "fade" as BeatTransition,
          tracks,
        };
      })
    : def.beats;

  const rawSlots = Array.isArray(t.slots) ? (t.slots as Slot[]) : [];
  const saved = (t.slotValues as Record<string, string | number> | undefined) ?? undefined;
  const slotValues: Record<string, string | number> = {};
  for (const s of rawSlots) {
    slotValues[s.id] = saved?.[s.id] ?? s.default ?? "";
  }

  return {
    jobId: def.jobId,
    templateId: (t.id as string) || undefined,
    title: (t.name as string) || def.title!,
    aspect_ratio: def.aspect_ratio!,
    style_preset: def.style_preset,
    primary_color: def.primary_color,
    background_color: def.background_color,
    narration_voice: def.narration_voice,
    music_track: def.music_track,
    sfx_enabled: def.sfx_enabled,
    beats,
    slots: rawSlots.length ? rawSlots : undefined,
    slotValues: rawSlots.length ? slotValues : undefined,
  };
}

/** Coerce arbitrary input to a valid #rrggbb for <input type="color">. */
function normalizeHex(v: string): string {
  let c = (v || "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(c)) {
    c = c.split("").map((ch) => ch + ch).join("");
  }
  return /^[0-9a-fA-F]{6}$/.test(c) ? `#${c.toLowerCase()}` : "#000000";
}

/* ════════════════════════════════════════════════════════════════════════════
 * Component
 * ════════════════════════════════════════════════════════════════════════════ */

export default function TimelineEditor({ jobId, templateId, onClose }: TimelineEditorProps) {
  const [manifest, setManifest] = useState<TimelineManifest | null>(null);
  const [selectedBeat, setSelectedBeat] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("beats");
  const [isRerendering, setIsRerendering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderSuccess, setRenderSuccess] = useState<string | null>(null);
  const [newJobId, setNewJobId] = useState<string | null>(null);
  // Render-bridge job state (POST /api/studio/template/[id]/render → poll .../render/[jobId]).
  // Rendering is async + server-side (~minutes on core-control), so the UI stays NON-blocking:
  // `renderPhase` drives the button + a footer progress pill; `isRerendering` only gates the
  // brief enqueue fetch, never the whole poll — the editor stays usable while a render runs.
  const [renderPhase, setRenderPhase] = useState<
    "queued" | "running" | "completed" | "failed" | null
  >(null);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderOutput, setRenderOutput] = useState<string | null>(null);
  const [slotSave, setSlotSave] = useState<{
    status: "idle" | "saving" | "saved" | "error";
    msg?: string;
  }>({ status: "idle" });

  /* ── HyperFrames Inspector state ── */
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectReport, setInspectReport] = useState<InspectReport | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  /* ── Lint gate (D5 step 1) state ── */
  const [isChecking, setIsChecking] = useState(false);
  const [checkReport, setCheckReport] = useState<CheckReport | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  /* ── Vision-QA gate (D5 step 3) state ── */
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewReport, setReviewReport] = useState<ReviewReport | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  /* ── Human-approve gate (D5 step 4) state ── */
  const [approval, setApproval] = useState<ApprovalState | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  /* ── Gate orchestration state (D5) ── */
  const [gate, setGate] = useState<Gate>({ phase: "idle" });

  /* ── LLM-proposal state (D4: the gate's caller) ── */
  const [proposePrompt, setProposePrompt] = useState("");
  const [isProposing, setIsProposing] = useState(false);
  const [proposal, setProposal] = useState<ProposalResult | null>(null);
  const [proposeError, setProposeError] = useState<string | null>(null);

  /* ── Load template on mount (native /api/studio/template/[id]) ── */
  useEffect(() => {
    let cancelled = false;
    const id = templateId ?? jobId;
    (async () => {
      if (!id) {
        if (!cancelled) {
          setLoadError("No template or job id supplied. Starting with defaults.");
          setManifest(defaultManifest());
        }
        return;
      }
      try {
        const res = await fetch(`/api/studio/template/${encodeURIComponent(id)}`);
        if (!res.ok) {
          // Gracefully fall back to a default manifest so the editor is still usable.
          if (!cancelled) {
            setLoadError(`Could not load template "${id}" (HTTP ${res.status}). Starting with defaults.`);
            setManifest(defaultManifest());
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setManifest(normalizeTemplate(data));
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load template.",
          );
          setManifest(defaultManifest());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, jobId]);

  /* ── Body scroll lock while modal is open ── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* ── Esc key to close ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isRerendering) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, isRerendering]);

  /* ── Auto-clear success message ── */
  useEffect(() => {
    if (renderSuccess) {
      const t = setTimeout(() => setRenderSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [renderSuccess]);

  /* ══ Derived ══ */
  const totalDuration = useMemo(
    () => (manifest?.beats ?? []).reduce((sum, b) => sum + b.duration, 0),
    [manifest],
  );

  /* ══ Beat mutations ══ */
  const updateBeat = useCallback(
    (index: number, patch: Partial<TimelineBeat>) => {
      setManifest((prev) => {
        if (!prev) return prev;
        const beats = [...prev.beats];
        beats[index] = { ...beats[index], ...patch };
        return { ...prev, beats };
      });
    },
    [],
  );

  const updateSlot = useCallback((id: string, value: string | number) => {
    setManifest((prev) =>
      prev && prev.slotValues
        ? { ...prev, slotValues: { ...prev.slotValues, [id]: value } }
        : prev,
    );
  }, []);

  /* ── Save slots (deterministic, no gate — D4) ── */
  const handleSaveSlots = useCallback(async () => {
    if (!manifest || !manifest.slotValues) return;
    const id = templateId ?? jobId;
    if (!id) {
      setSlotSave({ status: "error", msg: "No template id." });
      return;
    }
    setSlotSave({ status: "saving" });
    try {
      const res = await fetch(`/api/studio/template/${encodeURIComponent(id)}/values`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: manifest.slotValues }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setSlotSave({ status: "saved", msg: "Slots saved." });
    } catch (e) {
      setSlotSave({
        status: "error",
        msg: e instanceof Error ? e.message : "Save failed.",
      });
    }
  }, [manifest, templateId, jobId]);

  const addBeat = useCallback(() => {
    setManifest((prev) => {
      if (!prev) return prev;
      return { ...prev, beats: [...prev.beats, defaultBeat()] };
    });
    // Select the newly added beat
    setSelectedBeat(manifest ? manifest.beats.length : 0);
  }, [manifest]);

  const deleteBeat = useCallback(
    (index: number) => {
      setManifest((prev) => {
        if (!prev) return prev;
        const beats = prev.beats.filter((_, i) => i !== index);
        return { ...prev, beats: beats.length ? beats : [defaultBeat()] };
      });
      setSelectedBeat((prev) =>
        prev === null
          ? null
          : prev >= (manifest?.beats.length ?? 0) - 1
            ? Math.max(0, prev - 1)
            : prev,
      );
    },
    [manifest],
  );

  const moveBeat = useCallback(
    (index: number, dir: -1 | 1) => {
      setManifest((prev) => {
        if (!prev) return prev;
        const newIndex = index + dir;
        if (newIndex < 0 || newIndex >= prev.beats.length) return prev;
        const beats = [...prev.beats];
        [beats[index], beats[newIndex]] = [beats[newIndex], beats[index]];
        return { ...prev, beats };
      });
      setSelectedBeat(index + dir);
    },
    [],
  );

  /* ══ HyperFrames Inspector ══ */
  const handleInspect = useCallback(async () => {
    if (isInspecting) return;
    if (!jobId) {
      setInspectError("Inspect requires a rendered job — not available for a bare template.");
      return;
    }
    setIsInspecting(true);
    setInspectError(null);
    setInspectReport(null);

    try {
      const res = await fetch("/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Inspect failed (HTTP ${res.status})${txt ? `: ${txt.slice(0, 200)}` : ""}`,
        );
      }
      const data: InspectReport = await res.json();
      setInspectReport(data);
    } catch (e) {
      setInspectError(
        e instanceof Error ? e.message : "Inspect failed unexpectedly.",
      );
    } finally {
      setIsInspecting(false);
    }
  }, [jobId, isInspecting]);

  /* ══ Lint gate (D5 step 1) ══ */
  const handleCheck = useCallback(async () => {
    const id = templateId ?? jobId;
    if (isChecking || !id) return;
    setIsChecking(true);
    setCheckError(null);
    setCheckReport(null);
    try {
      const res = await fetch(
        `/api/studio/template/${encodeURIComponent(id)}/check`,
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Check failed (HTTP ${res.status})${txt ? `: ${txt.slice(0, 200)}` : ""}`,
        );
      }
      const data: CheckReport = await res.json();
      setCheckReport(data);
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : "Check failed unexpectedly.");
    } finally {
      setIsChecking(false);
    }
  }, [templateId, jobId, isChecking]);

  /* ══ Vision-QA gate (D5 step 3) — async: 202 while the GLM review runs ══ */
  const handleReview = useCallback(async () => {
    const id = templateId ?? jobId;
    if (isReviewing || !id) return;
    setIsReviewing(true);
    setReviewError(null);
    setReviewReport(null);
    let got = false;
    try {
      // The relay returns 200 once a fresh report is cached, or 202 while a
      // detached review runs (~30s warm → minutes cold). Poll until 200.
      for (let i = 0; i < 40; i++) {
        const res = await fetch(`/api/studio/template/${encodeURIComponent(id)}/review`);
        if (res.status === 200) {
          setReviewReport((await res.json()) as ReviewReport);
          got = true;
          break;
        }
        if (res.status !== 202) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Review failed (HTTP ${res.status})${txt ? `: ${txt.slice(0, 150)}` : ""}`);
        }
        await new Promise((r) => setTimeout(r, 8000));
      }
      if (!got) setReviewError("Review is still running on the farm — click Review again shortly.");
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Review failed unexpectedly.");
    } finally {
      setIsReviewing(false);
    }
  }, [templateId, jobId, isReviewing]);

  /* ══ Human-approve (D5 step 4) ══ */
  const handleApprove = useCallback(
    async (decision: "approved" | "rejected") => {
      const id = templateId ?? jobId;
      const mp4 = reviewReport?.video?.split("/").pop();
      if (!id || !mp4 || isApproving) return;
      setIsApproving(true);
      try {
        const res = await fetch(`/api/studio/template/${encodeURIComponent(id)}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: decision,
            mp4,
            score: typeof reviewReport?.average_score === "number" ? reviewReport.average_score : undefined,
          }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Approve failed (HTTP ${res.status})${txt ? `: ${txt.slice(0, 150)}` : ""}`);
        }
        setApproval((await res.json()) as ApprovalState);
        // If a gate run is awaiting approval, close it (the ApprovalBadge shows the result).
        setGate((g) => (g.phase === "awaiting" ? { phase: "idle" } : g));
      } catch {
        /* keep prior approval state on error */
      } finally {
        setIsApproving(false);
      }
    },
    [templateId, jobId, reviewReport, isApproving],
  );

  /* ══ Gate orchestration (D5): chain check → render → review → awaiting-approve ══ */
  const cancelGate = useCallback(() => setGate({ phase: "idle" }), []);

  const handleRunGate = useCallback(async () => {
    const id = templateId ?? jobId;
    if (!id || gate.phase !== "idle") return;
    const PENDING: GateSteps = { check: "pending", render: "pending", review: "pending", approve: "pending" };
    const failGate = (step: "check" | "render" | "review", error: string) =>
      setGate({ phase: "failed", steps: { ...PENDING, [step]: "fail" }, error });
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const esc = encodeURIComponent;

    // 1. Check (lint + runtime validate)
    setGate({ phase: "checking", steps: { ...PENDING, check: "running" } });
    try {
      const cr = await fetch(`/api/studio/template/${esc(id)}/check`);
      if (!cr.ok) throw new Error(`Check HTTP ${cr.status}`);
      const check: CheckReport = await cr.json();
      if (!check.ok) {
        setCheckReport(check);
        setGate({ phase: "failed", steps: { ...PENDING, check: "fail" }, error: "Lint or runtime errors" });
        return;
      }
    } catch (e) {
      failGate("check", e instanceof Error ? e.message : "check failed");
      return;
    }

    // 2. Render (POST → poll to completed)
    setGate({ phase: "rendering", steps: { ...PENDING, check: "pass", render: "running" }, progress: 0 });
    let renderJobId: string | null = null;
    try {
      const rr = await fetch(`/api/studio/template/${esc(id)}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const rj = (await rr.json()) as { jobId?: string; error?: string };
      if (!rr.ok || !rj.jobId) throw new Error(rj.error || `Render HTTP ${rr.status}`);
      renderJobId = rj.jobId;
    } catch (e) {
      failGate("render", e instanceof Error ? e.message : "render enqueue failed");
      return;
    }
    let rendered = false;
    for (let i = 0; i < 120; i++) {
      await sleep(5000);
      try {
        const s = await fetch(`/api/studio/template/${esc(id)}/render/${esc(renderJobId)}`);
        const sj = (await s.json()) as { status?: string; progress?: number; output?: string | null; error?: string };
        if (sj.status === "completed") {
          setRenderOutput(sj.output ?? null);
          rendered = true;
          break;
        }
        if (sj.status === "failed") throw new Error(sj.error || "render failed");
        if (typeof sj.progress === "number") {
          setGate((g) => (g.phase === "rendering" ? { ...g, progress: sj.progress } : g));
        }
      } catch (e) {
        failGate("render", e instanceof Error ? e.message : "render failed");
        return;
      }
    }
    if (!rendered) {
      failGate("render", "render timed out");
      return;
    }

    // 3. Review (poll 202 → 200)
    setGate({ phase: "reviewing", steps: { ...PENDING, check: "pass", render: "pass", review: "running" } });
    let reviewed = false;
    try {
      // Cold GLM reviews (after a fresh render invalidates the cache) can take
      // several minutes; poll patiently (90 × 8s ≈ 12min).
      for (let i = 0; i < 90; i++) {
        const rv = await fetch(`/api/studio/template/${esc(id)}/review`);
        if (rv.status === 200) {
          setReviewReport((await rv.json()) as ReviewReport);
          reviewed = true;
          break;
        }
        if (rv.status !== 202) throw new Error(`Review HTTP ${rv.status}`);
        await sleep(8000);
      }
    } catch (e) {
      failGate("review", e instanceof Error ? e.message : "review failed");
      return;
    }
    if (!reviewed) {
      failGate("review", "review timed out");
      return;
    }

    // 4. Awaiting human approval — the ReviewModal (with Approve/Reject) opens via reviewReport.
    setGate({ phase: "awaiting", steps: { ...PENDING, check: "pass", render: "pass", review: "pass" } });
  }, [templateId, jobId, gate.phase]);

  /* ══ LLM proposal (D4 — the gate's caller) ══
   * Ask GLM (via the relay chat proxy) to propose slot-value edits from a
   * free-form prompt. The proposal comes back as a diff for review — never
   * auto-applied. handlePropose only fetches it; the producer Accept/Rejects. */
  const handlePropose = useCallback(async () => {
    const id = templateId ?? jobId;
    if (!id || isProposing || !proposePrompt.trim()) return;
    setIsProposing(true);
    setProposeError(null);
    setProposal(null);
    try {
      const res = await fetch(`/api/studio/template/${encodeURIComponent(id)}/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: proposePrompt.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as ProposalResult & { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setProposal(data);
    } catch (e) {
      setProposeError(e instanceof Error ? e.message : "Proposal failed.");
    } finally {
      setIsProposing(false);
    }
  }, [templateId, jobId, isProposing, proposePrompt]);

  // Accept the diff: apply locally, persist (deterministic save), then run the
  // verification gate — an LLM-proposed change is non-deterministic, so it must
  // pass lint → render → review → approve before it counts (D4/D5).
  const handleAcceptProposal = useCallback(async () => {
    if (!proposal || !proposal.changes.length || !manifest?.slotValues) return;
    const id = templateId ?? jobId;
    const changes = proposal.changes;
    // 1. Apply to local editor state so the Slots tab reflects the new values.
    setManifest((prev) => {
      if (!prev || !prev.slotValues) return prev;
      const slotValues = { ...prev.slotValues };
      for (const c of changes) slotValues[c.slotId] = c.to;
      return { ...prev, slotValues };
    });
    setProposal(null);
    setProposePrompt("");
    setProposeError(null);
    if (!id) return;
    // 2. Persist (must land before the gate's render reads the saved slotValues).
    const vals: Record<string, string | number> = {};
    for (const c of changes) vals[c.slotId] = c.to;
    try {
      await fetch(`/api/studio/template/${encodeURIComponent(id)}/values`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: vals }),
      });
    } catch {
      /* best-effort; the gate still runs */
    }
    // 3. Run the verification gate — this is the gate's real caller.
    handleRunGate();
  }, [proposal, manifest, templateId, jobId, handleRunGate]);

  /* Load the approval state on mount (setState is after await, so it doesn't trip
   * react-hooks/set-state-in-effect). */
  useEffect(() => {
    const id = templateId ?? jobId;
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/studio/template/${encodeURIComponent(id)}/approve`);
        if (!cancelled && res.ok) setApproval((await res.json()) as ApprovalState);
      } catch {
        /* approval is advisory in the UI — ignore transient errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, jobId]);
  /* A render completing means a new cut is pending sign-off — refresh approval. */
  useEffect(() => {
    if (renderPhase !== "completed") return;
    const id = templateId ?? jobId;
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/studio/template/${encodeURIComponent(id)}/approve`);
        if (!cancelled && res.ok) setApproval((await res.json()) as ApprovalState);
      } catch {
        /* advisory */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [renderPhase, templateId, jobId]);

  /* ══ Render (render bridge → relay → core-control farm → mp4) ══ */
  const handleRender = useCallback(async () => {
    const id = templateId ?? jobId;
    if (!manifest || !id) return;
    if (isRerendering || renderPhase === "queued" || renderPhase === "running") return;

    setIsRerendering(true);
    setRenderError(null);
    setRenderSuccess(null);
    setRenderPhase(null);
    setRenderProgress(0);
    setRenderOutput(null);

    try {
      // The bridge enqueues by template id; slot values are forwarded server-side
      // from the saved values.json (not yet applied by the render — see D5).
      const res = await fetch(`/api/studio/template/${encodeURIComponent(id)}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Prefer the upstream detail (e.g. "a pending or running job already
        // exists") over the bridge's terse "relay 409 for …" wrapper.
        throw new Error(
          (data?.upstream && (data.upstream as { error?: string }).error) ||
            data?.error ||
            `Render failed (HTTP ${res.status})`,
        );
      }
      const returnedJobId: string | undefined = data?.jobId;
      if (!returnedJobId) throw new Error("Render bridge returned no jobId.");
      setNewJobId(returnedJobId);
      setRenderPhase((data?.status as string) === "running" ? "running" : "queued");
    } catch (e) {
      setRenderError(e instanceof Error ? e.message : "Render failed unexpectedly.");
    } finally {
      setIsRerendering(false);
    }
  }, [manifest, templateId, jobId, isRerendering, renderPhase]);

  /* ── Poll the bridge job until it completes or fails. Non-blocking: this only
   * updates the progress pill; the editor stays fully usable while it runs. ── */
  useEffect(() => {
    if (!newJobId || !renderPhase) return;
    if (renderPhase === "completed" || renderPhase === "failed") return;
    const id = templateId ?? jobId;
    if (!id) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/studio/template/${encodeURIComponent(id)}/render/${encodeURIComponent(newJobId)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setRenderPhase("failed");
          setRenderError(data?.error || `Status poll failed (HTTP ${res.status}).`);
          return;
        }
        const st = (data?.status as string) || "running";
        setRenderProgress(typeof data?.progress === "number" ? data.progress : 0);
        if (st === "completed") {
          setRenderPhase("completed");
          setRenderOutput(data?.output || null);
        } else if (st === "failed") {
          setRenderPhase("failed");
          setRenderError(data?.error || "Render failed on the farm.");
        } else {
          setRenderPhase(st === "queued" ? "queued" : "running");
        }
      } catch {
        // Transient network blip — leave phase as-is; the next tick retries.
      }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [newJobId, renderPhase, templateId, jobId]);

  /* ═══════════════════════════════════════════════════════════════════════
   * Render
   * ═══════════════════════════════════════════════════════════════════════ */
  const renderId = templateId ?? jobId;
  const renderBusy =
    isRerendering || renderPhase === "queued" || renderPhase === "running";

  const overlay = (
    <div style={overlayStyle}>
      <style>{cssGlobal}</style>
      <div style={modalContainerStyle}>
        {/* ── Header bar ── */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={logoBadgeStyle}>
              <Scissors size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: "1.05rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1 }}>
                Timeline Editor
              </div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" }}>
                {manifest?.title
                  ? manifest.title
                  : jobId
                    ? `Job: ${jobId.slice(0, 12)}…`
                    : templateId || "Editor"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRerendering}
            style={{
              ...closeBtnBase,
              opacity: isRerendering ? 0.5 : 1,
              cursor: isRerendering ? "not-allowed" : "pointer",
            }}
            aria-label="Close editor"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* ── Load warning ── */}
        {loadError && (
          <div style={warningBarStyle}>
            <AlertCircle size={16} /> {loadError}
          </div>
        )}

        {/* ── Loading ── */}
        {!manifest && (
          <div style={loadingContainerStyle}>
            <Loader2 size={40} className="tl-spin" style={{ animation: "tl-spin 0.8s linear infinite" }} />
            <div style={{ fontWeight: 900, textTransform: "uppercase", marginTop: "12px" }}>
              Loading manifest…
            </div>
          </div>
        )}

        {/* ── Main content ── */}
        {manifest && (
          <>
            {/* ════ TIMELINE BAR ════ */}
            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 900, textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.03em" }}>
                  <Film size={16} /> Timeline
                </div>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={13} /> {totalDuration.toFixed(1)}s total
                </div>
              </div>

              <div style={timelineTrackStyle}>
                {manifest.beats.map((beat, i) => {
                  const pct = totalDuration > 0 ? (beat.duration / totalDuration) * 100 : 100 / manifest.beats.length;
                  const isSelected = selectedBeat === i;
                  const icon = LAYOUT_OPTIONS.find((l) => l.value === beat.layout)?.icon || "🎬";
                  return (
                    <button
                      key={beat.id}
                      type="button"
                      onClick={() => {
                        setSelectedBeat(i);
                        setActiveTab("beats");
                      }}
                      style={{
                        ...timelineBlockStyle,
                        width: `${pct}%`,
                        backgroundColor: isSelected ? COLORS.accent : COLORS.surface,
                        color: isSelected ? "#fff" : COLORS.text,
                        transform: isSelected ? "translateY(-3px)" : "none",
                        boxShadow: isSelected ? "4px 4px 0 #0a0a0a" : "2px 2px 0 #0a0a0a",
                        zIndex: isSelected ? 2 : 1,
                      }}
                      title={`${beat.headline} — ${beat.duration}s`}
                    >
                      <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{icon}</span>
                      <span style={{ fontSize: "0.65rem", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                        {i + 1}. {beat.headline.slice(0, 14)}
                      </span>
                      <span style={{ fontSize: "0.6rem", fontWeight: 700, opacity: 0.8 }}>
                        {beat.duration}s
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={addBeat}
                  style={addBeatBlockStyle}
                  title="Add beat"
                >
                  <Plus size={22} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* ════ TAB BAR ════ */}
            <div style={tabBarStyle}>
              <TabButton active={activeTab === "beats"} onClick={() => setActiveTab("beats")} icon={<Layers size={16} />} label="Beats" />
              <TabButton active={activeTab === "style"} onClick={() => setActiveTab("style")} icon={<Palette size={16} />} label="Style" />
              <TabButton active={activeTab === "audio"} onClick={() => setActiveTab("audio")} icon={<Music size={16} />} label="Audio" />
              {manifest.slots?.length ? (
                <TabButton active={activeTab === "slots"} onClick={() => setActiveTab("slots")} icon={<Type size={16} />} label={`Slots (${manifest.slots.length})`} />
              ) : null}
            </div>

            {/* ════ TAB CONTENT ════ */}
            <div style={tabContentStyle}>
              {activeTab === "beats" && (
                <BeatsTab
                  manifest={manifest}
                  selectedBeat={selectedBeat}
                  onSelectBeat={setSelectedBeat}
                  onUpdateBeat={updateBeat}
                  onDeleteBeat={deleteBeat}
                  onMoveBeat={moveBeat}
                  onAddBeat={addBeat}
                />
              )}
              {activeTab === "style" && (
                <StyleTab
                  manifest={manifest}
                  onChange={(patch) => setManifest((prev) => (prev ? { ...prev, ...patch } : prev))}
                />
              )}
              {activeTab === "audio" && (
                <AudioTab
                  manifest={manifest}
                  onChange={(patch) => setManifest((prev) => (prev ? { ...prev, ...patch } : prev))}
                />
              )}
              {activeTab === "slots" && manifest.slots && manifest.slotValues && (
                <SlotsTab
                  slots={manifest.slots}
                  values={manifest.slotValues}
                  onChange={updateSlot}
                  onSave={handleSaveSlots}
                  saveState={slotSave}
                />
              )}
            </div>

            {/* ════ FOOTER: render + status ════ */}
            <div style={footerStyle}>
              {approval && <ApprovalBadge approval={approval} />}
              {gate.phase !== "idle" && <GatePanel gate={gate} onDismiss={cancelGate} />}
              {(renderPhase === "queued" || renderPhase === "running") && (
                <div style={successPillStyle}>
                  <Loader2 size={15} className="tl-spin" style={{ animation: "tl-spin 0.8s linear infinite" }} />
                  <span style={{ flex: 1 }}>Rendering on the farm… {renderProgress}%</span>
                </div>
              )}
              {renderPhase === "completed" && (
                <div style={successPillStyle}>
                  <Check size={15} />
                  <span style={{ flex: 1 }}>
                    {renderOutput ? (
                      <>Render ready → <code style={{ fontSize: "0.8rem" }}>{String(renderOutput).split("/").pop()}</code></>
                    ) : (
                      "Render complete."
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRenderPhase(null);
                      setRenderOutput(null);
                    }}
                    style={dismissBtnStyle}
                  >
                    Dismiss
                  </button>
                </div>
              )}
              {renderError && (
                <div style={errorPillStyle}>
                  <AlertCircle size={15} /> <span style={{ flex: 1 }}>{renderError}</span>
                  <button type="button" onClick={() => setRenderError(null)} style={dismissBtnStyle}>Dismiss</button>
                </div>
              )}
              {renderSuccess && (
                <div style={successPillStyle}>
                  <Check size={15} /> <span style={{ flex: 1 }}>{renderSuccess}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                {/* Ask AI — LLM-proposed slot edits (D4: the gate's caller) */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 100%", minWidth: 280, marginBottom: "2px" }}>
                  <input
                    value={proposePrompt}
                    onChange={(e) => setProposePrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handlePropose();
                      }
                    }}
                    placeholder="Ask AI to edit — e.g. “deal status to AVAILABLE, warmer accent colour”"
                    disabled={isProposing}
                    style={{ ...inputStyle, flex: 1, fontWeight: 500, textTransform: "none" }}
                  />
                  <button
                    type="button"
                    onClick={handlePropose}
                    disabled={isProposing || !proposePrompt.trim()}
                    style={{
                      ...renderBtnStyle,
                      padding: "12px 18px",
                      opacity: isProposing || !proposePrompt.trim() ? 0.7 : 1,
                      cursor: isProposing || !proposePrompt.trim() ? "not-allowed" : "pointer",
                    }}
                    title="Ask the AI to propose slot edits — you review the diff before it applies"
                  >
                    {isProposing ? (
                      <>
                        <Loader2 size={18} className="tl-spin" style={{ animation: "tl-spin 0.8s linear infinite" }} />
                        Thinking…
                      </>
                    ) : (
                      <>
                        <Bot size={18} /> Ask AI
                      </>
                    )}
                  </button>
                </div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase" }}>
                  {manifest.beats.length} beats · {totalDuration.toFixed(1)}s
                </div>
                <button
                  type="button"
                  onClick={handleInspect}
                  disabled={isInspecting || !jobId}
                  style={{
                    ...inspectBtnStyle,
                    opacity: isInspecting || !jobId ? 0.7 : 1,
                    cursor: isInspecting || !jobId ? "not-allowed" : "pointer",
                  }}
                  title={
                    jobId
                      ? "Run HyperFrames Inspector — audit for overflow, contrast, and layout issues"
                      : "Inspect requires a rendered job"
                  }
                >
                  {isInspecting ? (
                    <>
                      <Loader2 size={18} className="tl-spin" style={{ animation: "tl-spin 0.8s linear infinite" }} />
                      Inspecting…
                    </>
                  ) : (
                    <>
                      <ScanSearch size={18} /> Inspect
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCheck}
                  disabled={isChecking}
                  style={{
                    ...inspectBtnStyle,
                    opacity: isChecking ? 0.7 : 1,
                    cursor: isChecking ? "not-allowed" : "pointer",
                  }}
                  title="Run the structural lint gate (hyperframes lint) on this composition"
                >
                  {isChecking ? (
                    <>
                      <Loader2 size={18} className="tl-spin" style={{ animation: "tl-spin 0.8s linear infinite" }} />
                      Checking…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} /> Check
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleReview}
                  disabled={isReviewing}
                  style={{
                    ...inspectBtnStyle,
                    opacity: isReviewing ? 0.7 : 1,
                    cursor: isReviewing ? "not-allowed" : "pointer",
                  }}
                  title="Run the vision-QA gate (GLM reviews 12 rendered frames)"
                >
                  {isReviewing ? (
                    <>
                      <Loader2 size={18} className="tl-spin" style={{ animation: "tl-spin 0.8s linear infinite" }} />
                      Reviewing…
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} /> Review
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRender}
                  disabled={!renderId || renderBusy}
                  style={{
                    ...renderBtnStyle,
                    opacity: !renderId || renderBusy ? 0.7 : 1,
                    cursor: !renderId || renderBusy ? "not-allowed" : "pointer",
                  }}
                  title={renderId ? "Render this template to an mp4 via the render farm" : "No template id"}
                >
                  {renderBusy ? (
                    <>
                      <Loader2 size={18} className="tl-spin" style={{ animation: "tl-spin 0.8s linear infinite" }} />
                      {renderPhase === "queued" || renderPhase === "running"
                        ? `Rendering… ${renderProgress}%`
                        : "Starting…"}
                    </>
                  ) : (
                    <>
                      <RefreshCw size={18} /> Render Video
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRunGate}
                  disabled={gate.phase !== "idle" || renderBusy || isReviewing}
                  style={{
                    ...renderBtnStyle,
                    background: gate.phase === "idle" ? renderBtnStyle.background : "#1d3a8a",
                    color: "#fff",
                    opacity: gate.phase !== "idle" || renderBusy || isReviewing ? 0.7 : 1,
                    cursor: gate.phase !== "idle" || renderBusy || isReviewing ? "not-allowed" : "pointer",
                  }}
                  title="Run the full verification gate: lint → render → vision-QA → approve"
                >
                  {gate.phase !== "idle" ? (
                    <>
                      <Loader2 size={18} className="tl-spin" style={{ animation: "tl-spin 0.8s linear infinite" }} />
                      Gate running…
                    </>
                  ) : (
                    <>
                      <Wand2 size={18} /> Run Gate
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Render status (non-blocking) lives in the footer pill below — the
            server-side render takes minutes, so we don't lock the editor. */}

        {/* ── Inspect overlay (running) ── */}
        {isInspecting && (
          <div style={rerenderOverlayStyle}>
            <div style={{ ...rerenderCardStyle, backgroundColor: COLORS.bg, color: COLORS.text }}>
              <Loader2 size={44} className="tl-spin" style={{ animation: "tl-spin 0.8s linear infinite" }} />
              <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.1rem", letterSpacing: "0.03em", marginTop: "16px" }}>
                Inspecting layout…
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.8, marginTop: "6px" }}>
                HyperFrames Inspector is auditing overflow, contrast &amp; layout in headless Chrome.
              </div>
            </div>
          </div>
        )}

        {/* ── Check overlay (running) ── */}
        {isChecking && (
          <div style={rerenderOverlayStyle}>
            <div style={{ ...rerenderCardStyle, backgroundColor: COLORS.bg, color: COLORS.text }}>
              <Loader2 size={44} className="tl-spin" style={{ animation: "tl-spin 0.8s linear infinite" }} />
              <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.1rem", letterSpacing: "0.03em", marginTop: "16px" }}>
                Running lint gate…
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.8, marginTop: "6px" }}>
                hyperframes lint is validating the composition structure &amp; determinism.
              </div>
            </div>
          </div>
        )}

        {/* ── Inspect results modal ── */}
        {(inspectReport || inspectError) && !isInspecting && (
          <InspectModal
            report={inspectReport}
            error={inspectError}
            onClose={() => {
              setInspectReport(null);
              setInspectError(null);
            }}
          />
        )}

        {/* ── LLM proposal modal (D4: review the diff before applying) ── */}
        {(proposal || proposeError) && !isProposing && (
          <ProposeModal
            proposal={proposal}
            error={proposeError}
            onAccept={handleAcceptProposal}
            onReject={() => {
              setProposal(null);
              setProposeError(null);
            }}
          />
        )}

        {/* ── Review overlay (running) ── */}
        {isReviewing && (
          <div style={rerenderOverlayStyle}>
            <div style={{ ...rerenderCardStyle, backgroundColor: COLORS.bg, color: COLORS.text }}>
              <Loader2 size={44} className="tl-spin" style={{ animation: "tl-spin 0.8s linear infinite" }} />
              <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.1rem", letterSpacing: "0.03em", marginTop: "16px" }}>
                Running vision-QA…
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.8, marginTop: "6px" }}>
                GLM-4.6V is scoring 12 rendered frames. This can take a minute.
              </div>
            </div>
          </div>
        )}

        {/* ── Check results modal (lint gate) ── */}
        {(checkReport || checkError) && !isChecking && (
          <CheckModal
            report={checkReport}
            error={checkError}
            onClose={() => {
              setCheckReport(null);
              setCheckError(null);
            }}
          />
        )}

        {/* ── Review results modal (vision-QA) ── */}
        {(reviewReport || reviewError) && !isReviewing && (
          <ReviewModal
            report={reviewReport}
            error={reviewError}
            approval={approval}
            isApproving={isApproving}
            onApprove={handleApprove}
            onClose={() => {
              setReviewReport(null);
              setReviewError(null);
            }}
          />
        )}
      </div>
    </div>
  );

  // createPortal into document.body — guard for SSR.
  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

/* ════════════════════════════════════════════════════════════════════════════
 * Sub-component: TabButton
 * ════════════════════════════════════════════════════════════════════════════ */

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "10px 20px",
        border: BORDER_SM,
        boxShadow: active ? SHADOW_SM : "none",
        fontSize: "0.8rem",
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        cursor: "pointer",
        fontFamily: "inherit",
        flex: "1 1 120px",
        backgroundColor: active ? COLORS.accent : COLORS.surface,
        color: active ? "#fff" : COLORS.text,
        transform: active ? "translate(-1px,-1px)" : "none",
        transition: "all 80ms ease",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Sub-component: InspectModal — HyperFrames Inspector results
 * Shows overflow / contrast / layout issues detected by `hyperframes inspect`.
 * ════════════════════════════════════════════════════════════════════════════ */

function InspectModal({
  report,
  error,
  onClose,
}: {
  report: InspectReport | null;
  error: string | null;
  onClose: () => void;
}) {
  const issues = report?.issues ?? [];
  const clean = (report?.ok ?? false) || issues.length === 0;

  return (
    <div style={inspectOverlayStyle}>
      <div style={inspectModalStyle}>
        {/* Header */}
        <div style={inspectHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={logoBadgeStyle}>
              <ScanSearch size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: "1.05rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1 }}>
                Layout Inspector
              </div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" }}>
                Overflow · Contrast · Layout audit
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={closeBtnBase}
            aria-label="Close inspect results"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div style={inspectBodyStyle}>
          {error && (
            <div style={errorPillStyle}>
              <AlertCircle size={15} /> <span style={{ flex: 1 }}>{error}</span>
            </div>
          )}

          {!error && clean && (
            <div style={inspectCleanStyle}>
              <Check size={40} strokeWidth={3} />
              <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1rem", marginTop: "10px" }}>
                No layout issues detected
              </div>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: COLORS.textMuted, marginTop: "4px" }}>
                {report?.samples?.length
                  ? `Audited ${report.samples.length} timeline samples`
                  : "Composition passed the visual audit."}
              </div>
            </div>
          )}

          {!error && !clean && (
            <>
              {/* Summary counts */}
              <div style={inspectSummaryStyle}>
                <CountPill label="Issues" value={report?.issueCount ?? issues.length} tone="warn" />
                <CountPill label="Errors" value={report?.errorCount ?? 0} tone="error" />
                <CountPill label="Warnings" value={report?.warningCount ?? 0} tone="warn" />
                <CountPill label="Info" value={report?.infoCount ?? 0} tone="info" />
                {report?.samples?.length ? (
                  <span style={{ fontSize: "0.65rem", fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", marginLeft: "auto" }}>
                    {report.samples.length} samples
                  </span>
                ) : null}
              </div>

              {/* Issue list */}
              <div style={inspectListStyle}>
                {issues.map((issue, i) => (
                  <InspectIssueRow key={i} issue={issue} />
                ))}
                {report?.truncated && (
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: COLORS.textMuted, fontStyle: "italic", padding: "6px 4px" }}>
                    Output truncated — more issues may exist.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase" }}>
            Powered by HyperFrames Inspector
          </div>
          <button type="button" onClick={onClose} style={inspectCloseBtnStyle}>
            <X size={16} /> Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Sub-component: ProposeModal — LLM-proposed slot-edit diff (D4)
 * Shows the GLM-proposed slot changes (old → new + reason) for the producer to
 * Accept (apply + persist + run the gate) or Reject. Schema-rejected proposals
 * are listed. Nothing applies until Accept.
 * ════════════════════════════════════════════════════════════════════════════ */

function ProposeModal({
  proposal,
  error,
  onAccept,
  onReject,
}: {
  proposal: ProposalResult | null;
  error: string | null;
  onAccept: () => void;
  onReject: () => void;
}) {
  const changes = proposal?.changes ?? [];
  const rejected = proposal?.rejected ?? [];
  const empty = changes.length === 0;

  return (
    <div style={inspectOverlayStyle}>
      <div style={inspectModalStyle}>
        {/* Header */}
        <div style={inspectHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={logoBadgeStyle}>
              <Bot size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: "1.05rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1 }}>
                AI Edit Proposal
              </div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" }}>
                Review the diff · nothing applies until you accept
              </div>
            </div>
          </div>
          <button type="button" onClick={onReject} style={closeBtnBase} aria-label="Close proposal">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div style={inspectBodyStyle}>
          {error && (
            <div style={errorPillStyle}>
              <AlertCircle size={15} /> <span style={{ flex: 1 }}>{error}</span>
            </div>
          )}

          {!error && proposal?.summary && (
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: COLORS.text, padding: "2px 2px 10px" }}>
              {proposal.summary}
            </div>
          )}

          {!error && empty && (
            <div style={inspectCleanStyle}>
              <Bot size={40} strokeWidth={2.5} />
              <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1rem", marginTop: "10px" }}>
                No slot edits proposed
              </div>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: COLORS.textMuted, marginTop: "4px" }}>
                The request needs structural changes the AI can&apos;t make via slots alone.
              </div>
            </div>
          )}

          {!error && !empty && (
            <div style={inspectListStyle}>
              {changes.map((c) => (
                <ProposalChangeRow key={c.slotId} change={c} />
              ))}
              {rejected.length > 0 && (
                <div style={{ borderTop: `2px dashed ${COLORS.textMuted}`, marginTop: "8px", paddingTop: "8px" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 800, color: COLORS.danger, textTransform: "uppercase", marginBottom: "4px" }}>
                    Rejected by schema ({rejected.length})
                  </div>
                  {rejected.map((r, i) => (
                    <div key={i} style={{ fontSize: "0.72rem", fontWeight: 600, color: COLORS.textMuted, padding: "2px 0" }}>
                      {r.slotId}: {r.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          {!empty && (
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase" }}>
              {changes.length} change{changes.length === 1 ? "" : "s"} · accept runs the gate
            </div>
          )}
          <div style={{ display: "flex", gap: "10px", marginLeft: "auto" }}>
            <button type="button" onClick={onReject} style={inspectCloseBtnStyle}>
              <X size={16} /> Reject
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={empty}
              style={{
                ...renderBtnStyle,
                backgroundColor: COLORS.success,
                opacity: empty ? 0.5 : 1,
                cursor: empty ? "not-allowed" : "pointer",
              }}
            >
              <Check size={16} /> Accept &amp; Run Gate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProposalChangeRow({ change }: { change: ProposalChange }) {
  const isColor = change.type === "color";
  const toStr = String(change.to);
  const hexOk = /^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/.test(toStr);
  return (
    <div style={{ padding: "8px 10px", border: BORDER_SM, backgroundColor: COLORS.bg, marginBottom: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 800 }}>{change.label}</span>
        <span style={{ fontSize: "0.6rem", fontWeight: 800, color: COLORS.textMuted, textTransform: "uppercase", border: `2px solid ${COLORS.textMuted}`, padding: "1px 6px" }}>
          {change.type}
        </span>
        <span style={{ fontSize: "0.8rem", fontFamily: "monospace", color: COLORS.textMuted }}>
          {String(change.from)}
        </span>
        <ArrowRight size={14} style={{ color: COLORS.accent }} />
        <span style={{ fontSize: "0.85rem", fontFamily: "monospace", fontWeight: 800, color: COLORS.text }}>
          {toStr}
        </span>
        {isColor && hexOk && (
          <span
            style={{
              display: "inline-block",
              width: "16px",
              height: "16px",
              border: `2px solid ${COLORS.border}`,
              backgroundColor: toStr.startsWith("#") ? toStr : `#${toStr}`,
            }}
          />
        )}
      </div>
      {change.reason && (
        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: COLORS.textMuted, marginTop: "4px" }}>
          {change.reason}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Sub-component: CheckModal — structural lint gate results (D5 step 1)
 * Shows the hyperframes lint verdict + findings (errors = hard fail, warnings/info advisory).
 * ════════════════════════════════════════════════════════════════════════════ */

function CheckModal({
  report,
  error,
  onClose,
}: {
  report: CheckReport | null;
  error: string | null;
  onClose: () => void;
}) {
  const lint = report?.lint;
  const validate = report?.validate;
  const lintFindings = lint?.findings ?? [];
  const lintErrors = lint?.errorCount ?? 0;
  const valErrors = validate?.errorCount ?? 0;
  const clean = report?.ok ?? false;
  const sectionLabel = {
    fontSize: "0.7rem",
    fontWeight: 900,
    textTransform: "uppercase",
    color: COLORS.textMuted,
    margin: "12px 0 6px",
    letterSpacing: "0.03em",
  } as const;

  return (
    <div style={inspectOverlayStyle}>
      <div style={inspectModalStyle}>
        {/* Header */}
        <div style={inspectHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={logoBadgeStyle}>
              <ShieldCheck size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: "1.05rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1 }}>
                Composition Check
              </div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" }}>
                Structure · Determinism · Runtime gate (D5)
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={closeBtnBase} aria-label="Close lint report">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div style={inspectBodyStyle}>
          {error && (
            <div style={errorPillStyle}>
              <AlertCircle size={15} /> <span style={{ flex: 1 }}>{error}</span>
            </div>
          )}

          {!error && (
            <>
              {/* Overall verdict */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                <span style={{ fontSize: "1.3rem", lineHeight: 1, color: clean ? "#1d8a3a" : "#b00020" }}>
                  {clean ? "✓" : "✗"}
                </span>
                <span style={{ fontSize: "0.8rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.03em", color: clean ? "#1d8a3a" : "#b00020" }}>
                  {clean ? "Passed lint + runtime" : "Issues found"}
                </span>
              </div>

              {/* Lint section (structure / determinism) */}
              <div style={sectionLabel}>Structure · Determinism (lint)</div>
              <div style={inspectSummaryStyle}>
                <CountPill label="Errors" value={lintErrors} tone="error" />
                <CountPill label="Warnings" value={lint?.warningCount ?? 0} tone="warn" />
                <CountPill label="Info" value={lint?.infoCount ?? 0} tone="info" />
              </div>
              {lintFindings.length > 0 && (
                <div style={inspectListStyle}>
                  {lintFindings.slice(0, 12).map((f, i) => (
                    <CheckFindingRow key={i} finding={f} />
                  ))}
                </div>
              )}

              {/* Validate section (runtime / contrast) */}
              <div style={sectionLabel}>
                Runtime · Contrast (validate) — {validate?.ok ? "renders ✓" : "renders ✗"}
              </div>
              <div style={inspectSummaryStyle}>
                <CountPill label="JS/asset errors" value={valErrors} tone="error" />
                <CountPill label="Contrast failures" value={validate?.contrastFailures ?? 0} tone="warn" />
              </div>
              {validate?.errors && validate.errors.length > 0 && (
                <div style={inspectListStyle}>
                  {validate.errors.slice(0, 8).map((e, i) => (
                    <div key={i} style={{ padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)", fontSize: "0.78rem", color: COLORS.text }}>
                      <strong style={{ color: "#b00020" }}>error:</strong> {e?.message ? String(e.message) : JSON.stringify(e)}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase" }}>
            Powered by hyperframes lint + validate
          </div>
          <button type="button" onClick={onClose} style={inspectCloseBtnStyle}>
            <X size={16} /> Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckFindingRow({ finding }: { finding: CheckFinding }) {
  const sev = (finding.severity || "info").toLowerCase();
  const tone = sev === "error" ? "error" : sev === "warning" ? "warn" : "info";
  const bg = tone === "error" ? "#ffe2e2" : tone === "warn" ? "#fff3cd" : "#e2e8ff";
  const fg = tone === "error" ? "#b00020" : tone === "warn" ? "#8a6d00" : "#1d3a8a";
  return (
    <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", gap: "10px", alignItems: "flex-start" }}>
      <span style={{ fontSize: "0.6rem", fontWeight: 900, textTransform: "uppercase", padding: "2px 6px", background: bg, color: fg, flexShrink: 0, letterSpacing: "0.03em" }}>
        {sev}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: COLORS.text, wordBreak: "break-word" }}>
          {finding.code || sev}
        </div>
        {finding.message && (
          <div style={{ fontSize: "0.78rem", color: COLORS.textMuted, marginTop: "2px" }}>{finding.message}</div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Sub-component: ReviewModal — vision-QA results (D5 step 3)
 * GLM-4.6V scored 12 rendered frames 0-10; shows verdict, score, per-frame bars,
 * issues, and recommended (P0/P1/P2) fixes.
 * ════════════════════════════════════════════════════════════════════════════ */

function ReviewModal({
  report,
  error,
  approval,
  isApproving,
  onApprove,
  onClose,
}: {
  report: ReviewReport | null;
  error: string | null;
  approval: ApprovalState | null;
  isApproving: boolean;
  onApprove: (decision: "approved" | "rejected") => void;
  onClose: () => void;
}) {
  const score = report?.average_score ?? 0;
  const passed = report?.passed ?? false;
  const frames = report?.per_frame ?? [];
  const issues = report?.all_issues ?? [];
  const fixes = report?.fixes ?? [];
  const verdictColor = passed ? "#1d8a3a" : "#b00020";
  const barColor = (s: number) => (s >= 8 ? "#1d8a3a" : s >= 6 ? "#caa000" : "#b00020");
  const prioColor = (p: string) =>
    p === "P0" ? "#b00020" : p === "P1" ? "#8a6d00" : "#1d3a8a";

  return (
    <div style={inspectOverlayStyle}>
      <div style={inspectModalStyle}>
        {/* Header */}
        <div style={inspectHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={logoBadgeStyle}>
              <Sparkles size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: "1.05rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1 }}>
                Vision-QA Review
              </div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" }}>
                Realism · Craft gate (D5)
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={closeBtnBase} aria-label="Close review">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div style={inspectBodyStyle}>
          {error && (
            <div style={errorPillStyle}>
              <AlertCircle size={15} /> <span style={{ flex: 1 }}>{error}</span>
            </div>
          )}

          {!error && report && (
            <>
              {/* Verdict + score */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "12px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 900, color: verdictColor, lineHeight: 1 }}>
                  {passed ? "✓" : "✗"}
                </div>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 900, textTransform: "uppercase", color: verdictColor, letterSpacing: "0.03em" }}>
                    {passed ? "Passed" : "Needs Fix"}
                  </div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 900 }}>
                    {score.toFixed(1)}
                    <span style={{ fontSize: "0.78rem", color: COLORS.textMuted, fontWeight: 700 }}>
                      /10 · {report.frames_reviewed ?? frames.length} frames
                    </span>
                  </div>
                </div>
              </div>

              {/* Per-frame score bars */}
              {frames.length > 0 && (
                <div style={{ display: "flex", gap: "3px", marginBottom: "12px" }}>
                  {frames.map((f, i) => {
                    const s = f.score ?? 0;
                    return (
                      <div
                        key={i}
                        title={`Frame ${i + 1}: ${s}/10`}
                        style={{ flex: 1, height: "28px", background: "#eee", borderRadius: "2px", position: "relative", overflow: "hidden" }}
                      >
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${(s / 10) * 100}%`, background: barColor(s) }} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Issues */}
              {issues.length > 0 && (
                <>
                  <div style={{ fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", color: COLORS.textMuted, marginBottom: "6px" }}>
                    Issues ({issues.length})
                  </div>
                  <div style={inspectListStyle}>
                    {issues.slice(0, 8).map((iss, i) => (
                      <div key={i} style={{ padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)", fontSize: "0.78rem", color: COLORS.text }}>
                        {iss}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Recommended fixes */}
              {fixes.length > 0 && (
                <>
                  <div style={{ fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", color: COLORS.textMuted, margin: "12px 0 6px" }}>
                    Recommended Fixes
                  </div>
                  <div style={inspectListStyle}>
                    {fixes.map((fx, i) => {
                      const pr = (fx.priority || "").toUpperCase();
                      return (
                        <div key={i} style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                          <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                            {pr && (
                              <span style={{ fontSize: "0.6rem", fontWeight: 900, color: prioColor(pr), border: `1px solid ${prioColor(pr)}`, padding: "1px 5px", borderRadius: "2px", flexShrink: 0 }}>
                                {pr}
                              </span>
                            )}
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: COLORS.text }}>{fx.issue}</span>
                          </div>
                          {fx.fix && (
                            <div style={{ fontSize: "0.74rem", color: COLORS.textMuted, marginTop: "3px", marginLeft: pr ? "32px" : 0 }}>
                              {fx.fix}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer: human-approve (D5 step 4) + close */}
        {!error && report && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }}>
            {approval?.current && approval.status === "approved" && (
              <span style={{ fontSize: "0.7rem", fontWeight: 900, color: "#1d8a3a", textTransform: "uppercase" }}>✓ Approved</span>
            )}
            <button
              type="button"
              onClick={() => onApprove("approved")}
              disabled={isApproving}
              style={{ ...inspectCloseBtnStyle, background: "#1d8a3a", color: "#fff", opacity: isApproving ? 0.6 : 1, cursor: isApproving ? "not-allowed" : "pointer" }}
            >
              <Check size={16} /> Approve
            </button>
            <button
              type="button"
              onClick={() => onApprove("rejected")}
              disabled={isApproving}
              style={{ ...inspectCloseBtnStyle, background: "#b00020", color: "#fff", opacity: isApproving ? 0.6 : 1, cursor: isApproving ? "not-allowed" : "pointer" }}
            >
              <X size={16} /> Reject
            </button>
            {approval?.current && approval.status === "rejected" && (
              <span style={{ fontSize: "0.7rem", fontWeight: 900, color: "#b00020", textTransform: "uppercase" }}>✗ Rejected</span>
            )}
          </div>
        )}
        <div style={footerStyle}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase" }}>
            Powered by GLM-4.6V
          </div>
          <button type="button" onClick={onClose} style={inspectCloseBtnStyle}>
            <X size={16} /> Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Sub-component: GatePanel — live status of the Run Gate sequence (D5)
 * ════════════════════════════════════════════════════════════════════════════ */
function GatePanel({ gate, onDismiss }: { gate: Gate; onDismiss: () => void }) {
  if (gate.phase === "idle") return null;
  const s = gate.steps;
  const icon = (st: GateStepStatus | "pending" | "approved" | "rejected") =>
    st === "pass" ? "✓" : st === "fail" ? "✗" : st === "running" ? "⟳" : st === "approved" ? "✓" : st === "rejected" ? "✗" : "○";
  const color = (st: GateStepStatus | "pending" | "approved" | "rejected") =>
    st === "pass" || st === "approved" ? "#1d8a3a" : st === "fail" || st === "rejected" ? "#b00020" : st === "running" ? "#1d3a8a" : "#888";
  const label =
    gate.phase === "failed"
      ? `Gate failed: ${gate.error ?? "error"}`
      : gate.phase === "awaiting"
        ? "Awaiting your approval — see the review"
        : gate.phase === "rendering"
          ? `Rendering… ${gate.progress ?? 0}%`
          : gate.phase === "reviewing"
            ? "Reviewing rendered frames…"
            : "Checking composition…";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "6px 12px",
        background: gate.phase === "failed" ? "#ffe2e2" : gate.phase === "awaiting" ? "#e6f4ea" : "#e2e8ff",
        color: gate.phase === "failed" ? "#b00020" : gate.phase === "awaiting" ? "#1d8a3a" : "#1d3a8a",
        borderRadius: "6px",
        fontSize: "0.72rem",
        fontWeight: 800,
        flexWrap: "wrap",
      }}
    >
      <StepIcon c={color(s.check)} ch={icon(s.check)} label="Check" />
      <StepIcon c={color(s.render)} ch={icon(s.render)} label="Render" />
      <StepIcon c={color(s.review)} ch={icon(s.review)} label="Review" />
      <StepIcon c={color(s.approve)} ch={icon(s.approve)} label="Approve" />
      <span style={{ flex: 1, minWidth: "120px", textTransform: "none", fontWeight: 700 }}>{label}</span>
      {(gate.phase === "failed" || gate.phase === "awaiting") && (
        <button type="button" onClick={onDismiss} style={{ ...dismissBtnStyle, fontWeight: 800 }}>
          Dismiss
        </button>
      )}
    </div>
  );
}

function StepIcon({ c, ch, label }: { c: string; ch: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
      <span style={{ color: c, fontSize: "0.9rem", fontWeight: 900 }}>{ch}</span>
      <span style={{ opacity: 0.85 }}>{label}</span>
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Sub-component: ApprovalBadge — current render's human sign-off (D5 step 4)
 * ════════════════════════════════════════════════════════════════════════════ */
function ApprovalBadge({ approval }: { approval: ApprovalState }) {
  const s = approval.status;
  const st =
    s === "approved"
      ? successPillStyle
      : s === "rejected"
        ? errorPillStyle
        : {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            background: "#e2e8ff",
            color: "#1d3a8a",
            borderRadius: "6px",
            fontSize: "0.7rem",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          };
  return (
    <div style={st}>
      {s === "approved" ? <Check size={15} /> : s === "rejected" ? <X size={15} /> : <Clock size={15} />}
      <span style={{ flex: 1 }}>
        {s === "approved"
          ? `Approved${approval.score != null ? ` · ${approval.score}/10` : ""}`
          : s === "rejected"
            ? "Rejected"
            : "Pending approval"}
      </span>
    </div>
  );
}

function CountPill({ label, value, tone }: { label: string; value: number; tone: "error" | "warn" | "info" }) {
  const bg =
    tone === "error" ? "#ffe2e2" : tone === "warn" ? "#fff3cd" : "#e2e8ff";
  const fg = tone === "error" ? "#b00020" : tone === "warn" ? "#8a6d00" : "#1d3a8a";
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "6px 12px", border: `2px solid ${COLORS.border}`, boxShadow: "2px 2px 0 #0a0a0a",
      backgroundColor: bg, color: fg, minWidth: "64px",
    }}>
      <span style={{ fontSize: "1.1rem", fontWeight: 900, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "2px" }}>{label}</span>
    </div>
  );
}

function InspectIssueRow({ issue }: { issue: InspectIssue }) {
  const severity = (issue.severity || "warning").toLowerCase();
  const tone: "error" | "warn" | "info" =
    severity.includes("error") ? "error" : severity.includes("info") ? "info" : "warn";
  const bg =
    tone === "error" ? "#ffe2e2" : tone === "warn" ? "#fff3cd" : "#e2e8ff";
  const fg = tone === "error" ? "#b00020" : tone === "warn" ? "#8a6d00" : "#1d3a8a";

  return (
    <div style={{
      display: "flex", gap: "10px", alignItems: "flex-start",
      padding: "10px 12px", border: BORDER_SM, backgroundColor: COLORS.surface,
      boxShadow: "2px 2px 0 #0a0a0a",
    }}>
      <span style={{
        flexShrink: 0, fontSize: "0.6rem", fontWeight: 900, textTransform: "uppercase",
        letterSpacing: "0.03em", padding: "2px 7px", border: `2px solid ${COLORS.border}`,
        backgroundColor: bg, color: fg, alignSelf: "flex-start", marginTop: "1px",
      }}>
        {severity}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 800, color: COLORS.text, wordBreak: "break-word" }}>
          {String((issue.message ?? issue.summary ?? "Layout issue") as string)}
        </div>
        {(issue.category != null || issue.selector != null || issue.sample != null) && (
          <div style={{ fontSize: "0.68rem", fontWeight: 600, color: COLORS.textMuted, marginTop: "3px", fontFamily: "monospace", wordBreak: "break-all" }}>
            {String(issue.category != null ? `[${issue.category}] ` : "")}
            {String(issue.selector != null ? `${issue.selector} ` : "")}
            {issue.sample != null ? `@ ${issue.sample}s` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Sub-component: BeatsTab — timeline beat list + per-beat editor
 * ════════════════════════════════════════════════════════════════════════════ */

function BeatsTab({
  manifest,
  selectedBeat,
  onSelectBeat,
  onUpdateBeat,
  onDeleteBeat,
  onMoveBeat,
  onAddBeat,
}: {
  manifest: TimelineManifest;
  selectedBeat: number | null;
  onSelectBeat: (i: number | null) => void;
  onUpdateBeat: (i: number, patch: Partial<TimelineBeat>) => void;
  onDeleteBeat: (i: number) => void;
  onMoveBeat: (i: number, dir: -1 | 1) => void;
  onAddBeat: () => void;
}) {
  const beat = selectedBeat !== null ? manifest.beats[selectedBeat] : null;

  return (
    <div style={{ display: "flex", gap: "16px", minHeight: "320px", flexWrap: "wrap" }}>
      {/* ── Beat list (left) ── */}
      <div style={{ flex: "0 0 200px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.textMuted, marginBottom: "4px" }}>
          Beats ({manifest.beats.length})
        </div>
        {manifest.beats.map((b, i) => {
          const isSel = selectedBeat === i;
          const icon = LAYOUT_OPTIONS.find((l) => l.value === b.layout)?.icon || "🎬";
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelectBeat(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                border: BORDER_SM,
                boxShadow: isSel ? SHADOW_SM : "none",
                backgroundColor: isSel ? COLORS.accent : COLORS.surface,
                color: isSel ? "#fff" : COLORS.text,
                fontWeight: 800,
                fontSize: "0.75rem",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                transform: isSel ? "translate(-1px,-1px)" : "none",
                transition: "all 80ms ease",
              }}
            >
              <span style={{ fontSize: "1rem" }}>{icon}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {i + 1}. {b.headline.slice(0, 18)}
              </span>
              <span style={{ fontSize: "0.6rem", opacity: 0.7, fontWeight: 700 }}>{b.duration}s</span>
            </button>
          );
        })}
        <button type="button" onClick={onAddBeat} style={addBeatBtnStyle}>
          <Plus size={15} /> Add Beat
        </button>
      </div>

      {/* ── Beat editor (right) ── */}
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        {!beat && (
          <div style={emptyEditorStyle}>
            <Zap size={32} style={{ opacity: 0.3 }} />
            <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "0.85rem", marginTop: "8px" }}>
              Select a beat to edit
            </div>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, color: COLORS.textMuted, marginTop: "4px" }}>
              Click any beat from the timeline or the list.
            </div>
          </div>
        )}
        {beat && selectedBeat !== null && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Beat header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "0.9rem", letterSpacing: "0.03em" }}>
                Beat {selectedBeat + 1}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => onMoveBeat(selectedBeat, -1)}
                  disabled={selectedBeat === 0}
                  style={{
                    ...iconBtnStyle,
                    opacity: selectedBeat === 0 ? 0.3 : 1,
                    cursor: selectedBeat === 0 ? "not-allowed" : "pointer",
                  }}
                  title="Move left"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveBeat(selectedBeat, 1)}
                  disabled={selectedBeat === manifest.beats.length - 1}
                  style={{
                    ...iconBtnStyle,
                    opacity: selectedBeat === manifest.beats.length - 1 ? 0.3 : 1,
                    cursor: selectedBeat === manifest.beats.length - 1 ? "not-allowed" : "pointer",
                  }}
                  title="Move right"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteBeat(selectedBeat)}
                  style={{ ...iconBtnStyle, backgroundColor: COLORS.danger, color: "#fff" }}
                  title="Delete beat"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Headline */}
            <Field label="Headline" icon={<Type size={12} />}>
              <input
                type="text"
                value={beat.headline}
                onChange={(e) => onUpdateBeat(selectedBeat, { headline: e.target.value })}
                style={inputStyle}
                placeholder="Enter headline text…"
              />
            </Field>

            {/* Subtext / narration */}
            <Field label="Subtext / Narration" icon={<Type size={12} />}>
              <textarea
                value={beat.subtext}
                onChange={(e) => onUpdateBeat(selectedBeat, { subtext: e.target.value })}
                style={{ ...inputStyle, minHeight: "70px", resize: "vertical", lineHeight: 1.4 }}
                placeholder="Supporting text or narration for this beat…"
              />
            </Field>

            {/* Duration slider */}
            <Field label={`Duration — ${beat.duration}s`} icon={<Clock size={12} />}>
              <input
                type="range"
                min={2}
                max={10}
                step={1}
                value={beat.duration}
                onChange={(e) => onUpdateBeat(selectedBeat, { duration: Number(e.target.value) })}
                style={{ width: "100%", accentColor: COLORS.accent, cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", fontWeight: 700, color: COLORS.textMuted, marginTop: "2px" }}>
                <span>2s</span><span>10s</span>
              </div>
            </Field>

            {/* Layout + Caption style */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Field label="Layout" icon={<Move size={12} />} style={{ flex: "1 1 180px" }}>
                <select
                  value={beat.layout}
                  onChange={(e) => onUpdateBeat(selectedBeat, { layout: e.target.value as BeatLayout })}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  {LAYOUT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Caption Style" icon={<Zap size={12} />} style={{ flex: "1 1 180px" }}>
                <select
                  value={beat.caption_style}
                  onChange={(e) => onUpdateBeat(selectedBeat, { caption_style: e.target.value as CaptionStyle })}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  {CAPTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Transition */}
            <Field label="Transition" icon={<RefreshCw size={12} />}>
              <select
                value={beat.transition}
                onChange={(e) => onUpdateBeat(selectedBeat, { transition: e.target.value as BeatTransition })}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {TRANSITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>

            {/* Scene tracks — native template model (read-only this brick) */}
            {beat.tracks && beat.tracks.length > 0 && (
              <div>
                <div style={{ ...fieldLabelStyle, marginBottom: "6px" }}>Scene Tracks</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {beat.tracks.map((tr) => (
                    <div key={tr.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", border: BORDER_SM, backgroundColor: COLORS.surface }}>
                      <span style={{ fontSize: "0.95rem" }}>{TRACK_ICON[tr.type] ?? "•"}</span>
                      <span style={{ fontSize: "0.58rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em", padding: "1px 6px", border: `2px solid ${COLORS.border}`, backgroundColor: COLORS.bg }}>{tr.type}</span>
                      <span style={{ flex: 1, fontFamily: "monospace", fontSize: "0.7rem", color: COLORS.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tr.ref || tr.id}</span>
                      {typeof tr.duration === "number" ? (
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: COLORS.textMuted }}>{tr.duration}s</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Sub-component: StyleTab
 * ════════════════════════════════════════════════════════════════════════════ */

function StyleTab({
  manifest,
  onChange,
}: {
  manifest: TimelineManifest;
  onChange: (patch: Partial<TimelineManifest>) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", minHeight: "320px" }}>
      {/* Style preset */}
      <div>
        <div style={fieldLabelStyle}>Style Preset</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px", marginTop: "10px" }}>
          {STYLE_PRESETS.map((p) => {
            const sel = manifest.style_preset === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange({ style_preset: p.value })}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  padding: "10px",
                  border: BORDER_SM,
                  boxShadow: sel ? SHADOW_SM : "none",
                  backgroundColor: COLORS.surface,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "center",
                  transform: sel ? "translate(-1px,-1px)" : "none",
                  transition: "all 80ms ease",
                }}
              >
                <div style={{ height: "36px", border: BORDER_SM, backgroundColor: p.swatch, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {sel && <Check size={18} color={isLightColor(p.swatch) ? COLORS.text : "#fff"} />}
                </div>
                <span style={{ fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.03em", color: sel ? COLORS.accent : COLORS.text }}>
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color pickers */}
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px" }}>
          <div style={fieldLabelStyle}>Primary Color</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
            <input
              type="color"
              value={manifest.primary_color}
              onChange={(e) => onChange({ primary_color: e.target.value })}
              style={colorInputStyle}
            />
            <input
              type="text"
              value={manifest.primary_color}
              onChange={(e) => onChange({ primary_color: e.target.value })}
              spellCheck={false}
              style={{ ...inputStyle, width: "110px", fontFamily: "monospace", textTransform: "uppercase" }}
            />
          </div>
          <div style={{ marginTop: "8px", height: "8px", backgroundColor: manifest.primary_color, border: BORDER_SM }} />
        </div>

        <div style={{ flex: "1 1 200px" }}>
          <div style={fieldLabelStyle}>Background Color</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
            <input
              type="color"
              value={manifest.background_color}
              onChange={(e) => onChange({ background_color: e.target.value })}
              style={colorInputStyle}
            />
            <input
              type="text"
              value={manifest.background_color}
              onChange={(e) => onChange({ background_color: e.target.value })}
              spellCheck={false}
              style={{ ...inputStyle, width: "110px", fontFamily: "monospace", textTransform: "uppercase" }}
            />
          </div>
          <div style={{ marginTop: "8px", height: "8px", backgroundColor: manifest.background_color, border: BORDER_SM }} />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Sub-component: AudioTab
 * ════════════════════════════════════════════════════════════════════════════ */

function AudioTab({
  manifest,
  onChange,
}: {
  manifest: TimelineManifest;
  onChange: (patch: Partial<TimelineManifest>) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", minHeight: "320px" }}>
      {/* Narration voice */}
      <Field label="Narration Voice" icon={<Type size={12} />}>
        <select
          value={manifest.narration_voice}
          onChange={(e) => onChange({ narration_voice: e.target.value as NarrationVoice })}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          {VOICE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>

      {/* Music track */}
      <Field label="Music Track" icon={<Music size={12} />}>
        <select
          value={manifest.music_track}
          onChange={(e) => onChange({ music_track: e.target.value as MusicTrack })}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          {MUSIC_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>

      {/* SFX toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          type="button"
          onClick={() => onChange({ sfx_enabled: !manifest.sfx_enabled })}
          style={{
            ...toggleBase,
            backgroundColor: manifest.sfx_enabled ? COLORS.success : COLORS.surface,
            color: manifest.sfx_enabled ? "#fff" : COLORS.text,
          }}
        >
          {manifest.sfx_enabled ? <Check size={16} /> : <X size={16} />}
          <span style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "0.8rem" }}>
            Sound Effects {manifest.sfx_enabled ? "ON" : "OFF"}
          </span>
        </button>
        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: COLORS.textMuted }}>
          Adds whooshes, impacts, and UI sounds between beats.
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Sub-component: SlotsTab — edit the template's per-client slot values (D3/D4).
 * Slot edits are deterministic and live in component state this brick; the edit
 * route that persists them lands in brick 5.
 * ════════════════════════════════════════════════════════════════════════════ */

function SlotsTab({
  slots,
  values,
  onChange,
  onSave,
  saveState,
}: {
  slots: Slot[];
  values: Record<string, string | number>;
  onChange: (id: string, value: string | number) => void;
  onSave: () => void;
  saveState: { status: "idle" | "saving" | "saved" | "error"; msg?: string };
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", minHeight: "320px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: COLORS.textMuted }}>
          {slots.length} template slots · edits save to the template values overlay.
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {saveState.status === "saved" && (
            <span style={successPillStyle}><Check size={14} /> {saveState.msg}</span>
          )}
          {saveState.status === "error" && (
            <span style={errorPillStyle}><AlertCircle size={14} /> {saveState.msg}</span>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saveState.status === "saving"}
            style={{
              ...renderBtnStyle,
              padding: "10px 20px",
              opacity: saveState.status === "saving" ? 0.7 : 1,
              cursor: saveState.status === "saving" ? "not-allowed" : "pointer",
            }}
          >
            {saveState.status === "saving" ? (
              <>
                <Loader2 size={16} className="tl-spin" style={{ animation: "tl-spin 0.8s linear infinite" }} /> Saving…
              </>
            ) : (
              "Save slots"
            )}
          </button>
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
        {slots.map((slot) => {
          const val = values[slot.id] ?? slot.default ?? "";
          return (
            <Field key={slot.id} label={slot.label}>
              {slot.type === "color" ? (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="color"
                    value={normalizeHex(String(val))}
                    onChange={(e) => onChange(slot.id, e.target.value)}
                    style={colorInputStyle}
                  />
                  <input
                    type="text"
                    value={String(val)}
                    onChange={(e) => onChange(slot.id, e.target.value)}
                    spellCheck={false}
                    style={{ ...inputStyle, width: "110px", fontFamily: "monospace", textTransform: "uppercase" }}
                  />
                </div>
              ) : slot.type === "number" ? (
                <input
                  type="number"
                  value={val === "" ? "" : Number(val)}
                  onChange={(e) => onChange(slot.id, e.target.value === "" ? "" : Number(e.target.value))}
                  style={inputStyle}
                />
              ) : slot.type === "select" && slot.options ? (
                <select
                  value={String(val)}
                  onChange={(e) => onChange(slot.id, e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  {slot.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={String(val)}
                  onChange={(e) => onChange(slot.id, e.target.value)}
                  style={inputStyle}
                />
              )}
            </Field>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Shared field wrapper
 * ════════════════════════════════════════════════════════════════════════════ */

function Field({
  label,
  icon,
  children,
  style,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "5px", ...style }}>
      <span style={fieldLabelStyle}>
        {icon && <span style={{ display: "inline-flex", verticalAlign: "-2px", marginRight: "4px" }}>{icon}</span>}
        {label}
      </span>
      {children}
    </label>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Helpers
 * ════════════════════════════════════════════════════════════════════════════ */

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

/* ════════════════════════════════════════════════════════════════════════════
 * Inline style objects
 * ════════════════════════════════════════════════════════════════════════════ */

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 99999,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  backgroundColor: "rgba(10, 10, 10, 0.55)",
  backdropFilter: "blur(2px)",
  padding: "0",
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
};

const modalContainerStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: "1100px",
  maxHeight: "100vh",
  backgroundColor: COLORS.bg,
  border: "none",
  borderLeft: BORDER,
  borderRight: BORDER,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 20px",
  backgroundColor: COLORS.surface,
  borderBottom: BORDER,
  boxShadow: SHADOW_SM,
  zIndex: 3,
  position: "relative",
};

const logoBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "38px",
  height: "38px",
  backgroundColor: COLORS.accent,
  color: "#fff",
  border: BORDER_SM,
  boxShadow: SHADOW_SM,
};

const closeBtnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "38px",
  height: "38px",
  border: BORDER_SM,
  boxShadow: SHADOW_SM,
  backgroundColor: COLORS.bg,
  color: COLORS.text,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 80ms ease",
};

const warningBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  backgroundColor: "#fff3cd",
  borderBottom: BORDER_SM,
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "#856404",
};

const loadingContainerStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: COLORS.text,
};

const panelStyle: React.CSSProperties = {
  backgroundColor: COLORS.surface,
  borderBottom: BORDER,
  padding: "14px 20px",
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "10px",
};

const timelineTrackStyle: React.CSSProperties = {
  display: "flex",
  gap: "4px",
  height: "64px",
  alignItems: "stretch",
};

const timelineBlockStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "2px",
  minWidth: "60px",
  padding: "6px 4px",
  border: BORDER_SM,
  cursor: "pointer",
  fontFamily: "inherit",
  overflow: "hidden",
  transition: "all 100ms ease",
  borderRadius: 0,
};

const addBeatBlockStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "48px",
  flexShrink: 0,
  border: `${BORDER_SM}`,
  borderStyle: "dashed",
  backgroundColor: "transparent",
  color: COLORS.textMuted,
  cursor: "pointer",
  transition: "all 100ms ease",
};

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  padding: "14px 20px 0",
};

const tabContentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px 20px",
  backgroundColor: COLORS.bg,
};

const footerStyle: React.CSSProperties = {
  padding: "12px 20px",
  backgroundColor: COLORS.surface,
  borderTop: BORDER,
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  boxShadow: `0 -3px 0 ${COLORS.border}`,
  zIndex: 2,
};

const renderBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 28px",
  border: BORDER,
  boxShadow: SHADOW,
  fontSize: "0.9rem",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  cursor: "pointer",
  fontFamily: "inherit",
  backgroundColor: COLORS.accent,
  color: "#fff",
  transition: "all 80ms ease",
};

const inspectBtnStyle: React.CSSProperties = {
  ...renderBtnStyle,
  padding: "12px 22px",
  backgroundColor: COLORS.text,
  color: COLORS.bg,
};

const errorPillStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 12px",
  border: BORDER_SM,
  boxShadow: SHADOW_SM,
  backgroundColor: "#ffe2e2",
  color: "#b00020",
  fontSize: "0.75rem",
  fontWeight: 800,
};

const successPillStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 12px",
  border: BORDER_SM,
  boxShadow: SHADOW_SM,
  backgroundColor: COLORS.accent2,
  color: COLORS.text,
  fontSize: "0.75rem",
  fontWeight: 800,
};

const dismissBtnStyle: React.CSSProperties = {
  border: `2px solid ${COLORS.border}`,
  backgroundColor: "#fff",
  padding: "2px 8px",
  fontWeight: 900,
  cursor: "pointer",
  textTransform: "uppercase",
  fontSize: "0.65rem",
  fontFamily: "inherit",
};

const rerenderOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(10, 10, 10, 0.8)",
};

const rerenderCardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "40px 48px",
  border: BORDER,
  boxShadow: SHADOW_LG,
  backgroundColor: COLORS.accent,
  color: "#fff",
  textAlign: "center",
};

/* ── InspectModal styles ── */
const inspectOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(10, 10, 10, 0.85)",
  padding: "24px",
};

const inspectModalStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "min(640px, 100%)",
  maxHeight: "85%",
  border: BORDER,
  boxShadow: SHADOW_LG,
  backgroundColor: COLORS.bg,
  overflow: "hidden",
};

const inspectHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  padding: "14px 18px",
  backgroundColor: COLORS.surface,
  borderBottom: BORDER,
};

const inspectBodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const inspectCleanStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "40px 20px",
  color: COLORS.success,
};

const inspectSummaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const inspectListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const inspectCloseBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 18px",
  border: BORDER_SM,
  boxShadow: SHADOW_SM,
  backgroundColor: COLORS.accent,
  color: "#fff",
  fontSize: "0.8rem",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 80ms ease",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: BORDER_SM,
  backgroundColor: COLORS.bg,
  fontSize: "0.85rem",
  fontWeight: 600,
  color: COLORS.text,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const colorInputStyle: React.CSSProperties = {
  width: "50px",
  height: "40px",
  padding: 0,
  border: BORDER_SM,
  background: "none",
  cursor: "pointer",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "0.68rem",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: COLORS.textMuted,
};

const iconBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  border: BORDER_SM,
  boxShadow: "none",
  backgroundColor: COLORS.surface,
  color: COLORS.text,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 80ms ease",
};

const addBeatBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "8px 12px",
  border: `${BORDER_SM}`,
  borderStyle: "dashed",
  backgroundColor: "transparent",
  color: COLORS.textMuted,
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 800,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  transition: "all 80ms ease",
};

const emptyEditorStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "48px 20px",
  border: `${BORDER_SM}`,
  borderStyle: "dashed",
  color: COLORS.textMuted,
  minHeight: "280px",
};

const toggleBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 20px",
  border: BORDER_SM,
  boxShadow: SHADOW_SM,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 80ms ease",
};

/* ════════════════════════════════════════════════════════════════════════════
 * Global CSS (injected via <style> — only keyframes + scrollbar + range thumb)
 * ════════════════════════════════════════════════════════════════════════════ */

const cssGlobal = `
@keyframes tl-spin { to { transform: rotate(360deg); } }

/* Custom scrollbar for the editor panels */
.tl-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
.tl-scroll::-webkit-scrollbar-track { background: ${COLORS.bg}; }
.tl-scroll::-webkit-scrollbar-thumb { background: ${COLORS.border}; border: 2px solid ${COLORS.bg}; }

/* Range input — neo-brutalist thumb */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  height: 28px;
  background: transparent;
}
input[type="range"]::-webkit-slider-runnable-track {
  height: 8px;
  background: ${COLORS.bg};
  border: ${BORDER_SM};
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 28px;
  margin-top: -8px;
  background: ${COLORS.accent};
  border: ${BORDER_SM};
  cursor: pointer;
}
input[type="range"]::-moz-range-track {
  height: 8px;
  background: ${COLORS.bg};
  border: ${BORDER_SM};
}
input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 28px;
  background: ${COLORS.accent};
  border: ${BORDER_SM};
  cursor: pointer;
  border-radius: 0;
}

/* Select dropdown base */
select {
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%230a0a0a' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 32px !important;
}
`;
