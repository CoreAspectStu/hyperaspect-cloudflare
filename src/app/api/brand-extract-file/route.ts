import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/app/api/_error";

const RENDER_BASE = "https://render.coreaspectai.com";

/**
 * File brand extraction proxy.
 * Forwards a PDF or image upload to the render relay's /brand-extract-file
 * endpoint, which converts PDF→image, runs GLM vision, and returns brand
 * colors + fonts + extracted text — same format as URL brand extraction.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RENDER_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "RENDER_SECRET not configured" },
      { status: 500 }
    );
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  try {
    // Forward the raw multipart body — don't parse it in Next.js
    const body = await req.arrayBuffer();

    const resp = await fetch(`${RENDER_BASE}/brand-extract-file`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Authorization: `Bearer ${secret}`,
      },
      body,
      signal: AbortSignal.timeout(90000), // 90s — PDF convert + vision
    });

    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json(data, { status: resp.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    logError("brand-extract-file", err, req);
    return NextResponse.json(
      { error: `File brand extraction failed: ${err.message}` },
      { status: 502 }
    );
  }
}
