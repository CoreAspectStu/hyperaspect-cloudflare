"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { extractYouTubeId, youtubeEmbedUrl } from "@/lib/youtube";

/**
 * /admin/youtube-pipeline — youtube-ai-video integration (PRD §3.1, ADR-006).
 *
 * Drives the core-control FastAPI microservice through the Next.js proxy at
 * /api/youtube/*. Styled to match HyperFrames' existing neo-brutalist admin
 * (hard 6px shadows, 4px ink borders, cream/ink/sun palette, uppercase weight-900).
 */

// --- Auth (shared HyperFrames admin gate; see /api/auth, ADR-005) -------------
const SESSION_KEY = "hyperaspect_admin_auth";

const API = (p: string) => "/api/youtube/" + p.replace(/^\//, "");

const STYLES = [
  { id: "default", label: "Default", swatch: ["#0a0a0a", "#fef6e4"] },
  { id: "cyberpunk-neon", label: "Cyberpunk Neon", swatch: ["#ff00d4", "#00e5ff"] },
  { id: "corporate-clean", label: "Corporate Clean", swatch: ["#0a0a0a", "#ffffff"] },
  { id: "documentary-warm", label: "Documentary Warm", swatch: ["#c2410c", "#fde68a"] },
] as const;

const MODES = [
  { id: "recompose", label: "Recompose", desc: "Image → video" },
  { id: "v2v", label: "V2V", desc: "Video → video" },
  { id: "hybrid", label: "Hybrid", desc: "Mixed" },
] as const;

type Video = {
  job_id: string;
  youtube_url: string;
  video_id: string | null;
  style: string;
  mode: string;
  status: string;
  final_video_url: string | null;
  thumbnail_url: string | null;
  total_cost_usd: number | null;
  error: string | null;
  created_at: string | null;
  completed_at: string | null;
};

type StatusResp = {
  job_id: string;
  status: string;
  stage_hint: string | null;
  recent_logs: string[];
  final_video_url: string | null;
  total_cost_usd: number | null;
  error: string | null;
};

// --- Neo-brutalist design tokens (mirrors src/app/admin/page.tsx) ------------
const C = {
  cream: "#fef6e4",
  ink: "#0a0a0a",
  paper: "#ffffff",
  sun: "#ffd803",
  red: "#ff5a5f",
  green: "#51cf66",
  blue: "#4dabf7",
  gray: "#868e96",
  violet: "#a78bfa",
  orange: "#ff922b",
};
const SHADOW = "6px 6px 0 #0a0a0a";
const SHADOW_SM = "4px 4px 0 #0a0a0a";
const BORDER = "4px solid #0a0a0a";
const BORDER_SM = "3px solid #0a0a0a";

const STATUS_META: Record<string, { bg: string; label: string }> = {
  pending: { bg: C.gray, label: "Queued" },
  processing: { bg: C.blue, label: "Processing" },
  complete: { bg: C.green, label: "Done" },
  error: { bg: C.red, label: "Error" },
};

export default function YoutubePipelinePage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);

  // Config form
  const [url, setUrl] = useState("");
  const [style, setStyle] = useState<string>("cyberpunk-neon");
  const [mode, setMode] = useState<string>("recompose");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [promptOverride, setPromptOverride] = useState("");
  const [force, setForce] = useState(false);
  const [maxSegments, setMaxSegments] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  // Submission / status
  const [submitting, setSubmitting] = useState(false);
  const [activeJob, setActiveJob] = useState<StatusResp | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The most recently submitted source URL — backs the source-video preview so
  // it stays visible even after the input is cleared (e.g. while queuing the
  // next URL), keeping the original on screen for comparison (FR-5, NFR-2).
  const [submittedUrl, setSubmittedUrl] = useState("");

  // Grid
  const [videos, setVideos] = useState<Video[]>([]);
  const [gridLoading, setGridLoading] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") setAuthed(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Active-job id / terminal flag as render-scope primitives so the polling
  // effects below can depend on stable values instead of the whole `activeJob`
  // object (which changes on every poll tick and would thrash the effects).
  const activeJobId = activeJob?.job_id;
  const jobTerminal =
    activeJob?.status === "complete" || activeJob?.status === "error";

  // Pure grid fetch (no setState) — reused by the polling effect, the terminal
  // refresh, and the imperative post-submit refresh below. Keeping setState out
  // of it lets effects call it without tripping react-hooks/set-state-in-effect.
  const refreshGrid = useCallback(async (): Promise<Video[]> => {
    const r = await fetch(API("videos?limit=60"));
    if (!r.ok) return [];
    return ((await r.json()).videos || []) as Video[];
  }, []);

  // ---- Status polling for the active job (FR-4) -----------------------------
  // Polls GET /status/{job_id} every 2.5s while a job is active. setState lives
  // inside the async poll() callback (not the effect body) — the React-recommended
  // "subscribe to an external system" shape — and the `cancelled` flag keeps
  // stale fetches from touching state after unmount or a job_id change.
  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(API(`status/${activeJobId}`));
        if (r.ok) {
          const data: StatusResp = await r.json();
          if (!cancelled) setActiveJob(data);
        }
      } catch {
        /* transient — keep polling */
      }
    };
    poll();
    const iv = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [activeJobId]);

  // Imperative grid refresh used after a fresh submission (handleProcess).
  const fetchVideos = useCallback(async () => {
    try {
      setVideos(await refreshGrid());
    } catch {
      /* ignore */
    } finally {
      setGridLoading(false);
    }
  }, [refreshGrid]);

  // ---- Grid polling ---------------------------------------------------------
  // Refresh the generated-videos grid every 8s while signed in. Same shape as
  // the status poll above: setState only inside the async callback + cancelled.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const list = await refreshGrid();
        if (!cancelled) {
          setVideos(list);
          setGridLoading(false);
        }
      } catch {
        /* ignore */
      }
    };
    poll();
    const iv = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [authed, refreshGrid]);

  // Refresh the grid once when the active job lands in a terminal state, so the
  // new generation surfaces without waiting for the next poll tick.
  useEffect(() => {
    if (!jobTerminal) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const list = await refreshGrid();
        if (!cancelled) setVideos(list);
      } catch {
        /* ignore */
      }
    };
    refresh();
    return () => {
      cancelled = true;
    };
  }, [jobTerminal, refreshGrid]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    // Authenticate through HyperFrames' shared /api/auth route so the httpOnly
    // `ha-auth` cookie is issued — the /api/youtube/* gateway requires it
    // server-side (ADR-005). Keeps a sessionStorage flag for the client gate.
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        setPwError(true);
        return;
      }
    } catch {
      setPwError(true);
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
    setAuthed(true);
    setPwError(false);
    setPw("");
  }

  async function handleProcess() {
    setSubmitError(null);
    if (!extractYouTubeId(url)) {
      setSubmitError("Enter a valid YouTube URL.");
      return;
    }
    setSubmitting(true);
    try {
      const advanced: Record<string, unknown> = { force };
      if (promptOverride.trim()) advanced.prompt = promptOverride.trim();
      if (maxSegments > 0) advanced.max_segments = maxSegments;

      const r = await fetch(API("process-youtube-video"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, style, mode, advanced_config: advanced }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || `HTTP ${r.status}`);
      setActiveJob({
        job_id: data.job_id,
        status: data.status || "pending",
        stage_hint: null,
        recent_logs: [],
        final_video_url: null,
        total_cost_usd: null,
        error: null,
      });
      // Remember the submitted source so the preview keeps showing it after the
      // input is cleared (e.g. while queuing the next URL) — FR-5 source display.
      setSubmittedUrl(url);
      fetchVideos();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  // The Process button gates on the INPUT alone (an empty/invalid input must
  // never submit), while the source-video preview falls back to the last
  // submitted URL so the embedded source stays visible after the input is
  // cleared (FR-5).
  const inputId = useMemo(() => extractYouTubeId(url), [url]);
  const sourceId = inputId ?? extractYouTubeId(submittedUrl);

  // --- Login screen ----------------------------------------------------------
  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.cream, fontFamily: "Inter, system-ui, sans-serif", padding: "20px" }}>
        <form onSubmit={handleLogin} style={{ background: C.paper, border: BORDER, boxShadow: SHADOW, padding: "44px 36px", width: "100%", maxWidth: "420px" }}>
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>🎬</div>
          <h1 style={{ fontSize: "30px", fontWeight: 900, margin: "0 0 6px", letterSpacing: "-0.5px", color: C.ink, textTransform: "uppercase" }}>
            YouTube Pipeline
          </h1>
          <p style={{ color: C.gray, margin: "0 0 28px", fontSize: "14px", fontWeight: 600 }}>
            AI Video Generation · Admin Sandbox
          </p>
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => { setPw(e.target.value); setPwError(false); }}
            placeholder="Enter password"
            style={{ width: "100%", boxSizing: "border-box", padding: "16px 18px", background: C.cream, border: BORDER_SM, color: C.ink, fontSize: "17px", fontWeight: 700, outline: "none", marginBottom: pwError ? "12px" : "22px" }}
          />
          {pwError && (
            <div style={{ background: C.red, color: C.paper, border: BORDER_SM, padding: "8px 12px", fontWeight: 800, fontSize: "13px", textTransform: "uppercase", marginBottom: "16px", boxShadow: SHADOW_SM }}>
              Incorrect password
            </div>
          )}
          <button type="submit" style={{ width: "100%", padding: "16px", background: C.ink, color: C.cream, border: BORDER_SM, boxShadow: SHADOW_SM, fontWeight: 900, fontSize: "16px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px" }}>
            Enter →
          </button>
          <a href="/admin" style={{ display: "inline-block", marginTop: "22px", color: C.gray, fontSize: "13px", textDecoration: "none", fontWeight: 700 }}>← Back to admin</a>
        </form>
      </div>
    );
  }

  // --- Dashboard -------------------------------------------------------------
  return (
    <div style={{ minHeight: "100vh", background: C.cream, color: C.ink, fontFamily: "Inter, system-ui, sans-serif", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: "1500px", margin: "0 auto" }}>
        {/* Header */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "34px", fontWeight: 900, margin: 0, letterSpacing: "-1px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ background: C.red, border: BORDER_SM, padding: "2px 12px", boxShadow: SHADOW_SM }}>▶</span>
              YouTube → AI Video
            </h1>
            <p style={{ color: C.gray, marginTop: "8px", fontSize: "13px", fontWeight: 600 }}>
              Pipeline sandbox · {videos.length} generation{videos.length !== 1 ? "s" : ""} on record
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => setHelpOpen((v) => !v)} style={{ ...btnGhost, background: helpOpen ? C.sun : C.paper }}>
              {helpOpen ? "▾" : "▸"} Help
            </button>
            <a href="/admin" style={{ ...btnSolid, background: C.paper, color: C.ink, textDecoration: "none" }}>← Admin</a>
            <a href="/" style={{ ...btnSolid, background: C.ink, color: C.cream, textDecoration: "none" }}>App →</a>
          </div>
        </header>

        {/* Help section */}
        {helpOpen && (
          <Panel title="How It Works" emoji="❓">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              {/* What */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 900, textTransform: "uppercase", marginBottom: "6px", color: C.ink }}>What does this do?</div>
                <p style={{ fontSize: "12px", lineHeight: 1.6, margin: 0, color: C.gray, fontWeight: 600 }}>
                  Paste a YouTube URL → the pipeline extracts the transcript, decomposes it into scenes, generates AI images for each scene, animates them into video clips, and assembles a final video — all styled with the template you choose.
                </p>
              </div>

              {/* Pipeline stages */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 900, textTransform: "uppercase", marginBottom: "6px" }}>Pipeline Stages</div>
                <ol style={{ fontSize: "11px", lineHeight: 1.8, margin: 0, paddingLeft: "18px", color: C.gray, fontWeight: 600 }}>
                  <li><b style={{ color: C.ink }}>Ingest</b> — Fetch metadata + thumbnail (Supadata API)</li>
                  <li><b style={{ color: C.ink }}>Transcript</b> — Extract full transcript (Supadata)</li>
                  <li><b style={{ color: C.ink }}>Storyboard</b> — LLM splits transcript into 8-12 scenes</li>
                  <li><b style={{ color: C.ink }}>Image Gen</b> — AI generates one image per scene (Replicate FLUX)</li>
                  <li><b style={{ color: C.ink }}>Video Gen</b> — Images animated with Ken Burns / SVD motion</li>
                  <li><b style={{ color: C.ink }}>Assembly</b> — FFmpeg stitches clips into final MP4</li>
                </ol>
              </div>

              {/* Styles */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 900, textTransform: "uppercase", marginBottom: "6px" }}>Styles</div>
                <ul style={{ fontSize: "11px", lineHeight: 1.8, margin: 0, paddingLeft: "16px", color: C.gray, fontWeight: 600 }}>
                  <li><b style={{ color: C.ink }}>Default</b> — Natural, no strong colour grading</li>
                  <li><b style={{ color: C.ink }}>Cyberpunk Neon</b> — Neon pinks, cyans, dark backgrounds</li>
                  <li><b style={{ color: C.ink }}>Corporate Clean</b> — Minimal, professional, white/black</li>
                  <li><b style={{ color: C.ink }}>Documentary Warm</b> — Earthy tones, orange/amber palette</li>
                </ul>
              </div>

              {/* Modes */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 900, textTransform: "uppercase", marginBottom: "6px" }}>Modes</div>
                <ul style={{ fontSize: "11px", lineHeight: 1.8, margin: 0, paddingLeft: "16px", color: C.gray, fontWeight: 600 }}>
                  <li><b style={{ color: C.ink }}>Recompose</b> — Transcript → AI images → video (default, works now)</li>
                  <li><b style={{ color: C.ink }}>V2V</b> — Direct video-to-video transformation (needs Runway API key)</li>
                  <li><b style={{ color: C.ink }}>Hybrid</b> — Mix of both approaches</li>
                </ul>
              </div>

              {/* Tips */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 900, textTransform: "uppercase", marginBottom: "6px" }}>Tips</div>
                <ul style={{ fontSize: "11px", lineHeight: 1.8, margin: 0, paddingLeft: "16px", color: C.gray, fontWeight: 600 }}>
                  <li>Processing takes 2-5 min depending on video length</li>
                  <li>Use <b style={{ color: C.ink }}>Force</b> in Advanced to re-run a cached video</li>
                  <li>Leave <b style={{ color: C.ink }}>Max segments</b> at 0 for auto (caps at 12)</li>
                  <li>Use <b style={{ color: C.ink }}>Prompt override</b> to inject custom art direction</li>
                  <li>Each generation costs ~$0.80 in API credits</li>
                </ul>
              </div>

              {/* API */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 900, textTransform: "uppercase", marginBottom: "6px" }}>Direct API Access</div>
                <pre style={{ background: C.cream, border: BORDER_SM, padding: "8px", fontSize: "10px", lineHeight: 1.5, margin: 0, overflow: "auto", whiteSpace: "pre-wrap" }}>{`POST /api/youtube/process-youtube-video
  {"url":"...","style":"cyberpunk-neon","mode":"recompose"}

GET  /api/youtube/status/{job_id}
GET  /api/youtube/videos`}</pre>
              </div>
            </div>
          </Panel>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "20px" }}>
          {/* Config + source side by side on wide screens */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px" }}>
            {/* Config panel */}
            <Panel title="Configure Run" emoji="⚙️">
              <label style={fieldLabel}>YouTube URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                style={{ ...inputStyle, marginBottom: "16px" }}
              />

              <label style={fieldLabel}>Style</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "16px" }}>
                {STYLES.map((s) => (
                  <button key={s.id} onClick={() => setStyle(s.id)} style={choiceBtn(style === s.id)}>
                    <span style={{ display: "flex", height: "20px", border: "2px solid #0a0a0a", marginBottom: "6px" }}>
                      {s.swatch.map((c, i) => <span key={i} style={{ flex: 1, background: c }} />)}
                    </span>
                    {s.label}
                  </button>
                ))}
              </div>

              <label style={fieldLabel}>Mode</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" }}>
                {MODES.map((m) => (
                  <button key={m.id} onClick={() => setMode(m.id)} style={choiceBtn(mode === m.id)}>
                    <div style={{ fontWeight: 900, fontSize: "13px" }}>{m.label}</div>
                    <div style={{ fontSize: "10px", color: C.gray, fontWeight: 700 }}>{m.desc}</div>
                  </button>
                ))}
              </div>

              {/* Advanced settings (expandable) */}
              <button onClick={() => setAdvancedOpen((v) => !v)} style={{ ...btnGhost, marginBottom: advancedOpen ? "14px" : "0" }}>
                {advancedOpen ? "▾" : "▸"} Advanced settings
              </button>
              {advancedOpen && (
                <div style={{ background: C.cream, border: BORDER_SM, padding: "14px", marginBottom: "16px" }}>
                  <label style={fieldLabel}>Prompt override</label>
                  <textarea value={promptOverride} onChange={(e) => setPromptOverride(e.target.value)} placeholder="Optional custom prompt for image/video gen…" rows={2} style={{ ...inputStyle, resize: "vertical", marginBottom: "12px" }} />
                  <label style={fieldLabel}>Max segments (0 = all)</label>
                  <input type="number" min={0} value={maxSegments} onChange={(e) => setMaxSegments(Math.max(0, parseInt(e.target.value) || 0))} style={{ ...inputStyle, marginBottom: "12px" }} />
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "13px", cursor: "pointer" }}>
                    <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} style={{ width: "18px", height: "18px", accentColor: C.ink }} />
                    Force (ignore cache, reprocess all)
                  </label>
                </div>
              )}

              {submitError && (
                <div style={{ background: C.red, color: C.paper, border: BORDER_SM, padding: "8px 12px", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", marginBottom: "12px", boxShadow: SHADOW_SM }}>⚠ {submitError}</div>
              )}

              <button onClick={handleProcess} disabled={submitting || !inputId} style={{ width: "100%", padding: "16px", background: submitting || !inputId ? "#c9b9bd" : C.red, color: C.paper, border: BORDER_SM, boxShadow: SHADOW_SM, fontWeight: 900, fontSize: "16px", cursor: submitting || !inputId ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "1px" }}>
                {submitting ? "Submitting…" : "▶ Process Video"}
              </button>
            </Panel>

            {/* Original video iframe */}
            <Panel title="Source Video" emoji="📺">
              {sourceId ? (
                <div style={{ border: BORDER, boxShadow: SHADOW_SM, aspectRatio: "16 / 9", background: "#000", overflow: "hidden" }}>
                  <iframe
                    src={youtubeEmbedUrl(sourceId) ?? undefined}
                    title="Source YouTube video"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                  />
                </div>
              ) : (
                <div style={{ border: BORDER_SM, background: C.cream, padding: "40px 20px", textAlign: "center", color: C.gray, fontWeight: 700, fontSize: "13px" }}>
                  Paste a YouTube URL to preview the source here.
                </div>
              )}
              {sourceId && (
                <code style={{ display: "block", marginTop: "10px", fontSize: "11px", background: C.cream, border: "2px solid #0a0a0a", padding: "4px 8px", fontWeight: 800, color: C.gray, wordBreak: "break-all" }}>{sourceId}</code>
              )}
            </Panel>
          </div>

          {/* Active job status */}
          {activeJob && <JobStatusCard job={activeJob} onDismiss={() => setActiveJob(null)} />}

          {/* Generated videos grid */}
          <Panel title="Generated Videos" emoji="🎞️">
            {gridLoading ? (
              <div style={{ padding: "30px", textAlign: "center", color: C.gray, fontWeight: 800 }}>Loading generations…</div>
            ) : videos.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", color: C.gray, fontWeight: 800 }}>No generations yet. Submit a URL above to begin.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                {videos.map((v) => (
                  <VideoCard key={v.job_id} video={v} />
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

// --- Active job status card ---------------------------------------------------
function JobStatusCard({ job, onDismiss }: { job: StatusResp; onDismiss: () => void }) {
  const meta = STATUS_META[job.status] || { bg: C.gray, label: job.status };
  const terminal = job.status === "complete" || job.status === "error";
  return (
    <div style={{ background: C.paper, border: BORDER, boxShadow: SHADOW, padding: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ fontSize: "13px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.5px" }}>⚡ Active Job</div>
        {terminal && <button onClick={onDismiss} style={{ ...btnGhost }}>✕ dismiss</button>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
        <span style={{ background: meta.bg, color: C.ink, border: "2px solid #0a0a0a", padding: "4px 12px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase" }}>{meta.label}</span>
        {job.stage_hint && <span style={{ fontSize: "12px", fontWeight: 800, color: C.gray }}>→ {job.stage_hint}</span>}
        <code style={{ fontSize: "11px", fontWeight: 800, background: C.cream, border: "2px solid #0a0a0a", padding: "2px 6px" }}>{job.job_id.substring(0, 8)}</code>
      </div>

      {job.status === "processing" && (
        <div style={{ height: "10px", background: C.cream, border: "2px solid #0a0a0a", marginBottom: "12px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: "60%", background: C.blue, animation: "brSlide 1.4s ease-in-out infinite" }} />
          <style>{`@keyframes brSlide{0%{margin-left:-60%}100%{margin-left:100%}}`}</style>
        </div>
      )}

      {job.error && (
        <div style={{ background: C.red, color: C.paper, border: BORDER_SM, padding: "8px 10px", fontSize: "12px", fontWeight: 800, marginBottom: "10px" }}>⚠ {job.error}</div>
      )}

      {job.recent_logs.length > 0 && (
        <pre style={{ background: C.cream, border: BORDER_SM, padding: "10px", fontSize: "11px", lineHeight: 1.5, maxHeight: "160px", overflow: "auto", margin: 0, whiteSpace: "pre-wrap" }}>
          {job.recent_logs.slice(-12).join("\n")}
        </pre>
      )}

      {job.final_video_url && (
        <a href={API(job.final_video_url.replace(/^\//, ""))} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: "10px", ...btnSolid, background: C.green, color: C.ink, textDecoration: "none" }}>
          ▶ View generated video
        </a>
      )}
    </div>
  );
}

// --- Generated video card (playback + comments + expandable data) -------------
function VideoCard({ video }: { video: Video }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [comment, setComment] = useState("");
  const [visuals, setVisuals] = useState<string>("");
  const [audioSync, setAudioSync] = useState<string>("");
  const [commentPosted, setCommentPosted] = useState(false);

  const meta = STATUS_META[video.status] || { bg: C.gray, label: video.status };
  const videoHref = video.final_video_url ? API(video.final_video_url.replace(/^\//, "")) : null;

  async function loadDetail() {
    if (detail) { setExpanded((v) => !v); return; }
    try {
      const r = await fetch(API(`videos/${video.job_id}`));
      if (r.ok) setDetail(await r.json());
    } catch { /* ignore */ }
    setExpanded(true);
  }

  async function postComment() {
    if (!comment.trim()) return;
    try {
      await fetch(API(`videos/${video.job_id}/comments`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment, visuals: visuals || null, audio_sync: audioSync || null }),
      });
      setComment("");
      setCommentPosted(true);
      setTimeout(() => setCommentPosted(false), 2500);
      loadDetail();
    } catch { /* ignore */ }
  }

  return (
    <div style={{ background: C.paper, border: BORDER, boxShadow: SHADOW, padding: "14px", display: "flex", flexDirection: "column" }}>
      {/* Thumbnail / player */}
      <div style={{ border: BORDER_SM, background: "#1a1a1a", aspectRatio: "16 / 9", marginBottom: "10px", overflow: "hidden" }}>
        {videoHref ? (
          <video src={videoHref} controls preload="metadata" style={{ width: "100%", height: "100%", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.gray, fontWeight: 800, fontSize: "12px" }}>⏳ {meta.label}</div>
        )}
      </div>

      {/* Meta */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
        <span style={{ background: meta.bg, color: C.ink, border: "2px solid #0a0a0a", padding: "2px 8px", fontSize: "10px", fontWeight: 900, textTransform: "uppercase" }}>{meta.label}</span>
        <MetaChip label={video.style} />
        <MetaChip label={video.mode} />
      </div>
      <code style={{ fontSize: "10px", background: C.cream, border: "2px solid #0a0a0a", padding: "2px 6px", fontWeight: 800, color: C.gray, marginBottom: "8px", wordBreak: "break-all" }}>{video.job_id.substring(0, 13)}</code>

      {video.total_cost_usd != null && (
        <div style={{ fontSize: "11px", fontWeight: 800, color: C.gray, marginBottom: "8px" }}>Cost: ${video.total_cost_usd.toFixed(4)}</div>
      )}

      {/* Comments */}
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Feedback / bug notes…" rows={2} style={{ ...inputStyle, fontSize: "12px", padding: "8px 10px", resize: "vertical", marginBottom: "8px" }} />
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
        <select value={visuals} onChange={(e) => setVisuals(e.target.value)} style={selectStyle}><option value="">Visuals</option><option value="good">Good</option><option value="bad">Bad</option></select>
        <select value={audioSync} onChange={(e) => setAudioSync(e.target.value)} style={selectStyle}><option value="">Audio</option><option value="yes">Synced</option><option value="no">Drift</option></select>
        <button onClick={postComment} style={{ ...btnSolid, background: C.sun, color: C.ink, padding: "8px 12px", fontSize: "12px" }}>{commentPosted ? "✓" : "Post"}</button>
      </div>

      <button onClick={loadDetail} style={{ ...btnGhost, fontSize: "12px" }}>{expanded ? "▾" : "▸"} Data & logs</button>
      {expanded && detail && (
        <div style={{ marginTop: "8px" }}>
          {video.error && <div style={{ background: C.red, color: C.paper, border: BORDER_SM, padding: "6px 8px", fontSize: "11px", fontWeight: 800, marginBottom: "8px" }}>{video.error}</div>}
          <DataSection title="Logs" text={typeof detail.logs === "string" ? detail.logs : ""} />
          <JsonSection title="Manifest" data={detail.manifest} />
          <JsonSection title="Transcript" data={detail.transcript} />
          <JsonSection title="Storyboard" data={detail.storyboard} />
          {Array.isArray((detail as { comments?: unknown[] }).comments) && (
            <div style={{ marginTop: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: 900, textTransform: "uppercase", marginBottom: "4px" }}>Comments ({(detail as { comments: unknown[] }).comments.length})</div>
              {(detail as { comments: { body: string; visuals?: string | null; audio_sync?: string | null; created_at?: string }[] }).comments.map((c, i) => (
                <div key={i} style={{ background: C.cream, border: "2px solid #0a0a0a", padding: "6px 8px", fontSize: "11px", marginBottom: "4px" }}>
                  <div style={{ fontWeight: 700 }}>{c.body}</div>
                  {(c.visuals || c.audio_sync) && <div style={{ fontSize: "10px", color: C.gray, marginTop: "2px" }}>{[c.visuals && "vis:" + c.visuals, c.audio_sync ? "audio:" + c.audio_sync : null].filter(Boolean).join(" · ")}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Small primitives --------------------------------------------------------
function Panel({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.paper, border: BORDER, boxShadow: SHADOW, padding: "18px" }}>
      <div style={{ fontSize: "13px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
        <span>{emoji}</span> {title}
      </div>
      {children}
    </section>
  );
}

function MetaChip({ label }: { label: string }) {
  return <span style={{ background: C.cream, border: "2px solid #0a0a0a", padding: "2px 7px", fontSize: "10px", fontWeight: 800 }}>{label}</span>;
}

function DataSection({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ fontSize: "11px", fontWeight: 900, textTransform: "uppercase", marginBottom: "4px" }}>{title}</div>
      <pre style={{ background: C.cream, border: BORDER_SM, padding: "8px", fontSize: "10px", lineHeight: 1.5, maxHeight: "140px", overflow: "auto", margin: 0, whiteSpace: "pre-wrap" }}>{text || "—"}</pre>
    </div>
  );
}

function JsonSection({ title, data }: { title: string; data: unknown }) {
  return <DataSection title={title} text={data ? JSON.stringify(data, null, 2) : ""} />;
}

// --- Shared inline styles ----------------------------------------------------
const btnSolid: React.CSSProperties = {
  padding: "10px 18px", border: BORDER_SM, boxShadow: SHADOW_SM,
  color: C.cream, fontWeight: 800, fontSize: "14px", cursor: "pointer",
  textTransform: "uppercase", letterSpacing: "0.5px",
};
const btnGhost: React.CSSProperties = {
  padding: "8px 14px", border: BORDER_SM, boxShadow: SHADOW_SM,
  background: C.cream, color: C.ink, fontWeight: 800, fontSize: "13px",
  cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px",
};
const fieldLabel: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 900, textTransform: "uppercase",
  letterSpacing: "0.5px", color: C.gray, marginBottom: "6px",
};
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px",
  background: C.paper, border: BORDER_SM, color: C.ink, fontSize: "14px",
  fontWeight: 700, outline: "none", boxShadow: SHADOW_SM,
};
const selectStyle: React.CSSProperties = {
  flex: 1, padding: "8px 10px", background: C.paper, border: BORDER_SM,
  color: C.ink, fontSize: "12px", fontWeight: 800, outline: "none", cursor: "pointer",
};

function choiceBtn(selected: boolean): React.CSSProperties {
  return {
    padding: "10px", border: BORDER_SM, cursor: "pointer", boxShadow: SHADOW_SM,
    background: selected ? C.sun : C.paper, color: C.ink, fontWeight: 800,
    fontSize: "12px", textTransform: "uppercase", textAlign: "center",
    transform: selected ? "translate(-2px,-2px)" : "none",
  };
}
