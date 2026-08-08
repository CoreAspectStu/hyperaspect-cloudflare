import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";
import { validateSlotValues } from "@/lib/template-store/validate";

/**
 * POST /api/studio/template/[id]/values — persist deterministic slot-value edits (D4).
 * Slot/knob edits apply deterministically (no verification gate): validate against the
 * template's slot schema (known ids only, type-coerced — no invented fields) then save.
 * Merge over any already-persisted values so partial saves keep prior edits.
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
  const incoming = (body as { values?: unknown } | null)?.values;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return NextResponse.json({ error: "Expected { values: { ... } }" }, { status: 400 });
  }
  const values = incoming as Record<string, unknown>;

  const template = await getStore().get(id);
  if (!template) {
    return NextResponse.json({ error: `template not found: ${id}` }, { status: 404 });
  }

  const result = validateSlotValues(template.slots, values);
  if (!result.ok) {
    return NextResponse.json({ error: "validation failed", errors: result.errors }, { status: 400 });
  }

  const merged = { ...(template.slotValues ?? {}), ...result.coerced };
  await getStore().saveValues(id, merged);
  return NextResponse.json({ ok: true, values: merged });
}
