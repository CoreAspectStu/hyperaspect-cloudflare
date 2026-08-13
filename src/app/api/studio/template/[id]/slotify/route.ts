import { NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";
import { stageBinding } from "@/lib/render-bridge";
import { slotifyComposition } from "@/lib/template-store/slotify";
import type { Slot } from "@/lib/template-store/types";

/**
 * POST /api/studio/template/[id]/slotify — declare per-scene text slots for an
 * existing template + tokenize its composition text into `{{slotId}}` mustache
 * tokens, so the editor's Slots tab + live preview work (the preview route
 * recomposes the stored composition's tokens against slot defaults/values).
 *
 * Used to backfill generated videos registered before slot-ification, and as a
 * re-run/debug handle. App-only (operates on the store) → identical in dev + prod.
 *
 * Re-run safety: if the composition is already tokenized (slotify finds no fresh
 * text), the existing sidecar `slots` are preserved and the HTML is left as-is.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();

  const html = await store.composition(id);
  if (html == null) {
    return NextResponse.json({ error: `composition not found: ${id}` }, { status: 404 });
  }

  const sidecarBytes = await store.readFile(id, "template.json");
  if (sidecarBytes == null) {
    return NextResponse.json({ error: `template not found: ${id}` }, { status: 404 });
  }

  let sidecar: Record<string, unknown>;
  try {
    sidecar = JSON.parse(new TextDecoder().decode(sidecarBytes));
  } catch {
    return NextResponse.json({ error: `template.json is not valid JSON: ${id}` }, { status: 500 });
  }

  const priorSlots: Slot[] = Array.isArray(sidecar.slots) ? (sidecar.slots as Slot[]) : [];

  let result;
  try {
    result = slotifyComposition(html);
  } catch (e) {
    return NextResponse.json({ error: `slot-ify failed: ${(e as Error).message}` }, { status: 500 });
  }

  // Fresh slots win (composition text → real defaults); if the composition is
  // already tokenized (no fresh text found), keep the existing sidecar slots.
  const slots: Slot[] = result.slots.length ? result.slots : priorSlots;
  sidecar.slots = slots;

  await store.saveComposition(id, result.tokenizedHtml);
  await store.writeFile(id, "template.json", JSON.stringify(sidecar, null, 2));

  // Best-effort: establish mustache render-binding on the farm so a Run-Gate render
  // reflects slot edits (backfills generated videos registered before this). The
  // tokenized source just saved IS the mustache source; the slot defaults are the
  // manifest variable defaults. Non-fatal — preview works without it.
  if (slots.length) {
    try {
      await stageBinding(id, { tokenizedHtml: result.tokenizedHtml, slots });
    } catch {
      /* relay unreachable — binding retried on the next slotify/register */
    }
  }

  return NextResponse.json({ ok: true, id, slots: slots.length });
}
