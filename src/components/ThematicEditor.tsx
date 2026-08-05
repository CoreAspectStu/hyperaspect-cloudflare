"use client";

/**
 * ThematicEditor — ResultScreen + Full Editor
 *
 * Replaces the old stub editor. After a render job completes, page.tsx mounts
 * this component with the finished MP4 URL, the user's brief, and the template
 * id. It renders a real video player, Download / Share / Create-New actions,
 * AND a 3-tab editor below: Content (inline text editing), Brand (color/font
 * customization), Export (download options).
 *
 * Editing triggers a new render: POST /api/generate with updated brief +
 * inputValue → poll GET /api/status → swap in the new resultUrl.
 *
 * The export name and props interface are preserved so page.tsx keeps working
 * unchanged: <ThematicEditor videoUrl brief templateId />.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Share2,
  RefreshCw,
  Check,
  Sparkles,
  Clock,
  Layers,
  Film,
  Loader2,
  Palette,
  FileText,
  DownloadCloud,
  AlertCircle,
  Type,
  Tv,
  Square,
  Smartphone,
  Music2,
  Copy,
  Upload,
  ExternalLink,
  Edit3,
} from "lucide-react";
import TimelineEditor from "@/components/TimelineEditor";

interface ThematicEditorProps {
  videoUrl: string;
  brief: Record<string, string>;
  templateId?: string;
  jobId?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Static config
 * ──────────────────────────────────────────────────────────────────────────── */

/** Friendly labels for known brief keys (incl. template-specific variables). */
const BRIEF_LABELS: Record<string, string> = {
  _template_name: "Template",
  _template_category: "Category",
  _template_duration: "Duration",
  aspectRatio: "Aspect Ratio",
  topic: "Topic",
  title: "Title",
  description: "Description",
  audience: "Audience",
  tone: "Tone",
  style: "Style",
  voice: "Voiceover",
  music: "Music",
  captions: "Captions",
  language: "Language",
  platform: "Platform",
  goal: "Goal",
  callToAction: "Call to Action",
  // Thematic / company variables
  company_name: "Company Name",
  companyName: "Company Name",
  tagline: "Tagline",
  headline: "Headline",
  founded_year: "Founded Year",
  website: "Website",
  key_features: "Key Features",
  keyFeatures: "Key Features",
  stat1_value: "Stat 1 Value",
  stat1_label: "Stat 1 Label",
  stat2_value: "Stat 2 Value",
  stat2_label: "Stat 2 Label",
  stat3_value: "Stat 3 Value",
  stat3_label: "Stat 3 Label",
  stat4_value: "Stat 4 Value",
  stat4_label: "Stat 4 Label",
  brand_primary: "Brand Primary",
  font_family: "Font Family",
};

/** Brief keys that are internal/template-metadata and should NOT be user-editable. */
const SKIP_KEYS = new Set<string>([
  "_template_id",
  "_template_name",
  "_template_category",
  "_template_duration",
  "aspectRatio",
  "_file_name",
  "_file_size",
  "_file_type",
]);

/** Preset brand colors. */
const BRAND_PRESETS = [
  { name: "YouTube Red", value: "#ff0000" },
  { name: "Blue", value: "#0066ff" },
  { name: "Green", value: "#00aa44" },
  { name: "Purple", value: "#8844ff" },
];

