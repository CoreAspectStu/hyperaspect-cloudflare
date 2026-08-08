import type { Slot } from "./types";

/**
 * Slot-value validation + coercion (architecture D4: "the LLM is constrained to
 * the template's slot/scene schema — it cannot invent fields"). Shared by the
 * deterministic save route (POST /values) and the LLM-proposal route (POST
 * /propose) so both enforce the same schema gate: only declared slots, values
 * coerced to their declared type. Unknown ids + bad types are rejected, never
 * silently stored — no invented fields can reach a composition.
 */

/** Coerce a raw value to the slot's type, throwing on a schema violation. */
export function coerceSlotValue(slot: Slot, raw: unknown): string | number {
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

export interface ValidationOk {
  ok: true;
  coerced: Record<string, string | number>;
}
export interface ValidationErr {
  ok: false;
  errors: string[];
  /** Partial result: the values that DID coerce, for callers that want best-effort. */
  coerced: Record<string, string | number>;
}

/**
 * Validate a `{ slotId: raw }` map against a slot schema. Every key must be a
 * declared slot; every value must coerce to its type. Returns `{ok, coerced}`
 * on full success or `{ok:false, errors, coerced}` (partial) otherwise. Nullish
 * values are dropped (treated as "no change"), matching the save route.
 */
export function validateSlotValues(
  slots: Slot[],
  incoming: Record<string, unknown>,
): ValidationOk | ValidationErr {
  const schema = new Map<string, Slot>(slots.map((s) => [s.id, s]));
  const coerced: Record<string, string | number> = {};
  const errors: string[] = [];

  for (const [key, raw] of Object.entries(incoming)) {
    const slot = schema.get(key);
    if (!slot) {
      errors.push(`unknown slot: ${key}`);
      continue;
    }
    if (raw == null) continue; // drop nulls
    try {
      coerced[key] = coerceSlotValue(slot, raw);
    } catch (e) {
      errors.push(`${key}: ${(e as Error).message}`);
    }
  }

  return errors.length ? { ok: false, errors, coerced } : { ok: true, coerced };
}
