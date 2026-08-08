import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";
import { applyStructuralEdits, type StructuralEdit } from "@/lib/template-store/project";
import { stageComposition, relayErrorResponse } from "@/lib/render-bridge";

/**
 * POST /api/studio/template/[id]/apply-structural — apply a producer-ACCEPTED set
 * of structural edits (architecture D3/D4, brick 15). Re-runs the projection against
 * the current composition HTML (authoritative — not the propose-time snapshot),
 * persists the patched HTML to the template store (durable, like slot Save), AND
 * stages it to the relay (videos/<id>/index.html) so the verification gate renders
 * the PATCHED composition. The editor then runs the gate in raw mode.
 *
 * Body: { edits: StructuralEdit[] }. Best-effort: valid edits apply, unknown/slot-
 * bound targets are skipped + reported in `errors`. 200 → { ok, diff, errors }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const edits = (body as { edits?: unknown } | null)?.edits;
  if (!Array.isArray(edits) || edits.length === 0) {
    return NextResponse.json({ error: "Expected { edits: StructuralEdit[] }" }, { status: 400 });
  }

  const store = getStore();
  const html = await store.composition(id);
  if (!html) {
    return NextResponse.json({ error: `composition not found: ${id}` }, { status: 404 });
  }

  // Project the accepted edits onto the current composition HTML.
  const result = applyStructuralEdits(html, edits as StructuralEdit[]);
  if (result.diff.length === 0) {
    return NextResponse.json(
      { error: "no edits applied", errors: result.errors },
      { status: 422 },
    );
  }

  // Persist (durable) + stage (so the gate renders the patched composition).
  try {
    await store.saveComposition(id, result.html);
    await stageComposition(id, result.html);
  } catch (e) {
    return relayErrorResponse(e);
  }

  return NextResponse.json({ ok: true, diff: result.diff, errors: result.errors });
}