/** Font family options. */
const FONT_OPTIONS = [
  { name: "Inter", value: "'Inter', system-ui, -apple-system, sans-serif" },
  { name: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { name: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { name: "Courier", value: "'Courier New', Courier, monospace" },
];

/** Export resolution presets. */
const RESOLUTIONS = [
  { label: "720p", w: 1280, h: 720 },
  { label: "1080p", w: 1920, h: 1080, default: true },
  { label: "4K", w: 3840, h: 2160 },
];

/** Export format presets. */
const FORMATS = [
  { label: "MP4", ext: "mp4", default: true },
  { label: "WebM", ext: "webm" },
  { label: "GIF", ext: "gif" },
];

/** Social media export presets. */
const SOCIAL_PRESETS = [
  { name: "YouTube", w: 1920, h: 1080, fmt: "MP4", icon: Tv, note: "1920×1080" },
  { name: "Instagram Feed", w: 1080, h: 1080, fmt: "MP4", icon: Square, note: "1080×1080" },
  { name: "Instagram Story / Reel", w: 1080, h: 1920, fmt: "MP4", icon: Smartphone, note: "1080×1920" },
  { name: "TikTok", w: 1080, h: 1920, fmt: "MP4", icon: Music2, note: "1080×1920" },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/** Resolve a video URL to a fully-qualified href for download / sharing. */
function toAbsoluteUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return window.location.protocol + url;
  if (url.startsWith("/")) return window.location.origin + url;
  return window.location.origin + "/" + url;
}

/** Human-readable status for a polled job. */
function statusLabel(status?: string): string {
  switch (status) {
    case "analyzing":
      return "Analyzing your input";
    case "generating":
      return "Generating visuals with AI";
    case "rendering":
      return "Rendering final frames";
    case "queued":
      return "Queued for processing";
    case "error":
      return "Generation failed";
    default:
      return "Working";
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────────────── */

export default function ThematicEditor({ videoUrl, brief, templateId, jobId }: ThematicEditorProps) {
  /* Active tab */
  const [activeTab, setActiveTab] = useState<"content" | "brand" | "export">("content");

  /* Live video URL — updated when a re-render completes. */
  const [currentVideoUrl, setCurrentVideoUrl] = useState(videoUrl);

  /* Editable variables (Content tab). Initialized from non-underscore brief keys. */
  const [editedVars, setEditedVars] = useState<Record<string, string>>(() =>
    editableVarsFromBrief(brief),
  );

  /* Brand state */
  const [brandPrimary, setBrandPrimary] = useState<string>(
    () => brief.brand_primary || "#ff0000",
  );
  const [fontFamily, setFontFamily] = useState<string>(
    () => brief.font_family || FONT_OPTIONS[0].value,
  );

  /* Re-render state */
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatusText, setRenderStatusText] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /* Share / link state */
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  // YouTube upload state
  const [ytUploading, setYtUploading] = useState(false);
  const [ytResult, setYtResult] = useState<{ videoId: string; url: string } | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);

  /* Polling handle */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const absoluteUrl = useMemo(() => toAbsoluteUrl(currentVideoUrl), [currentVideoUrl]);

  /* Keep edited vars / live url in sync when the parent passes a new brief/url. */
  useEffect(() => {
    setEditedVars(editableVarsFromBrief(brief));
  }, [brief]);
  useEffect(() => {
    setCurrentVideoUrl(videoUrl);
  }, [videoUrl]);

  /* Stop polling on unmount. */
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  /* Auto-clear transient messages. */
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3500);
      return () => clearTimeout(t);
    }
  }, [successMsg]);
  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2500);
      return () => clearTimeout(t);
    }
  }, [copied]);
  useEffect(() => {
    if (linkCopied) {
      const t = setTimeout(() => setLinkCopied(false), 2500);
      return () => clearTimeout(t);
    }
  }, [linkCopied]);

  /* ─── Re-render flow ─── */
  const triggerRerender = async (overrides?: Partial<Record<string, string>>) => {
    setRenderError(null);
    setSuccessMsg(null);
    setIsRendering(true);
    setRenderProgress(0);
    setRenderStatusText("Starting render…");

    const newBrief: Record<string, string> = {
      ...brief,
      ...editedVars,
      brand_primary: brandPrimary,
      font_family: fontFamily,
      ...(overrides || {}),
    };
    if (templateId) newBrief._template_id = templateId;
    const inputValue =
      editedVars.topic ||
      brief.topic ||
      editedVars.title ||
      brief.title ||
      "";

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: newBrief, inputValue }),
      });
      if (!res.ok) throw new Error(`Generation failed (${res.status})`);
      const data = await res.json();
      const jobId: string | undefined = data?.id;
      if (!jobId) throw new Error("No job id returned");

      const stopPoll = () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };

      const poll = async () => {
        try {
          const sres = await fetch(`/api/status?id=${encodeURIComponent(jobId)}`);
          if (!sres.ok) return; // transient — keep polling
          const sdata = await sres.json();
          const pct = typeof sdata.progress === "number" ? sdata.progress : 0;
          setRenderProgress(pct);
          setRenderStatusText(statusLabel(sdata.status) || "Rendering…");

          if (sdata.status === "done") {
            stopPoll();
            const resultUrl =
              sdata.resultUrl || `/api/video?id=${encodeURIComponent(jobId)}`;
            setCurrentVideoUrl(resultUrl);
            setRenderProgress(100);
            setIsRendering(false);
            setSuccessMsg("Video updated!");
          } else if (sdata.status === "error") {
            stopPoll();
            setIsRendering(false);
            setRenderError(sdata.error || "Render failed. Please try again.");
          }
        } catch {
          /* transient network blip — keep polling */
        }
      };

      await poll(); // immediate first check
      pollRef.current = setInterval(poll, 2000);
    } catch (e) {
      setIsRendering(false);
      setRenderError(
        e instanceof Error ? e.message : "Failed to start render.",
      );
    }
  };

  /* ─── Action handlers ─── */

  const handleShare = async () => {
    const text = absoluteUrl;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Check out my AI-generated video!",
          url: text,
        });
        setCopied(true);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
      }
    } catch {
      /* user cancelled share sheet */
    }
  };

  const handleCreateNew = () => window.location.reload();

  const handleCopyShareLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
      } else {
        const ta = document.createElement("textarea");
        ta.value = absoluteUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setLinkCopied(true);
    } catch {
      /* ignore */
    }
  };

  /** Trigger a download of the current video (used by Export tab). */
  const downloadCurrent = (filenameStem: string) => {
    const a = document.createElement("a");
    a.href = absoluteUrl;
    a.download = `${filenameStem}.mp4`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /** Upload the completed video to YouTube (VidAspect channel). */
  const handleYouTubeUpload = async () => {
    if (!jobId || ytUploading) return;
    setYtUploading(true);
    setYtError(null);
    setYtResult(null);
    try {
      const title = editedVars.title || editedVars._template_name || `HyperAspect Video`;
      const resp = await fetch("/api/youtube-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          title: `${title} — HyperAspect`,
          description: `Created with HyperAspect AI video generator. ${editedVars.tagline || ""}`.trim(),
          tags: ["hyperaspect", "ai", "video", editedVars._template_category || "marketing"].filter(Boolean),
          privacy: "private",
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `Upload failed (${resp.status})`);
      setYtResult({ videoId: data.videoId, url: data.url });
      setSuccessMsg("Uploaded to YouTube!");
    } catch (err) {
      setYtError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setYtUploading(false);
    }
  };

  /* ─── Derived data ─── */

  const editableEntries = useMemo(
    () =>
      Object.entries(editedVars).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    [editedVars],
  );

  const summaryDuration = brief._template_duration
    ? `${brief._template_duration}s`
    : "—";
  const summaryAspect = brief.aspectRatio || "16:9";

  /* ──────────────────────────────────────────────────────────────────────────
   * Render
   * ──────────────────────────────────────────────────────────────────────── */

  return (
    <div
      className="thematic-editor"
      style={{
        minHeight: "calc(100vh - var(--header-height))",
        backgroundColor: "var(--bg-base, #fef6e4)",
        padding: "32px 16px 64px",
        position: "relative",
      }}
    >
      <div style={{ maxWidth: "var(--max-w, 1280px)", margin: "0 auto" }}>
        {/* ─── Header ─── */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "var(--accent, #ff0000)",
              color: "#fff",
              border: "4px solid var(--border, #0a0a0a)",
              boxShadow: "6px 6px 0 var(--border, #0a0a0a)",
              padding: "10px 20px",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontSize: "0.85rem",
              marginBottom: "16px",
            }}
          >
            <Sparkles size={18} fill="currentColor" />
            <span>Your Video Is Ready</span>
          </div>
          <h1
            style={{
              fontSize: "clamp(1.75rem, 5vw, 2.75rem)",
              fontWeight: 900,
              lineHeight: 1.05,
              margin: "0 0 8px",
              color: "var(--text, #0a0a0a)",
              textTransform: "uppercase",
            }}
          >
            Edit, <span style={{ color: "var(--accent, #ff0000)" }}>Refine</span> &amp;
            Export.
          </h1>
        </div>

        {/* ─── Top: video player + actions ─── */}
        <div
          className="thematic-main"
          style={{ maxWidth: "920px", margin: "0 auto" }}
        >
          {/* Video player card */}
          <div
            style={{
              position: "relative",
              backgroundColor: "#000",
              border: "4px solid var(--border, #0a0a0a)",
              boxShadow: "6px 6px 0 var(--border, #0a0a0a)",
              padding: "0",
              overflow: "hidden",
              aspectRatio: "16 / 9",
              width: "100%",
            }}
          >
            <video
              key={absoluteUrl}
              src={absoluteUrl}
              controls
              autoPlay
              playsInline
              muted
              preload="metadata"
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                objectFit: "contain",
                backgroundColor: "#000",
              }}
            >
              <track kind="captions" />
              Your browser does not support the video tag.
            </video>

            {/* Re-render progress overlay */}
            {isRendering && (
              <div
                className="render-overlay"
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "14px",
                  backgroundColor: "rgba(10,10,10,0.78)",
                  color: "#fff",
                  padding: "24px",
                  textAlign: "center",
                }}
              >
                <Loader2 size={36} className="spin" style={{ animation: "thematic-spin 0.9s linear infinite" }} />
                <div style={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.95rem" }}>
                  Re-rendering your video…
                </div>
                <div style={{ fontSize: "0.8rem", opacity: 0.85, fontWeight: 700 }}>
                  {renderStatusText || "Working…"}
                </div>
                {/* Progress bar */}
                <div
                  style={{
                    width: "min(320px, 80%)",
                    height: "14px",
                    border: "3px solid #0a0a0a",
                    backgroundColor: "rgba(255,255,255,0.18)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(2, Math.min(100, renderProgress))}%`,
                      height: "100%",
                      backgroundColor: "var(--accent, #ff0000)",
                      transition: "width 400ms ease",
                    }}
                  />
                </div>
                <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 700 }}>
                  {Math.round(renderProgress)}%
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div
            className="thematic-actions"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              marginTop: "24px",
            }}
          >
            <a
              href={absoluteUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              style={actionButtonStyle({ variant: "primary", flex: "1 1 200px" })}
            >
              <Download size={18} />
              <span>Download Video</span>
            </a>

            <button
              type="button"
              onClick={handleShare}
              style={actionButtonStyle({
                variant: copied ? "success" : "secondary",
                flex: "1 1 160px",
              })}
            >
              {copied ? <Check size={18} /> : <Share2 size={18} />}
              <span>{copied ? "Copied!" : "Share"}</span>
            </button>

            <button
              type="button"
              onClick={handleCreateNew}
              style={actionButtonStyle({ variant: "ghost", flex: "1 1 200px" })}
            >
              <RefreshCw size={18} />
              <span>Create New Video</span>
            </button>

            {jobId && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("content");
                  document.getElementById("editor-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                style={actionButtonStyle({ variant: "secondary", flex: "1 1 200px" })}
              >
                <Edit3 size={18} />
                <span>Tweak This Video</span>
              </button>
            )}

            {jobId && (
              <button
                type="button"
                onClick={() => setShowTimeline(true)}
                style={actionButtonStyle({ variant: "secondary", flex: "1 1 200px" })}
              >
                <Film size={18} />
                <span>Timeline Editor</span>
              </button>
            )}

            {jobId && !ytResult && (
              <button
                type="button"
                onClick={handleYouTubeUpload}
                disabled={ytUploading}
                style={{
                  ...actionButtonStyle({
                    variant: "secondary",
                    flex: "1 1 200px",
                  }),
                  backgroundColor: ytUploading ? "var(--bg-surface)" : "#ff0000",
                  color: ytUploading ? "var(--text-muted)" : "#fff",
                  borderColor: "#0a0a0a",
                  opacity: ytUploading ? 0.7 : 1,
                }}
              >
                {ytUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    <span>Upload to YouTube</span>
                  </>
                )}
              </button>
            )}

            {ytResult && (
              <a
                href={ytResult.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...actionButtonStyle({ variant: "success", flex: "1 1 200px" }),
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={18} />
                <span>View on YouTube</span>
              </a>
            )}

            {ytError && (
              <div style={{ flexBasis: "100%", color: "#ff6b6b", fontSize: "0.85rem", fontWeight: 600 }}>
                YouTube upload failed: {ytError}
              </div>
            )}
          </div>

          {/* Success / error toasts */}
          {successMsg && (
            <div
              className="thematic-toast"
              style={{
                marginTop: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "var(--lime, #b8ff00)",
                border: "4px solid var(--border, #0a0a0a)",
                boxShadow: "6px 6px 0 var(--border, #0a0a0a)",
                padding: "12px 16px",
                fontWeight: 900,
                textTransform: "uppercase",
                fontSize: "0.85rem",
                color: "var(--text, #0a0a0a)",
              }}
            >
              <Check size={18} /> {successMsg}
            </div>
          )}
          {renderError && (
            <div
              className="thematic-toast"
              style={{
                marginTop: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#ffe2e2",
                border: "4px solid var(--border, #0a0a0a)",
                boxShadow: "6px 6px 0 var(--border, #0a0a0a)",
                padding: "12px 16px",
                fontWeight: 800,
                fontSize: "0.85rem",
                color: "#b00020",
              }}
            >
              <AlertCircle size={18} /> {renderError}
              <button
                type="button"
                onClick={() => setRenderError(null)}
                style={{
                  marginLeft: "auto",
                  border: "3px solid var(--border, #0a0a0a)",
                  background: "#fff",
                  padding: "4px 10px",
                  fontWeight: 900,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ─── Tab bar ─── */}
          <div
            id="editor-section"
            className="thematic-tabs"
            role="tablist"
            aria-label="Editor tabs"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "32px",
              scrollMarginTop: "100px",
            }}
          >
            <TabButton
              active={activeTab === "content"}
              onClick={() => setActiveTab("content")}
              icon={<FileText size={16} />}
              label="Content"
            />
            <TabButton
              active={activeTab === "brand"}
              onClick={() => setActiveTab("brand")}
              icon={<Palette size={16} />}
              label="Brand"
            />
            <TabButton
              active={activeTab === "export"}
              onClick={() => setActiveTab("export")}
              icon={<DownloadCloud size={16} />}
              label="Export"
            />
          </div>

          {/* ─── Tab content ─── */}
          <div
            className="thematic-tab-panel"
            style={{
              marginTop: "16px",
              backgroundColor: "var(--bg-surface, #fff)",
              border: "4px solid var(--border, #0a0a0a)",
              boxShadow: "6px 6px 0 var(--border, #0a0a0a)",
              padding: "24px",
            }}
          >
            {activeTab === "content" && (
              <ContentTab
                entries={editableEntries}
                onChange={(key, value) =>
                  setEditedVars((prev) => ({ ...prev, [key]: value }))
                }
                disabled={isRendering}
                onApply={() => triggerRerender()}
              />
            )}

            {activeTab === "brand" && (
              <BrandTab
                brandPrimary={brandPrimary}
                setBrandPrimary={setBrandPrimary}
                fontFamily={fontFamily}
                setFontFamily={setFontFamily}
                disabled={isRendering}
                onApply={() => triggerRerender()}
              />
            )}

            {activeTab === "export" && (
              <ExportTab
                onDownload={downloadCurrent}
                onCopyLink={handleCopyShareLink}
                linkCopied={linkCopied}
              />
            )}
          </div>

          {/* Compact production summary footer */}
          <div
            style={{
              display: "flex",
              gap: "16px",
              marginTop: "20px",
              justifyContent: "center",
              color: "var(--text-muted, #6b6b6b)",
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Film size={14} />
              {brief._template_name || templateId || "Custom"}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Clock size={14} /> {summaryDuration}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Layers size={14} /> {summaryAspect}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Global styles / responsive ─── */}
      <style>{`
        @keyframes thematic-spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .thematic-editor { padding: 20px 12px 48px; }
          .thematic-actions { flex-direction: column; }
          .thematic-actions > * { flex: 1 1 100% !important; }
          .thematic-tabs { flex-direction: column; }
          .thematic-tabs > * { width: 100%; }
          .thematic-tab-panel { padding: 16px; }
        }
      `}</style>

      {/* Timeline Editor modal */}
      {showTimeline && (jobId || templateId) && (
        <TimelineEditor jobId={jobId} templateId={templateId} onClose={() => setShowTimeline(false)} />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tab sub-components
 * ──────────────────────────────────────────────────────────────────────────── */

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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "12px 20px",
        border: "4px solid var(--border, #0a0a0a)",
        boxShadow: active ? "6px 6px 0 var(--border, #0a0a0a)" : "3px 3px 0 var(--border, #0a0a0a)",
        fontSize: "0.85rem",
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        cursor: "pointer",
        fontFamily: "inherit",
        flex: "1 1 160px",
        backgroundColor: active
          ? "var(--accent, #ff0000)"
          : "var(--bg-surface, #fff)",
        color: active ? "#fff" : "var(--text, #0a0a0a)",
        transform: active ? "translate(-1px, -1px)" : "none",
        transition: "all 80ms ease",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <h2
        style={{
          fontSize: "1.1rem",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          margin: "0 0 4px",
          color: "var(--text, #0a0a0a)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {icon} {title}
      </h2>
      <div
        style={{
          height: "4px",
          width: "48px",
          backgroundColor: "var(--accent, #ff0000)",
          marginBottom: subtitle ? "8px" : "0",
        }}
      />
      {subtitle && (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted, #6b6b6b)", fontWeight: 600 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ─── TAB 1: CONTENT ─── */
function ContentTab({
  entries,
  onChange,
  disabled,
  onApply,
}: {
  entries: [string, string][];
  onChange: (key: string, value: string) => void;
  disabled: boolean;
  onApply: () => void;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "3px solid var(--border, #0a0a0a)",
    backgroundColor: "var(--bg-base, #fef6e4)",
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "var(--text, #0a0a0a)",
    fontFamily: "inherit",
    outline: "none",
  };

  return (
    <div>
      <SectionTitle
        icon={<FileText size={18} />}
        title="Content"
        subtitle="Edit the text fields shown in your video, then re-render."
      />

      {entries.length === 0 ? (
        <p style={{ color: "var(--text-muted, #6b6b6b)", margin: 0 }}>
          No editable fields available for this template.
        </p>
      ) : (
        <div
          className="content-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
          }}
        >
          {entries.map(([key, value]) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-muted, #6b6b6b)",
                }}
              >
                {labelFor(key)}
              </span>
              <input
                type="text"
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(key, e.target.value)}
                style={inputStyle}
              />
            </label>
          ))}
        </div>
      )}

      <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onApply}
          disabled={disabled}
          style={{
            ...actionButtonStyle({ variant: "primary", flex: "0 1 auto" }),
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {disabled ? <Loader2 size={18} className="spin" style={{ animation: "thematic-spin 0.9s linear infinite" }} /> : <Sparkles size={18} />}
          <span>Apply Changes</span>
        </button>
      </div>
    </div>
  );
}

/* ─── TAB 2: BRAND ─── */
function BrandTab({
  brandPrimary,
  setBrandPrimary,
  fontFamily,
  setFontFamily,
  disabled,
  onApply,
}: {
  brandPrimary: string;
  setBrandPrimary: (v: string) => void;
  fontFamily: string;
  setFontFamily: (v: string) => void;
  disabled: boolean;
  onApply: () => void;
}) {
  return (
    <div>
      <SectionTitle
        icon={<Palette size={18} />}
        title="Brand"
        subtitle="Pick an accent color and font, then re-render with your branding."
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          alignItems: "flex-start",
        }}
      >
        {/* Left: color + font controls */}
        <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Preset colors */}
          <div>
            <div style={fieldLabelStyle}>Accent Color — Presets</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "8px" }}>
              {BRAND_PRESETS.map((p) => {
                const selected = brandPrimary.toLowerCase() === p.value.toLowerCase();
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setBrandPrimary(p.value)}
                    title={`${p.name} (${p.value})`}
                    style={{
                      width: "48px",
                      height: "48px",
                      border: `4px solid ${selected ? "var(--accent, #ff0000)" : "var(--border, #0a0a0a)"}`,
                      boxShadow: selected ? "4px 4px 0 var(--border, #0a0a0a)" : "2px 2px 0 var(--border, #0a0a0a)",
                      backgroundColor: p.value,
                      cursor: "pointer",
                      position: "relative",
                      transform: selected ? "translate(-1px, -1px)" : "none",
                    }}
                  >
                    {selected && (
                      <Check
                        size={20}
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          color: "#fff",
                          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: "6px", fontSize: "0.7rem", color: "var(--text-muted, #6b6b6b)", fontWeight: 700 }}>
              {BRAND_PRESETS.find((p) => p.value.toLowerCase() === brandPrimary.toLowerCase())?.name || "Custom"}
            </div>
          </div>

          {/* Custom color picker */}
          <div>
            <div style={fieldLabelStyle}>Custom Color</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
              <input
                type="color"
                value={normalizeHex(brandPrimary)}
                onChange={(e) => setBrandPrimary(e.target.value)}
                style={{
                  width: "56px",
                  height: "44px",
                  padding: 0,
                  border: "4px solid var(--border, #0a0a0a)",
                  background: "none",
                  cursor: "pointer",
                }}
              />
              <input
                type="text"
                value={brandPrimary}
                onChange={(e) => setBrandPrimary(e.target.value)}
                spellCheck={false}
                style={{
                  width: "120px",
                  padding: "10px 12px",
                  border: "3px solid var(--border, #0a0a0a)",
                  backgroundColor: "var(--bg-base, #fef6e4)",
                  fontFamily: "'Courier New', monospace",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--text, #0a0a0a)",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Font selector */}
          <div>
            <div style={fieldLabelStyle}>
              <Type size={13} style={{ display: "inline", marginRight: "4px", verticalAlign: "-2px" }} />
              Font Family
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
              {FONT_OPTIONS.map((f) => {
                const selected = fontFamily === f.value;
                return (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => setFontFamily(f.value)}
                    style={{
                      padding: "8px 14px",
                      border: `3px solid var(--border, #0a0a0a)`,
                      boxShadow: selected ? "3px 3px 0 var(--border, #0a0a0a)" : "2px 2px 0 var(--border, #0a0a0a)",
                      backgroundColor: selected ? "var(--accent, #ff0000)" : "var(--bg-base, #fef6e4)",
                      color: selected ? "#fff" : "var(--text, #0a0a0a)",
                      fontWeight: 800,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      fontFamily: f.value,
                      transform: selected ? "translate(-1px, -1px)" : "none",
                    }}
                  >
                    {f.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: live preview */}
        <div style={{ flex: "1 1 280px", minWidth: "240px" }}>
          <div style={fieldLabelStyle}>Live Preview</div>
          <div
            style={{
              marginTop: "8px",
              border: "4px solid var(--border, #0a0a0a)",
              boxShadow: "6px 6px 0 var(--border, #0a0a0a)",
              overflow: "hidden",
              backgroundColor: "#fff",
            }}
          >
            <div style={{ height: "10px", backgroundColor: brandPrimary }} />
            <div style={{ padding: "20px", fontFamily }}>
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: brandPrimary,
                  marginBottom: "6px",
                }}
              >
                Your Brand
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--text, #0a0a0a)", lineHeight: 1.1 }}>
                Sample Headline
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted, #6b6b6b)", marginTop: "6px", fontWeight: 600 }}>
                A short supporting line of body copy.
              </div>
              <div
                style={{
                  display: "inline-block",
                  marginTop: "14px",
                  padding: "8px 16px",
                  border: "3px solid var(--border, #0a0a0a)",
                  backgroundColor: brandPrimary,
                  color: "#fff",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.75rem",
                  letterSpacing: "0.04em",
                }}
              >
                Call To Action
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onApply}
          disabled={disabled}
          style={{
            ...actionButtonStyle({ variant: "primary", flex: "0 1 auto" }),
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {disabled ? <Loader2 size={18} className="spin" style={{ animation: "thematic-spin 0.9s linear infinite" }} /> : <Palette size={18} />}
          <span>Apply Brand</span>
        </button>
      </div>
    </div>
  );
}

/* ─── TAB 3: EXPORT ─── */
function ExportTab({
  onDownload,
  onCopyLink,
  linkCopied,
}: {
  onDownload: (stem: string) => void;
  onCopyLink: () => void;
  linkCopied: boolean;
}) {
  return (
    <div>
      <SectionTitle
        icon={<DownloadCloud size={18} />}
        title="Export"
        subtitle="Download your video in different sizes and formats. (Real transcoding coming soon — these grab the current render.)"
      />

      {/* Resolutions */}
      <div style={{ marginBottom: "24px" }}>
        <div style={fieldLabelStyle}>Resolution</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "8px" }}>
          {RESOLUTIONS.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => onDownload(`video-${r.label.toLowerCase()}`)}
              style={exportButtonStyle(r.default)}
            >
              {r.default && <Check size={14} />}
              <span>
                {r.label}{" "}
                <span style={{ opacity: 0.7, fontWeight: 600 }}>
                  ({r.w}×{r.h})
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Formats */}
      <div style={{ marginBottom: "24px" }}>
        <div style={fieldLabelStyle}>Format</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "8px" }}>
          {FORMATS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => onDownload(`video.${f.ext}`)}
              style={exportButtonStyle(f.default)}
            >
              {f.default && <Check size={14} />}
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Social presets */}
      <div style={{ marginBottom: "24px" }}>
        <div style={fieldLabelStyle}>Social Media Presets</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          {SOCIAL_PRESETS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => onDownload(s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  border: "4px solid var(--border, #0a0a0a)",
                  boxShadow: "4px 4px 0 var(--border, #0a0a0a)",
                  backgroundColor: "var(--bg-surface, #fff)",
                  color: "var(--text, #0a0a0a)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  transition: "transform 80ms ease",
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "translate(-1px,-1px)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "none")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "34px",
                    height: "34px",
                    flexShrink: 0,
                    backgroundColor: "var(--accent, #ff0000)",
                    color: "#fff",
                    border: "3px solid var(--border, #0a0a0a)",
                  }}
                >
                  <Icon size={18} />
                </span>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 900, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted, #6b6b6b)" }}>
                    {s.note} · {s.fmt}
                  </span>
                </span>
                <Download size={16} style={{ marginLeft: "auto", opacity: 0.6 }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Share link */}
      <div>
        <div style={fieldLabelStyle}>Share Link</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "8px", alignItems: "stretch" }}>
          <button
            type="button"
            onClick={onCopyLink}
            style={actionButtonStyle({
              variant: linkCopied ? "success" : "secondary",
              flex: "1 1 200px",
            })}
          >
            {linkCopied ? <Check size={18} /> : <Copy size={18} />}
            <span>{linkCopied ? "Link Copied!" : "Copy Share Link"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Style helpers
 * ──────────────────────────────────────────────────────────────────────────── */

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted, #6b6b6b)",
};

