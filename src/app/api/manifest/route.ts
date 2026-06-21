import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/app/api/_error";

const RENDER_BASE = "https://render.coreaspectai.com";

// GET /api/manifest?jobId=<id> — fetch manifest for editing
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const secret = process.env.RENDER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RENDER_SECRET not configured" }, { status: 500 });
  }

  try {
    const resp = await fetch(`${RENDER_BASE}/video-manifest/${jobId}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: `Manifest fetch failed (${resp.status}): ${text.substring(0, 200)}` },
        { status: resp.status }
      );
    }

    const manifest = await resp.json();
    return NextResponse.json(manifest);
  } catch (err: any) {
    logError("manifest-get", err, req);
    return NextResponse.json(
      { error: `Cannot reach render service: ${err.message}` },
      { status: 502 }
    );
  }
}

// POST /api/manifest/rerender — submit edited manifest for re-render
export async function POST(req: NextRequest) {
  const secret = process.env.RENDER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RENDER_SECRET not configured" }, { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { jobId, manifest } = body;
  if (!jobId || !manifest) {
    return NextResponse.json({ error: "jobId and manifest required" }, { status: 400 });
  }

  try {
    const resp = await fetch(`${RENDER_BASE}/video-rerender/${jobId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ manifest, variables: body.variables }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: `Re-render failed (${resp.status}): ${text.substring(0, 200)}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json({
      id: data.jobId,
      status: "queued",
      originalJobId: jobId,
      pipeline: data.pipeline,
    });
  } catch (err: any) {
    logError("manifest-rerender", err, req);
    return NextResponse.json(
      { error: `Cannot reach render service: ${err.message}` },
      { status: 502 }
    );
  }
}
