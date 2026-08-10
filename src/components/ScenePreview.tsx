"use client";

/**
 * ScenePreview — live, no-render-farm preview of a template scene (A0).
 *
 * Loads the composition HTML into a SAME-ORIGIN iframe (served by
 * /api/studio/template/[id]/preview/...), waits for its GSAP timeline to
 * register on `window.__timelines`, then seeks it to the selected scene's
 * midpoint and forces a render. The composition is authored at full pixel
 * dimensions (e.g. 1920×1080) and scaled down to fit the editor via a CSS
 * transform — so what you see is the actual rendered frame.
 *
 * Seek contract (matches hf-compose.py + the live templates):
 *   window.__timelines  → OBJECT keyed by composition-id (NOT an array)
 *   tl.seek(seconds)     → move the playhead
 *   tl.render()          → flush the new state to the DOM
 *   timeline is created {paused:true}, so we only ever seek, never play.
 *
 * Selecting a different scene re-seeks WITHOUT reloading the iframe (<400ms,
 * criterion C1). `reloadKey` bumps force a reload to pick up persisted edits.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

interface ScenePreviewProps {
  templateId: string;
  /** Start time (s) of the selected scene on the composition timeline, or null. */
  sceneStart: number | null;
  /** Duration (s) of the selected scene. */
  sceneDuration: number;
  /** Change to force the iframe to reload (e.g. after an edit persists). */
  reloadKey?: number;
}

const BORDER = "3px solid #0a0a0a";

interface GsapTimeline {
  seek?(t: number): unknown;
  render?(): unknown;
}

const overlayLabel: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#cbd2dc",
  fontSize: "0.8rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export function ScenePreview({ templateId, sceneStart, sceneDuration, reloadKey = 0 }: ScenePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const src = `/api/studio/template/${encodeURIComponent(templateId)}/preview/index.html`;

  // Fit the full-size composition within the stage — both width AND height — so
  // the preview letterboxes instead of swallowing the whole viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !dims) return;
    const recompute = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw > 0 && ch > 0 && dims.w > 0 && dims.h > 0) {
        setScale(Math.min(cw / dims.w, ch / dims.h));
      }
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dims]);

  // After each load: detect the timeline + read composition dimensions from #root.
  const handleLoad = () => {
    setReady(false);
    setError(null);
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      try {
        const win = iframeRef.current?.contentWindow as unknown as
          | { __timelines?: Record<string, GsapTimeline> }
          | null;
        const doc = iframeRef.current?.contentDocument;
        const root = doc?.getElementById("root");
        const tls = win?.__timelines;
        if (tls && root) {
          const w = Number(root.dataset.width) || 0;
          const h = Number(root.dataset.height) || 0;
          setDims({ w: w || 1920, h: h || 1080 });
          setReady(true);
          clearInterval(iv);
          return;
        }
      } catch {
        // cross-origin or not ready yet — keep polling
      }
      if (tries > 100) {
        // ~10s
        clearInterval(iv);
        setError("Composition didn't expose a timeline in time.");
      }
    }, 100);
  };

  // Seek to the selected scene's midpoint, then ISOLATE it: hide any element
  // whose [data-start]/[data-duration] window falls entirely outside this
  // scene. Seeking alone isn't enough — hand-crafted comps slide scenes and
  // leave loose clips (e.g. agent portraits) visible at every seek point.
  useEffect(() => {
    if (!ready || sceneStart == null) return;
    const seekTime = sceneStart + sceneDuration / 2;
    try {
      const win = iframeRef.current?.contentWindow as unknown as
        | { __timelines?: Record<string, GsapTimeline> }
        | null;
      const doc = iframeRef.current?.contentDocument;
      const tls = win?.__timelines;
      if (tls) {
        const tl = Object.values(tls)[0];
        // .seek() moves the playhead AND renders. Do NOT call .render() after —
        // with no args it re-renders at time 0 and wipes the seek.
        tl?.seek?.(seekTime);
      }
      if (doc) {
        const win0 = sceneStart;
        const win1 = sceneStart + sceneDuration;
        doc.querySelectorAll("[data-start]").forEach((el) => {
          const ds = parseFloat((el as HTMLElement).dataset.start || "");
          if (Number.isNaN(ds)) return;
          const dd = parseFloat((el as HTMLElement).dataset.duration || "0");
          const elEnd = ds + (Number.isNaN(dd) ? 0 : dd);
          // hide if entirely outside this scene's window; otherwise defer to GSAP
          (el as HTMLElement).style.opacity = elEnd <= win0 || ds >= win1 ? "0" : "";
        });
      }
    } catch {
      // ignore — retries on the next change
    }
  }, [ready, sceneStart, sceneDuration, reloadKey]);

  const ratio = dims ? `${dims.w} / ${dims.h}` : "16 / 9";

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        flex: 1,
        minHeight: "180px",
        padding: "8px 16px",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: dims ? `${dims.w * (scale || 0.0001)}px` : "auto",
          height: dims ? `${dims.h * (scale || 0.0001)}px` : "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          aspectRatio: dims ? undefined : ratio,
          background: "#000",
          border: BORDER,
          boxShadow: "6px 6px 0 #0a0a0a",
          overflow: "hidden",
        }}
      >
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={src}
          onLoad={handleLoad}
          title="Scene preview"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: dims ? `${dims.w}px` : "1920px",
            height: dims ? `${dims.h}px` : "1080px",
            transform: `scale(${scale || 0.0001})`,
            transformOrigin: "top left",
            border: "none",
            background: "#000",
            opacity: ready ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
        />
        {!ready && !error && <div style={overlayLabel}>Rendering scene…</div>}
        {error && <div style={{ ...overlayLabel, color: "#ff8a8a" }}>{error}</div>}
      </div>
    </div>
  );
}
