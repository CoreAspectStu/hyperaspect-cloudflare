import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";
import { getDelivery, deliver, relayErrorResponse } from "@/lib/render-bridge";

/**
 * Delivery-enforcement (architecture: "nothing ships without approval"). Approval
 * (D5 step 4) was advisory; this makes it binding on delivery.
 *
 * GET /api/studio/template/[id]/deliver — the delivery record for the latest
 * approved cut: {delivered, mp4, deliveredAt, approvalMp4, score, current}.
 * `current` is false when a newer render exists (the delivered cut is stale).
 *
 * POST /api/studio/template/[id]/deliver — deliver the current APPROVED render.
 * The relay ENFORCES server-side: 403 if not approved, 403 if approval is stale
 * (a newer render — re-approve first). 404 if the template is unknown.
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
    return NextResponse.json(await getDelivery(id));
  } catch (e) {
    return relayErrorResponse(e);
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const template = await getStore().get(id);
  if (!template) {
    return NextResponse.json({ error: `template not found: ${id}` }, { status: 404 });
  }
  try {
    return NextResponse.json(await deliver(id));
  } catch (e) {
    // A 403 (not approved / stale) passes through — the editor surfaces the reason.
    return relayErrorResponse(e);
  }
}
