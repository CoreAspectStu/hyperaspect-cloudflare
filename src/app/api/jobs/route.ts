import { NextRequest, NextResponse } from "next/server";

const RENDER_BASE = "https://render.coreaspectai.com";

export async function GET(req: NextRequest) {
  const secret = process.env.RENDER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RENDER_SECRET not configured" }, { status: 500 });
  }

  try {
    const resp = await fetch(`${RENDER_BASE}/video-jobs`, {
      headers: { Authorization: `Bearer ${secret}` },
    });

    if (!resp.ok) {
      return NextResponse.json({ error: `Render service error: ${resp.status}` }, { status: 502 });
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: `Cannot reach render service: ${err.message}` }, { status: 502 });
  }
}
