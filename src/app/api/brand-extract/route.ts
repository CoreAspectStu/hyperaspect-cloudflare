import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/app/api/_error";

const RENDER_BASE = "https://render.coreaspectai.com";

/**
 * URL brand extraction proxy.
 * Forwards a URL to the render relay's /brand-extract endpoint,
 * which screenshots it, runs GLM vision, and returns brand colors +
 * fonts + scraped text content.
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

  const { url } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  try {
    const resp = await fetch(`${RENDER_BASE}/brand-extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(90000), // 90s — screenshot + vision
    });

    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json(data, { status: resp.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    logError("brand-extract", err, req);
    return NextResponse.json(
      { error: `Brand extraction failed: ${err.message}` },
      { status: 502 }
    );
  }
}
