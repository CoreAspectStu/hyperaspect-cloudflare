import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/app/api/_error";

const RENDER_BASE = "https://render.coreaspectai.com";

/**
 * Brand asset upload proxy.
 * Forwards a multipart/form-data logo upload from the browser to the render
 * relay's /brand-upload endpoint. The relay saves the file and returns a
 * relative path like `_brand-assets/brand-abc123.png` which the frontend
 * stores in brief._brand_logo and passes through to /api/generate.
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
    const body = await req.arrayBuffer();
    const resp = await fetch(`${RENDER_BASE}/brand-upload`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Authorization: `Bearer ${secret}`,
      },
      body,
    });

    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json(data, { status: resp.status });
    }

    // Convert relative path to a URL the relay can serve during render.
    // hf-compose.py reads this from the manifest's brand.logo_url field.
    const logoUrl = data.logoPath
      ? `${RENDER_BASE}/video-raw/${data.logoPath}`
      : undefined;

    return NextResponse.json({ ok: true, logoUrl, logoPath: data.logoPath });
  } catch (err: any) {
    logError("brand-upload", err, req);
    return NextResponse.json(
      { error: `Cannot reach render service: ${err.message}` },
      { status: 502 }
    );
  }
}
