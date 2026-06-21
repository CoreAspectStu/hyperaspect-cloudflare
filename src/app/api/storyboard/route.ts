import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const RENDER_BASE = "https://render.coreaspectai.com";

// Async storyboard: POST returns { jobId, status: "pending" } immediately.
// Frontend polls GET /api/storyboard-status?jobId=xxx until status === "done".
export async function POST(req: NextRequest) {
  // P1-2 fix: Rate limit storyboard creation (triggers expensive GLM call)
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  const secret = process.env.RENDER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RENDER_SECRET not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { mode, brief, description, aspectRatio } = body;

    if (!mode || !description) {
      return NextResponse.json({ error: "mode and description are required" }, { status: 400 });
    }

    const resp = await fetch(`${RENDER_BASE}/storyboard`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ mode, brief: brief || {}, description, aspectRatio: aspectRatio || "16:9" }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json(
        { error: `Storyboard generation failed (${resp.status}): ${errText.substring(0, 200)}` },
        { status: resp.status }
      );
    }

    // Relay now returns { jobId, status: "pending" } — pass through to frontend.
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Cannot reach storyboard service: ${err.message}` },
      { status: 502 }
    );
  }
}
