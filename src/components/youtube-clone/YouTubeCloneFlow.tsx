"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { StoryModeDefinition } from "@/lib/story-modes";
import {
  buildRenderPlan,
  renderSceneFrame,
  type RenderPlan,
  type StoryboardResponse,
} from "@/lib/youtube-clone-renderer";
import {
  ArrowLeft,
  Loader2,
  Download,
  AlertCircle,
  Play,
  RefreshCw,
} from "lucide-react";

// ─── Props ───────────────────────────────────────────────

interface YouTubeCloneFlowProps {
  mode: StoryModeDefinition;
  onBack: () => void;
}

// ─── Types ───────────────────────────────────────────────

type Step = "input" | "processing" | "preview";

interface JobStatus {
  status: string;
  stage_hint: string | null;
  recent_logs: string[];
  error?: string;
}

// ─── Styles (neo-brutalist, matching the app) ────────────

const BG = "#0a0a0a";
const CARD = "#1a1a1a";
const ACCENT = "#ff2d2d";
const TEXT = "#f5f5f5";
const MUTED = "#888";
const BORDER = "#333";

const containerStyle: CSSProperties = {
  width: "100%",
  maxWidth: 960,
  margin: "0 auto",
};

const cardStyle: CSSProperties = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: 32,
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#0f0f0f",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: "12px 16px",
  fontSize: 16,
  color: TEXT,
  outline: "none",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  color: MUTED,
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const buttonPrimary: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: ACCENT,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "14px 32px",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  transition: "opacity 0.2s",
};

const buttonSecondary: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "transparent",
  color: MUTED,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

// ─── Component ───────────────────────────────────────────