function labelFor(key: string): string {
  return BRIEF_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Pull editable variable entries from a brief (skip underscore + metadata keys). */
function editableVarsFromBrief(brief: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(brief)) {
    if (k.startsWith("_") || SKIP_KEYS.has(k)) continue;
    out[k] = String(v ?? "");
  }
  return out;
}

/** Make sure a color string is usable as an <input type=color> value (needs #rrggbb). */
function normalizeHex(color: string): string {
  const c = (color || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    return "#" + c.slice(1).split("").map((ch) => ch + ch).join("");
  }
  return "#ff0000";
}

/** Style factory for export toggle buttons. */
function exportButtonStyle(isDefault?: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    border: "4px solid var(--border, #0a0a0a)",
    boxShadow: "4px 4px 0 var(--border, #0a0a0a)",
    backgroundColor: isDefault ? "var(--accent, #ff0000)" : "var(--bg-base, #fef6e4)",
    color: isDefault ? "#fff" : "var(--text, #0a0a0a)",
    fontWeight: 900,
    textTransform: "uppercase",
    fontSize: "0.8rem",
    letterSpacing: "0.02em",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "transform 80ms ease",
  };
}

/** Shared neo-brutalist button style factory. */
function actionButtonStyle({
  variant = "secondary",
  flex = "1 1 auto",
}: {
  variant?: "primary" | "secondary" | "ghost" | "success";
  flex?: string;
}): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "14px 20px",
    border: "4px solid var(--border, #0a0a0a)",
    boxShadow: "6px 6px 0 var(--border, #0a0a0a)",
    fontSize: "0.9rem",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    cursor: "pointer",
    textDecoration: "none",
    flex,
    fontFamily: "inherit",
    transition: "transform 80ms ease, box-shadow 80ms ease",
  };

  switch (variant) {
    case "primary":
      return { ...base, backgroundColor: "var(--accent, #ff0000)", color: "#fff" };
    case "success":
      return { ...base, backgroundColor: "var(--lime, #b8ff00)", color: "var(--text, #0a0a0a)" };
    case "ghost":
      return {
        ...base,
        backgroundColor: "var(--bg-base, #fef6e4)",
        color: "var(--text, #0a0a0a)",
      };
    case "secondary":
    default:
      return { ...base, backgroundColor: "var(--bg-surface, #fff)", color: "var(--text, #0a0a0a)" };
  }
}
