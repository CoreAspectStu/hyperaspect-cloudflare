import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";
import { proposeStructuralEdits } from "@/lib/llm-client";
import { applyStructuralEdits, type StructuralDiff } from "@/lib/template-store/project";
import { relayErrorResponse } from "@/lib/render-bridge";

/**
 * POST /api/studio/template/[id]/propose-structural — the gated-diff's STRUCTURAL
 * caller (architecture D3/D4, brick 15). An LLM PROPOSES scene-structural edits
 * (resize/retime/swap-asset/structural-text) from a free-form prompt, constrained
 * to the derived scene/track model. The proposal is run through the projection as a
 * DRY-RUN so the response is a concrete diff (attr/text old→new) for review — this
 * route NEVER persists or stages. The producer's Accept hits /apply-structural.
 *
 * Body: { prompt: string }.
 * 200 → { edits, diff, rejected, summary }. `edits` are the validated StructuralEdit[]
 *       the editor sends back on accept; `diff` is what the producer reviews.
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
  const prompt = (body as { prompt?: unknown } | null)?.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "Expected { prompt: string }" }, { status: 400 });
  }

  const store = getStore();
  const template = await store.get(id);
  if (!template) {
    return NextResponse.json({ error: `template not found: ${id}` }, { status: 404 });
  }

  // Ask GLM for structural edits (constrained to the scene/track model).
  let proposed;
  try {
    proposed = await proposeStructuralEdits({ prompt, scenes: template.scenes });
  } catch (e) {
    return relayErrorResponse(e);
  }

  if (proposed.edits.length === 0) {
    return NextResponse.json({
      edits: [],
      diff: [],
      rejected: [],
      summary: proposed.summary || "No structural edits proposed.",
    });
  }

  // Dry-run the projection against the real composition HTML: valid edits land in
  // `diff`, unknown/slot-bound targets land in `rejected`. The route never persists.
  const html = await store.composition(id);
  if (!html) {
    return NextResponse.json({ error: "composition HTML not found" }, { status: 404 });
  }
  const result = applyStructuralEdits(html, proposed.edits);

  return NextResponse.json({
    edits: result.diff.length ? proposed.edits : [],
    diff: result.diff as StructuralDiff[],
    rejected: result.errors,
    summary: proposed.summary,
  });
}
