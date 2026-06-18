import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const JOBS_DIR = path.join(process.cwd(), "..", "..", "render-jobs");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("id");

  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
  }

  // Sanitize jobId: reject anything that isn't alphanumeric (prevents path traversal)
  if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
    return NextResponse.json(
      { error: "Invalid Job ID format" },
      { status: 400 }
    );
  }
  // Extra guard: explicitly reject path traversal attempts
  if (jobId.includes("..") || jobId.includes("/") || jobId.includes("\\")) {
    return NextResponse.json(
      { error: "Invalid Job ID format" },
      { status: 400 }
    );
  }

  const statusFilePath = path.join(JOBS_DIR, `${jobId}.status`);

  // Check if the status file exists — return 404 if not
  if (!fs.existsSync(statusFilePath)) {
    return NextResponse.json(
      { error: `Job ${jobId} not found` },
      { status: 404 }
    );
  }

  try {
    const statusData = fs.readFileSync(statusFilePath, "utf-8");
    const jobStatus = JSON.parse(statusData);
    return NextResponse.json(jobStatus);
  } catch (error) {
    // File exists but is malformed — treat as internal error, not silent default
    console.error(`Error reading status for job ${jobId}:`, error);
    return NextResponse.json(
      { error: "Failed to read job status — file may be corrupted" },
      { status: 500 }
    );
  }
}
