import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";
import { getCheckReport, relayErrorResponse } from "@/lib/render-bridge";

/**
 * GET /api/studio/template/[id]/check — structural lint gate (D5 step 1).
 * Runs `hyperframes lint --json` on the staged composition via the render relay
 * (the Worker has no hyperframes/tailnet access). Returns the lint report:
 * { ok, errorCount, warningCount, infoCount, findings[] }. `ok` (0 errors) is the
 * pass verdict; warnings/info are advisory. 404 if the template is unknown or the
 * composition isn't staged on the relay host.
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
    const report = await getCheckReport(id);
    return NextResponse.json(report);
  } catch (e) {
    return relayErrorResponse(e);
  }
}
