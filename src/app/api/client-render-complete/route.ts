import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/app/api/_error";

const RENDER_BASE = "https://render.coreaspectai.com";

/**
 * POST /api/client-render-complete
 *
 * Receives telemetry from browser-rendered videos and forwards to the relay
 * server so they appear in the admin dashboard.
 *
 * This is fire-and-forget from the client perspective — failures don't
 * affect the user's video (they already have their MP4).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Forward to relay for admin dashboard visibility
    const secret = process.env.RENDER_SECRET;
    if (secret) {
      try {
        await fetch(`${RENDER_BASE}/client-render-notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({
            templateId: body.templateId || "unknown",
            renderTime: body.renderTime || 0,
            framesEncoded: body.framesEncoded || 0,
            workerCount: body.workerCount || 0,
            codec: body.codec || "unknown",
            hardwareAccelerated: body.hardwareAccelerated || false,
            fileSize: body.fileSize || 0,
            userAgent: body.userAgent || "",
          }),
        });
      } catch {
        // Non-critical — relay might be down, but the user already has their video
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    logError("client-render-complete", err, req);
    return NextResponse.json({ ok: true }, { status: 200 }); // Always return OK — don't break client
  }
}
