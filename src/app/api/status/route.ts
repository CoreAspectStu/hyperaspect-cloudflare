import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/app/api/_error";

const RENDER_BASE = "https://render.coreaspectai.com";

function mapStatus(dbStatus: string): string {
  switch (dbStatus) {
    case "pending": return "queued";
    case "running": return "rendering";
    case "completed": return "done";
    case "failed": case "failed-rescued": return "error";
    default: return "queued";
  }
}

function getProgress(job: any): number {
  if (job.status === "completed") return 100;
  if (job.status === "failed" || job.status === "failed-rescued") return 0;
  
  // For running jobs: the hf-worker only fires every 60s and renders complete
  // in 30-60s, so frames_captured is almost always 0. Use time-based estimation
  // instead — we know renders take ~60-90s on average.
  if (job.status === "running") {
    // P3-1 fix: default to 900 frames (30s × 30fps) instead of 2700 (90s × 30fps)
    // since most videos are shorter; avoids progress always looking too low
    const total = job.frames_total || 900;
    const captured = job.frames_captured || 0;
    if (captured > 0 && total > 0) {
      return Math.round((captured / total) * 100);
    }
    
    // Fallback: time-based estimation
    // Average render = 60s. Calculate elapsed since started_at.
    const startedAt = job.started_at || job.createdAt;
    if (startedAt) {
      try {
        const started = new Date(startedAt).getTime();
        const elapsed = (Date.now() - started) / 1000;
        const estimatedDuration = 75; // 75s average
        const pct = Math.min(95, Math.round((elapsed / estimatedDuration) * 100));
        return Math.max(5, pct); // show at least 5% so the bar is visible
      } catch {}
    }
    return 5;
  }
  
  // Pending (queued) — check if we have a createdAt for time estimation
  if (job.status === "pending") {
    const createdAt = job.createdAt;
    if (createdAt) {
      try {
        const created = new Date(createdAt).getTime();
        const elapsed = (Date.now() - created) / 1000;
        // Pipeline takes ~60s, then queue takes ~60-120s
        // Show progress during the pipeline phase
        const pipelineTime = 65;
        const pct = Math.min(30, Math.round((elapsed / pipelineTime) * 30));
        return Math.max(2, pct);
      } catch {}
    }
    return 2;
  }
  
  return 0;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("id");

  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
  }

  // Real job = UUID format OR videoName format (ha-xxxxxxxx)
  const isRealJob = (jobId.includes("-") && jobId.length > 20) || /^ha-[a-f0-9]{8}$/i.test(jobId);

  if (isRealJob) {
    const secret = process.env.RENDER_SECRET;
    if (!secret) {
      return NextResponse.json({
        id: jobId,
        status: "error",
        error: "RENDER_SECRET not configured",
      });
    }

    try {
      const resp = await fetch(`${RENDER_BASE}/video-status/${jobId}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });

      if (!resp.ok) {
        return NextResponse.json({
          id: jobId,
          status: "error",
          error: `Status check failed (${resp.status})`,
        });
      }

      const data = await resp.json();
      const status = mapStatus(data.status);
      const progress = getProgress(data);

      // Use the PROXY endpoint so the browser can load the video without auth
      let resultUrl: string | undefined;
      if (status === "done") {
        resultUrl = `/api/video?id=${jobId}`;
      }

      return NextResponse.json({
        id: jobId,
        status,
        progress,
        estimatedSeconds: status === "queued" ? 120 : status === "rendering" ? 60 : 0,
        resultUrl,
        error: data.error || undefined,
        videoName: data.videoName || undefined,
      });
    } catch (err: any) {
      logError("status", err, req);
      return NextResponse.json({
        id: jobId,
        status: "error",
        error: `Cannot reach render service: ${err.message}`,
      });
    }
  }

  // P1-4 fix: Invalid/unrecognized job ID — return error instead of fake demo mode.
  // Previously this fell through to a simulated 8s render, masking real errors.
  return NextResponse.json({
    id: jobId,
    status: "error",
    error: "Invalid or expired job ID. Please generate a new video.",
  });
}