export default function YouTubeCloneFlow({
  mode,
  onBack,
}: YouTubeCloneFlowProps) {
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [style, setStyle] = useState("default");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [storyboard, setStoryboard] = useState<StoryboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Submit handler ──────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!url.trim()) return;
    setError(null);
    setStep("processing");

    try {
      const resp = await fetch("/api/youtube/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), style }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(
          body.message || `Failed to start extraction (${resp.status})`,
        );
      }

      const data = await resp.json();
      setJobId(data.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("input");
    }
  }, [url, style]);

  // ── Poll for status ─────────────────────────────────
  useEffect(() => {
    if (!jobId || step !== "processing") return;

    const poll = async () => {
      try {
        const resp = await fetch(`/api/youtube/status/${jobId}`);
        if (!resp.ok) return;
        const data: JobStatus = await resp.json();
        setStatus(data);

        if (data.status === "complete") {
          // Fetch the storyboard
          const sbResp = await fetch(
            `/api/youtube/extract/${jobId}/storyboard`,
          );
          if (sbResp.ok) {
            const sbData: StoryboardResponse = await sbResp.json();
            setStoryboard(sbData);
            setStep("preview");
          }
        } else if (data.status === "error") {
          setError(data.error || "Extraction failed");
          setStep("input");
        }
      } catch {
        // Network blip — keep polling
      }
    };

    poll(); // immediate first poll
    pollRef.current = setInterval(poll, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, step]);

  // ── Input Step ──────────────────────────────────────
  if (step === "input") {
    return (
      <div style={containerStyle}>
        <div style={{ marginBottom: 24 }}>
          <button onClick={onBack} style={buttonSecondary}>
            <ArrowLeft size={16} /> Back to modes
          </button>
        </div>

        <div style={cardStyle}>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: TEXT,
              marginBottom: 8,
            }}
          >
            {mode.emoji} {mode.name}
          </h2>
          <p style={{ color: MUTED, marginBottom: 32 }}>{mode.description}</p>

          {error && (
            <div
              style={{
                background: "rgba(255,45,45,0.1)",
                border: `1px solid ${ACCENT}`,
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 24,
                color: ACCENT,
                fontSize: 14,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>YouTube URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              style={inputStyle}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={labelStyle}>Visual Style</label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { v: "default", label: "Default" },
                { v: "cyberpunk-neon", label: "Cyberpunk Neon" },
                { v: "corporate-clean", label: "Corporate Clean" },
                { v: "documentary-warm", label: "Documentary Warm" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setStyle(opt.v)}
                  style={{
                    ...buttonSecondary,
                    ...(style === opt.v
                      ? {
                          borderColor: ACCENT,
                          color: TEXT,
                          background: "rgba(255,45,45,0.1)",
                        }
                      : {}),
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!url.trim()}
            style={{
              ...buttonPrimary,
              opacity: url.trim() ? 1 : 0.5,
            }}
          >
            <Play size={18} /> Clone Video
          </button>
        </div>
      </div>
    );
  }

  // ── Processing Step ─────────────────────────────────
  if (step === "processing") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <Loader2
              size={32}
              style={{ animation: "spin 1s linear infinite", color: ACCENT }}
            />
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT }}>
                Extracting story...
              </h2>
              <p style={{ color: MUTED, fontSize: 14 }}>
                {status?.stage_hint || "Starting pipeline..."}
              </p>
            </div>
          </div>

          {/* Progress bar (indeterminate) */}
          <div
            style={{
              height: 4,
              background: BORDER,
              borderRadius: 2,
              marginBottom: 24,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: ACCENT,
                borderRadius: 2,
                transition: "width 0.5s",
                width: status?.status === "processing" ? "60%" : "20%",
              }}
            />
          </div>

          {/* Live log feed */}
          {status?.recent_logs && status.recent_logs.length > 0 && (
            <div
              style={{
                background: "#0a0a0a",
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: 16,
                maxHeight: 300,
                overflow: "auto",
                fontFamily: "monospace",
                fontSize: 12,
                color: MUTED,
              }}
            >
              {status.recent_logs.slice(-15).map((line, i) => (
                <div key={i} style={{ marginBottom: 2 }}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Preview Step ────────────────────────────────────
  if (step === "preview" && storyboard) {
    return (
      <PreviewScreen
        storyboard={storyboard}
        originalUrl={url}
        onBack={onBack}
        onRestart={() => {
          setStep("input");
          setUrl("");
          setJobId(null);
          setStatus(null);
          setStoryboard(null);
        }}
      />
    );
  }

  return null;
}

// ─── Preview Screen with Side-by-Side Comparison ─────────

function PreviewScreen({
  storyboard,
  originalUrl,
  onBack,
  onRestart,
}: {
  storyboard: StoryboardResponse;
  originalUrl: string;
  onBack: () => void;
  onRestart: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentScene, setCurrentScene] = useState(0);
  const plan = buildRenderPlan(storyboard);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Extract video ID for the YouTube embed
  const videoId = (() => {
    const match = originalUrl.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/,
    );
    return match?.[1] || "";
  })();

  // Load all scene images
  useEffect(() => {
    Promise.all(
      plan.scenes.map(
        (scene) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = scene.imageUrl;
          }),
      ),
    )
      .then((imgs) => {
        imagesRef.current = imgs;
      })
      .catch(() => {});
  }, [plan]);

  // Render loop
  useEffect(() => {
    if (!playing || imagesRef.current.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    startTimeRef.current = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTimeRef.current) / 1000;

      // Find current scene
      let acc = 0;
      let sceneIdx = 0;
      let sceneTime = 0;
      for (let i = 0; i < plan.scenes.length; i++) {
        if (elapsed < acc + plan.scenes[i].durationSeconds) {
          sceneIdx = i;
          sceneTime = elapsed - acc;
          break;
        }
        acc += plan.scenes[i].durationSeconds;
        sceneIdx = i;
        sceneTime = plan.scenes[i].durationSeconds;
      }

      setCurrentScene(sceneIdx + 1);

      const img = imagesRef.current[sceneIdx];
      if (img) {
        renderSceneFrame(
          ctx,
          img,
          sceneTime,
          plan.scenes[sceneIdx],
          W,
          H,
        );
      }

      if (elapsed < plan.totalDuration) {
        animFrameRef.current = requestAnimationFrame(render);
      } else {
        setPlaying(false);
      }
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [playing, plan]);

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <button onClick={onBack} style={buttonSecondary}>
          <ArrowLeft size={16} /> Back to modes
        </button>
        <button onClick={onRestart} style={buttonSecondary}>
          <RefreshCw size={16} /> Clone another
        </button>
      </div>

      {/* Side-by-side comparison */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Original */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: MUTED,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Original
          </h3>
          {videoId ? (
            <div
              style={{
                position: "relative",
                paddingBottom: "56.25%",
                borderRadius: 8,
                overflow: "hidden",
                border: `1px solid ${BORDER}`,
              }}
            >
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div
              style={{
                ...cardStyle,
                aspectRatio: "16/9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: MUTED,
              }}
            >
              No video ID
            </div>
          )}
        </div>

        {/* AI Recreation */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: MUTED,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            AI Recreation {currentScene > 0 && `· Scene ${currentScene}/${plan.sceneCount}`}
          </h3>
          <div
            style={{
              position: "relative",
              borderRadius: 8,
              overflow: "hidden",
              border: `1px solid ${BORDER}`,
              background: "#000",
            }}
          >
            <canvas
              ref={canvasRef}
              width={640}
              height={360}
              style={{
                width: "100%",
                display: "block",
                aspectRatio: "16/9",
              }}
            />
            {!playing && (
              <button
                onClick={() => setPlaying(true)}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  border: "none",
                  background: ACCENT,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Play size={28} fill="currentColor" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scene thumbnails */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {plan.scenes.map((scene) => (
            <div
              key={scene.sceneNumber}
              style={{
                flex: "0 0 auto",
                width: 80,
                textAlign: "center",
              }}
            >
              <img
                src={scene.imageUrl}
                alt={`Scene ${scene.sceneNumber}`}
                style={{
                  width: 80,
                  height: 45,
                  objectFit: "cover",
                  borderRadius: 4,
                  border: `1px solid ${BORDER}`,
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  color: MUTED,
                  marginTop: 4,
                }}
              >
                {scene.durationSeconds}s
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
