import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";
import type { Slot } from "@/lib/template-store/types";

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

  const slots = new Map<string, Slot>(template.slots.map((s) => [s.id, s]));
  const coerced: Record<string, string | number> = {};
  const errors: string[] = [];

  for (const [key, raw] of Object.entries(values)) {
    const slot = slots.get(key);
    if (!slot) {
      errors.push(`unknown slot: ${key}`);
      continue;
    }
    if (raw == null) continue; // drop nulls
    try {
      coerced[key] = coerce(slot, raw);
    } catch (e) {
      errors.push(`${key}: ${(e as Error).message}`);
    }
  }

  if (errors.length) {
    return NextResponse.json({ error: "validation failed", errors }, { status: 400 });
  }

  const merged = { ...(template.slotValues ?? {}), ...coerced };
  await getStore().saveValues(id, merged);
  return NextResponse.json({ ok: true, values: merged });
}

/** Coerce a raw value to the slot's type, throwing on a schema violation. */
function coerce(slot: Slot, raw: unknown): string | number {
  switch (slot.type) {
    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) throw new Error("not a number");
      return n;
    }
    case "color": {
      const s = String(raw).trim();
      if (!/^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/.test(s)) {
        throw new Error("not a hex color");
      }
      return s.startsWith("#") ? s : `#${s}`;
    }
    case "select": {
      const s = String(raw);
      if (!slot.options?.includes(s)) {
        throw new Error(`not one of ${JSON.stringify(slot.options ?? [])}`);
      }
      return s;
    }
    default:
      // text | media
      return String(raw);
  }
}
