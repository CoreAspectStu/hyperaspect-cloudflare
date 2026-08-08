import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";
import { getReviewReport, relayErrorResponse } from "@/lib/render-bridge";

/**
 * GET /api/studio/template/[id]/review — vision-QA gate (D5 step 3).
 *
 * Async/pollable (the GLM review is slow + variable): the relay returns the
 * cached report if fresh, or spawns a detached review + returns 202 while it
 * runs. This route mirrors that — 200 + the report when ready, 202
 * `{status:"reviewing"}` while the review runs (the editor polls).
 *
 * 404 if the template is unknown or there's no rendered mp4 to review.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const template = await getStore().get(id);
  if (!template) {
    return NextResponse.json({ error: `template not found: ${id}` }, { status: 404 });
  }

  try {
    const { ready, report } = await getReviewReport(id);
    if (ready && report) {
      return NextResponse.json(report);
    }
    return NextResponse.json({ status: "reviewing" }, { status: 202 });
  } catch (e) {
    return relayErrorResponse(e);
  }
}
