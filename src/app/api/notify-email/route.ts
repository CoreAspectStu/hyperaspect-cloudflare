import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/app/api/_error";

const RENDER_BASE = "https://render.coreaspectai.com";

/**
 * Email notification proxy.
 * Forwards render completion/failure notifications to the relay,
 * which sends branded email via Gmail API.
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

  const { email, jobId, videoName, status, videoUrl } = body;
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  try {
    const resp = await fetch(`${RENDER_BASE}/notify-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ email, jobId, videoName, status, videoUrl }),
      signal: AbortSignal.timeout(20000),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json(data, { status: resp.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    logError("notify-email", err, req);
    return NextResponse.json(
      { error: `Email notification failed: ${err.message}` },
      { status: 502 }
    );
  }
}
