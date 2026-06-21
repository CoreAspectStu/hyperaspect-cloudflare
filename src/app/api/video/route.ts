import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/app/api/_error";

const RENDER_BASE = "https://render.coreaspectai.com";

// Proxy endpoint — streams the rendered MP4 from the render backend
// to the browser, adding the RENDER_SECRET for auth.
// This is needed because the render backend requires a Bearer token
// that can't be exposed in the browser.
export async function GET(req: NextRequest) {
  const jobId = new URL(req.url).searchParams.get("id");
  if (!jobId) {
    return NextResponse.json({ error: "Job ID required" }, { status: 400 });
  }

  const secret = process.env.RENDER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RENDER_SECRET not configured" }, { status: 500 });
  }

  try {
    const resp = await fetch(`${RENDER_BASE}/video-output/${jobId}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: `Render service returned ${resp.status}` },
        { status: resp.status }
      );
    }

    // Stream the MP4 back to the browser
    const headers = new Headers();
    headers.set("Content-Type", resp.headers.get("content-type") || "video/mp4");
    headers.set("Content-Length", resp.headers.get("content-length") || "");
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("Accept-Ranges", "bytes");

    return new NextResponse(resp.body, { status: 200, headers });
  } catch (err: any) {
    logError("video", err, req);
    return NextResponse.json(
      { error: `Cannot reach render service: ${err.message}` },
      { status: 502 }
    );
  }
}
