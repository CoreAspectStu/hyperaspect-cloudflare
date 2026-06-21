import { NextRequest, NextResponse } from "next/server";

const RENDER_BASE = "https://render.coreaspectai.com";

// GET /api/storyboard-status?jobId=sb-xxx
// Polls the relay for async storyboard job status.
// Returns { status: "pending" } or { status: "done", manifest: {...} } or { status: "error", error: "..." }
export async function GET(req: NextRequest) {
  const secret = process.env.RENDER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RENDER_SECRET not configured" }, { status: 500 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId parameter required" }, { status: 400 });
  }

  try {
    const resp = await fetch(`${RENDER_BASE}/storyboard-status/${jobId}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json(
        { error: `Status check failed (${resp.status}): ${errText.substring(0, 200)}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Cannot reach storyboard service: ${err.message}` },
      { status: 502 }
    );
  }
}
