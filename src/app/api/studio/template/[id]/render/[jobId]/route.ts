import { NextRequest, NextResponse } from "next/server";
import { getRenderStatus, relayErrorResponse } from "@/lib/render-bridge";

/**
 * GET /api/studio/template/[id]/render/[jobId] — poll a render job's status via
 * the relay. Returns { jobId, status, progress, videoName, output, error,
 * createdAt, completedAt }. 404 if the relay doesn't know the job; 502 if
 * unreachable.
 *
 * The [id] segment is the template/videoName, kept in the path for symmetry with
 * the enqueue route (POST .../[id]/render); status is keyed solely on [jobId].
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> },
) {
  const { jobId } = await params;
  try {
    const status = await getRenderStatus(jobId);
    return NextResponse.json(status);
  } catch (e) {
    return relayErrorResponse(e);
  }
}
