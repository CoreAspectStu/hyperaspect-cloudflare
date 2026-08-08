import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";
import { enqueueRender, relayErrorResponse } from "@/lib/render-bridge";

/**
 * POST /api/studio/template/[id]/render — enqueue a render of this template via
 * the public render relay (the Worker's only bridge to the core-control render
 * farm; it has no tailnet access). The relay renders the staged composition at
 * ~/projects/hyperframes-video-creator/videos/<id>/ via hyperframes-render@<id>,
 * so the template MUST be pre-staged there (a core-control step, not a Worker one).
 *
 * `variables` (slot values) are forwarded but NOT yet applied by the render
 * ExecStart — the composition renders as-is. They are passed so the plumbing is
 * ready once the render consumes --variables-file (gated-diff, D5).
 *
 * Body (optional): { variables?: Record<string, unknown>, webhookUrl?: string }
 * `variables` defaults to the template's last-saved slotValues when omitted, so a
 * bare POST renders the current edit set.
 *
 * Returns 202 { jobId, status, videoName }; 409 if a job already exists for this
 * video; 502 if the relay is unreachable; 500 if RENDER_SECRET is unset.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const template = await getStore().get(id);
  if (!template) {
    return NextResponse.json({ error: `template not found: ${id}` }, { status: 404 });
  }

  // Body is optional — a bare POST renders with the saved slot values.
  let body: { variables?: Record<string, unknown>; webhookUrl?: string; raw?: boolean } | null = null;
  try {
    body = await req.json();
  } catch {
    // empty/non-JSON body → fall through to defaults below
  }

  const raw = body?.raw === true;
  // Raw mode (brick 15): the staged composition was patched in place — render it
  // as-is, no recompose, no variable forwarding.
  const variables = raw
    ? undefined
    : body?.variables ?? (template.slotValues && Object.keys(template.slotValues).length > 0
        ? (template.slotValues as Record<string, string | number>)
        : undefined);
  const webhookUrl = body?.webhookUrl;

  try {
    const job = await enqueueRender(id, {
      ...(variables ? { variables } : {}),
      ...(webhookUrl ? { webhookUrl } : {}),
      ...(raw ? { raw: true } : {}),
    });
    return NextResponse.json(job, { status: 202 });
  } catch (e) {
    return relayErrorResponse(e);
  }
}
