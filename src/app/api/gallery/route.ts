import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/app/api/_error";

const RENDER_BASE = "https://render.coreaspectai.com";

type GalleryVideo = {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
  duration?: string;
  format?: string;
  isReal?: boolean;
};

// ─── Static demo videos (shown only on page 1, before real renders) ───
const DEMO_VIDEOS: GalleryVideo[] = [
  { id: "demo1", title: "Coffee Shop Promo — 30s Ad", thumbnail: "/outputs/coffee-ad-thumb.jpg", url: "/outputs/coffee-ad-web.mp4", duration: "0:30", format: "16:9" },
  { id: "demo2", title: "Medieval Epic Trailer", thumbnail: "/outputs/templar-story-thumb.jpg", url: "/outputs/templar-story-web.mp4", duration: "0:45", format: "16:9" },
  { id: "demo3", title: "Animated Brand Series", thumbnail: "/outputs/cartoon-episode-thumb.jpg", url: "/outputs/cartoon-episode-web.mp4", duration: "1:12", format: "16:9" },
];

// Turn a raw backend video_name into a friendly, human-readable title.
function friendlyTitle(videoName: string): string {
  if (!videoName) return "HyperAspect Render";

  // Internal naming convention: "ha-<8hex>" → show a clean label with the short id.
  if (videoName.startsWith("ha-")) {
    const shortId = videoName.substring(3, 11);
    return `HyperAspect Render (${shortId})`;
  }

  // Otherwise prettify: replace separators with spaces and Title-Case the words.
  const pretty = videoName
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!pretty) return videoName;
  return pretty
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // ─── Pagination params ───
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.max(1, Math.min(60, parseInt(searchParams.get("limit") || "12", 10) || 12));

  // ─── Fetch real completed jobs from the render backend ───
  let realJobs: GalleryVideo[] = [];
  const secret = process.env.RENDER_SECRET;
  if (secret) {
    try {
      const resp = await fetch(`${RENDER_BASE}/video-jobs`, {
        headers: { Authorization: `Bearer ${secret}` },
      });

      if (resp.ok) {
        const data = await resp.json();
        const completed: any[] = (data.jobs || []).filter(
          (j: any) => j.status === "completed" && j.output_path
        );

        // Sort by creation date, newest first (fall back to finished_at then started_at).
        completed.sort((a, b) => {
          const ta = new Date(a.created_at || a.finished_at || a.started_at || 0).getTime();
          const tb = new Date(b.created_at || b.finished_at || b.started_at || 0).getTime();
          return tb - ta;
        });

        realJobs = completed.map((job) => ({
          id: job.id,
          title: friendlyTitle(job.video_name || ""),
          // Generated SVG thumbnail (template name + play icon) — no more reused coffee thumb.
          thumbnail: `/api/video-thumb?id=${encodeURIComponent(job.id)}`,
          url: `/api/video?id=${job.id}`,
          duration: "0:30",
          format: "16:9",
          isReal: true,
        }));
      }
    } catch (err) {
      logError("gallery", err, req);
      console.error("[gallery] Failed to fetch completed jobs:", err);
    }
  }

  // ─── Build the combined list: demos first, then real jobs ───
  // Demos live at the front of the list, so they naturally appear only on page 1.
  const allVideos: GalleryVideo[] = [...DEMO_VIDEOS, ...realJobs];
  const total = allVideos.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const start = (page - 1) * limit;
  const videos = allVideos.slice(start, start + limit);

  return NextResponse.json({ videos, total, page, totalPages });
}
