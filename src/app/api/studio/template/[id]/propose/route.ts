import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";
import { validateSlotValues } from "@/lib/template-store/validate";
import { proposeSlotEdits, type ProposedChange } from "@/lib/llm-client";
import { relayErrorResponse } from "@/lib/render-bridge";

/**
 * POST /api/studio/template/[id]/propose — the gated-diff's caller (architecture D4).
 * An LLM PROPOSES slot-value edits from a free-form producer prompt. Proposals are
 * constrained to the template's declared slot schema (no invented fields) and
 * returned as a diff for the producer to review — this route NEVER persists. The
 * producer's Accept (in the editor) applies + persists + runs the verification gate.
 *
 * Body: { prompt: string }. 200 → { changes:[{slotId,label,type,from,to,reason}], rejected:[{slotId,reason}], summary }.
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

  const template = await getStore().get(id);
  if (!template) {
    return NextResponse.json({ error: `template not found: ${id}` }, { status: 404 });
  }

  // Ask the LLM (via the relay chat proxy) for a raw proposal.
  let proposal;
  try {
    proposal = await proposeSlotEdits({
      prompt,
      slots: template.slots,
      slotValues: template.slotValues,
      scenes: template.scenes,
    });
  } catch (e) {
    return relayErrorResponse(e);
  }

  if (proposal.changes.length === 0) {
    return NextResponse.json({
      changes: [],
      rejected: [],
      summary: proposal.summary || "No slot edits proposed.",
    });
  }

  // Enforce D4 server-side: validate every proposed change against the schema.
  // Unknown slots / wrong types are rejected here, not applied. (The LLM cannot
  // invent fields even if it tries.)
  const incoming: Record<string, unknown> = {};
  const reasonById = new Map<string, string>();
  for (const c of proposal.changes) {
    // First mention wins if the LLM duplicates a slot.
    if (!(c.slotId in incoming)) {
      incoming[c.slotId] = c.value;
      reasonById.set(c.slotId, c.reason);
    }
  }
  const result = validateSlotValues(template.slots, incoming);

  const slotMap = new Map(template.slots.map((s) => [s.id, s]));
  const changes = Object.entries(result.coerced).map(([slotId, to]) => {
    const slot = slotMap.get(slotId);
    const from = template.slotValues?.[slotId] ?? slot?.default ?? "";
    return {
      slotId,
      label: slot?.label ?? slotId,
      type: slot?.type ?? "text",
      from,
      to,
      reason: reasonById.get(slotId) ?? "",
    };
  });

  const rejected = (result.ok ? [] : result.errors).map((err) => {
    // errors look like "unknown slot: X" or "X: not a number"
    const m = err.match(/^(?:unknown slot: )?([^:]+):?\s/);
    const slotId = m?.[1] ?? err;
    return { slotId, reason: err };
  });

  return NextResponse.json({
    changes,
    rejected,
    summary: proposal.summary,
  });
}

// ProposedChange is re-exported for type parity tests; keep the import live.
export type { ProposedChange };
