import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const JOBS_DIR = path.join(process.cwd(), "..", "..", "render-jobs");
const OUTPUT_DIR = path.join(process.cwd(), "public", "outputs");

type GalleryVideo = {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
};

// Escape HTML special characters to prevent XSS in gallery titles
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET(req: NextRequest) {
  const videos: GalleryVideo[] = [];

  // Always show curated demo videos first
  videos.push(
    { id: "demo1", title: "Coffee Shop Promo — 30s Ad", thumbnail: "/outputs/coffee-ad-thumb.jpg", url: "/outputs/coffee-ad-web.mp4" },
    { id: "demo2", title: "Medieval Epic Trailer", thumbnail: "/outputs/templar-story-thumb.jpg", url: "/outputs/templar-story-web.mp4" },
    { id: "demo3", title: "Animated Brand Series", thumbnail: "/outputs/cartoon-episode-thumb.jpg", url: "/outputs/cartoon-episode-web.mp4" }
  );

  // Append completed user jobs
  try {
    const jobFiles = fs.readdirSync(JOBS_DIR);
    // Collect candidate jobs first so we can sort by modification time
    const candidates: { jobId: string; mtime: number; title: string; thumbnail: string; url: string }[] = [];

    for (const file of jobFiles) {
      if (file.endsWith(".status")) {
        const jobId = file.split(".")[0];
        const statusFilePath = path.join(JOBS_DIR, file);
        const jobSpecPath = path.join(JOBS_DIR, `${jobId}.json`);

        try {
          const statusData = fs.readFileSync(statusFilePath, "utf-8");
          const jobStatus = JSON.parse(statusData);

          if (jobStatus.status === "done" && jobStatus.resultUrl) {
            let title = `Video ${jobId}`;
            try {
              const specData = fs.readFileSync(jobSpecPath, "utf-8");
              const jobSpec = JSON.parse(specData);
              title = jobSpec.brief?.input || jobSpec.inputValue || `Video ${jobId}`;
              if (title.length > 50) title = title.substring(0, 47) + "...";
            } catch {}

            // Sanitize user-provided title to prevent XSS
            title = escapeHtml(title);

            // Get modification time for sorting (most recent first)
            const stat = fs.statSync(statusFilePath);
            candidates.push({
              jobId,
              mtime: stat.mtimeMs,
              title,
              thumbnail: `/outputs/${jobId}-thumb.jpg`,
              url: jobStatus.resultUrl,
            });
          }
        } catch {}
      }
    }

    // Sort by most recent first
    candidates.sort((a, b) => b.mtime - a.mtime);

    // Limit to last 10 user jobs
    for (const c of candidates.slice(0, 10)) {
      videos.push({
        id: c.jobId,
        title: c.title,
        thumbnail: c.thumbnail,
        url: c.url,
      });
    }
  } catch {}

  return NextResponse.json({ videos });
}
