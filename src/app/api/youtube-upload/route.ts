import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/app/api/_error";

const RENDER_BASE = "https://render.coreaspectai.com";

/**
 * YouTube upload proxy.
 * Forwards a completed render to the render relay's /video-upload endpoint,
 * which uploads to the VidAspect YouTube channel via the Data API.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RENDER_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "RENDER_SECRET not configured" },
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { jobId, title, description, tags, privacy, playlist } = body;
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  try {
    const resp = await fetch(`${RENDER_BASE}/video-upload/${jobId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        title,
        description,
        tags: tags || [],
        privacy: privacy || "private",
        playlist: playlist || undefined,
      }),
      signal: AbortSignal.timeout(280000), // 4.5 min — uploads can be slow
    });

    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json(data, { status: resp.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    logError("youtube-upload", err, req);
    return NextResponse.json(
      { error: `Upload failed: ${err.message}` },
      { status: 502 }
    );
  }
}
