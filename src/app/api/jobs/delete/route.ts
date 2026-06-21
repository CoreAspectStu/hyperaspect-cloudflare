import { NextRequest, NextResponse } from "next/server";

const RENDER_BASE = "https://render.coreaspectai.com";

export async function DELETE(req: NextRequest) {
  const jobId = new URL(req.url).searchParams.get("id");
  if (!jobId) {
    return NextResponse.json({ error: "Job ID required" }, { status: 400 });
  }

  const secret = process.env.RENDER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RENDER_SECRET not configured" }, { status: 500 });
  }

  try {
    const resp = await fetch(`${RENDER_BASE}/video-jobs/${jobId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${secret}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `Render service error: ${resp.status} ${text}` }, { status: resp.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
