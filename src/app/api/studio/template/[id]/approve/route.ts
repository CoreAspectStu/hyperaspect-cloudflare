import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";
import { getApproval, setApproval, relayErrorResponse } from "@/lib/render-bridge";

/**
 * Human-approve gate (D5 step 4).
 *
 * GET /api/studio/template/[id]/approve — the producer's sign-off for the latest
 * render: {status: approved|rejected|pending, mp4, score, at, current}. `current`
 * is false when a newer render exists (→ pending re-approval).
 *
 * POST /api/studio/template/[id]/approve {status: approved|rejected, mp4, score?}
 * — record the decision (keyed by mp4) on the relay. 404 if the template is unknown.
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
    return NextResponse.json(await getApproval(id));
  } catch (e) {
    return relayErrorResponse(e);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const template = await getStore().get(id);
  if (!template) {
    return NextResponse.json({ error: `template not found: ${id}` }, { status: 404 });
  }

  let body: { status?: string; mp4?: string; score?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.status !== "approved" && body.status !== "rejected") {
    return NextResponse.json({ error: "status must be 'approved' or 'rejected'" }, { status: 400 });
  }
  if (!body.mp4 || typeof body.mp4 !== "string") {
    return NextResponse.json({ error: "mp4 is required" }, { status: 400 });
  }

  try {
    const approval = await setApproval(id, {
      status: body.status,
      mp4: body.mp4,
      score: typeof body.score === "number" ? body.score : undefined,
    });
    return NextResponse.json(approval);
  } catch (e) {
    return relayErrorResponse(e);
  }
}
