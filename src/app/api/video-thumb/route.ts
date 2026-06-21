import { NextRequest, NextResponse } from "next/server";

const RENDER_BASE = "https://render.coreaspectai.com";

// Escape text for safe embedding inside SVG <text>.
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// SVG fallback thumbnail when real thumbnail extraction isn't available
function buildThumbSvg(label: string): string {
  const safe = escapeXml(label || "HyperAspect Render");
  const maxChars = 34;
  const display = safe.length > maxChars ? safe.slice(0, maxChars - 1) + "\u2026" : safe;
  const tri = `<polygon points="222,108 222,162 266,135" fill="#ff3b3b" />`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
  <rect width="480" height="270" fill="#0f0f0f"/>
  <g opacity="0.55"><circle cx="240" cy="135" r="44" fill="none" stroke="#ffffff" stroke-width="2"/></g>
  ${tri}
  <text x="240" y="208" font-family="sans-serif" font-size="20" font-weight="600" fill="#ffffff" text-anchor="middle">${display}</text>
</svg>`;
}

export async function GET(req: NextRequest) {
  const jobId = new URL(req.url).searchParams.get("id");
  if (!jobId) {
    return new NextResponse(buildThumbSvg("Missing job id"), {
      status: 400,
      headers: { "Content-Type": "image/svg+xml" },
    });
  }

  const secret = process.env.RENDER_SECRET;

  // Try to fetch a REAL thumbnail from the relay (ffmpeg frame extraction)
  if (secret) {
    try {
      const resp = await fetch(`${RENDER_BASE}/video-thumb/${jobId}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });

      if (resp.ok) {
        // Stream the JPEG back to the browser
        const headers = new Headers();
        headers.set("Content-Type", resp.headers.get("content-type") || "image/jpeg");
        headers.set("Cache-Control", "public, max-age=3600");
        return new NextResponse(resp.body, { status: 200, headers });
      }
    } catch (err) {
      console.error("[video-thumb] Relay thumbnail fetch failed:", err);
    }
  }

  // Fallback: generate SVG placeholder
  let label = "HyperAspect Render";
  if (secret) {
    try {
      const resp = await fetch(`${RENDER_BASE}/video-jobs`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        const job = (data.jobs || []).find((j: any) => j.id === jobId);
        if (job) {
          const vname = job.video_name || "";
          label = vname.startsWith("ha-")
            ? `Render ${vname.substring(3, 11)}`
            : vname.replace(/[-_]+/g, " ").trim() || label;
        }
      }
    } catch {}
  }

  return new NextResponse(buildThumbSvg(label), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
