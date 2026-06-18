import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

// Generate endpoint — kicks off a HyperFrames render job
// In production this would queue to a background worker. For MVP we simulate progress.

const JOBS_DIR = path.join(process.cwd(), "..", "..", "render-jobs");
const OUTPUT_DIR = path.join(process.cwd(), "public", "outputs");

// Ensure dirs exist
try { fs.mkdirSync(JOBS_DIR, { recursive: true }); } catch {}
try { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); } catch {}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }
  if (typeof body.inputType !== "string" || body.inputType.trim() === "") {
    return NextResponse.json(
      { error: "Field 'inputType' is required and must be a non-empty string" },
      { status: 400 }
    );
  }
  if (typeof body.inputValue !== "string" || body.inputValue.trim() === "") {
    return NextResponse.json(
      { error: "Field 'inputValue' is required and must be a non-empty string" },
      { status: 400 }
    );
  }
  if (!body.brief || typeof body.brief !== "object") {
    return NextResponse.json(
      { error: "Field 'brief' is required and must be an object" },
      { status: 400 }
    );
  }

  const jobId = randomUUID().slice(0, 8);

  const job = {
    id: jobId,
    status: "queued" as const,
    progress: 0,
    estimatedSeconds: 120,
    brief: body.brief,
    inputType: body.inputType,
    inputValue: body.inputValue,
    createdAt: new Date().toISOString(),
  };

  // Save job spec
  fs.writeFileSync(
    path.join(JOBS_DIR, `${jobId}.json`),
    JSON.stringify(body, null, 2)
  );

  // Kick off render in background
  // For MVP we use our proven video templates as starting points
  startRenderJob(jobId, body).catch((err) => {
    console.error(`Job ${jobId} failed:`, err);
    fs.writeFileSync(
      path.join(JOBS_DIR, `${jobId}.error`),
      String(err)
    );
  });

  return NextResponse.json(job);
}

async function startRenderJob(jobId: string, spec: any) {
  const statusFile = path.join(JOBS_DIR, `${jobId}.status`);

  const updateStatus = (status: string, progress: number) => {
    fs.writeFileSync(statusFile, JSON.stringify({
      id: jobId,
      status,
      progress,
      estimatedSeconds: 120,
      updatedAt: new Date().toISOString(),
    }));
  };

  updateStatus("analyzing", 10);

  // Determine which template to use based on brief
  const brief = spec.brief || {};
  const purpose = (brief.purpose || "").toLowerCase();
  const tone = (brief.tone || "").toLowerCase();

  // Map to our pre-rendered demo videos (robust for demo)
  let templateVideo: string;
  if (purpose.includes("ad") || purpose.includes("promotion") || purpose.includes("product")) {
    templateVideo = path.join(OUTPUT_DIR, "coffee-ad-web.mp4");
  } else if (tone.includes("dramatic") || tone.includes("dark")) {
    templateVideo = path.join(OUTPUT_DIR, "templar-story-web.mp4");
  } else {
    templateVideo = path.join(OUTPUT_DIR, "cartoon-episode-web.mp4");
  }

  updateStatus("rendering", 50);

  // Copy template video as the job output
  const webOutput = path.join(OUTPUT_DIR, `${jobId}.mp4`);
  fs.copyFileSync(templateVideo, webOutput);

  updateStatus("done", 100);

  // Generate thumbnail
  const thumbnailFile = path.join(OUTPUT_DIR, `${jobId}-thumb.jpg`);
  await new Promise<void>((resolve) => {
    const ffmpegThumbnail = spawn("ffmpeg", [
      "-y", "-i", webOutput,
      "-ss", "00:00:01.000",
      "-frames:v", "1",
      "-vf", "scale=min(iw\\,400):-1",
      "-update", "1",
      thumbnailFile,
    ], { shell: false });

    ffmpegThumbnail.on("close", () => resolve());
    ffmpegThumbnail.on("error", () => resolve());
  });

  // Write final status with result URL
  fs.writeFileSync(statusFile, JSON.stringify({
    id: jobId,
    status: "done",
    progress: 100,
    estimatedSeconds: 120,
    resultUrl: `/outputs/${jobId}.mp4`,
    updatedAt: new Date().toISOString(),
  }));
}
