/**
 * Slot-ification for generated compositions (architecture D3).
 *
 * Generated videos (the relay's `composeManifest`) mark their editable text with
 * CLASSES — `.hd`, `.sub`, `.cta`, `.stat-v`, `.stat-l`, `.company` — inside
 * `#scene-N .cw`. That convention is invisible to {@link ./derive.ts}, which only
 * treats `s\d+-`-id'd elements as text tracks (deal-01's hand-authored convention).
 * So a freshly-registered generated video derives its scenes but exposes NO slots,
 * and the editor's Slots tab stays empty.
 *
 * `slotifyComposition` declares one text slot per editable text element and
 * rewrites the element's text to a `{{slotId}}` mustache token. Storing that
 * tokenized HTML as the composition makes the Slots tab + live preview work with
 * zero relay dependency: the preview route already recomposes the stored
 * composition's `{{token}}`s against slot defaults/values (see
 * `src/app/api/studio/template/[id]/preview/[...path]/route.ts`).
 *
 * Runtime-agnostic: `node-html-parser` only (Workers `nodejs_compat` + Node dev),
 * same parser as derive.ts / project.ts.
 */
import { parse } from "node-html-parser";
import type { Slot } from "./types";

/**
 * The text-surface classes emitted by the relay's `composeManifest`. A leaf
 * element carrying one of these becomes an editable text slot. Verified identical
 * across the generated comps `ha-c5abbf2f`, `ha-083b3d4d`, `ha-b1fa74cc`.
 */
const TEXT_CLASSES = ["hd", "sub", "cta", "stat-v", "stat-l", "company"] as const;

/** Human label for a text class (slot labels read as "Scene 1 · Headline"). */
const CLASS_LABEL: Record<string, string> = {
  hd: "Headline",
  sub: "Subtext",
  cta: "Call to action",
  "stat-v": "Stat value",
  "stat-l": "Stat label",
  company: "Company",
};

/** An element whose entire text is already a mustache token is slot-bound. */
const TOKEN_RE = /^\{\{[^}]+\}\}$/;

/** Coerce a scene/element id into a mustache-safe slot-id segment (alnum + _). */
function safeKey(id: string): string {
  return id.replace(/[^A-Za-z0-9]/g, "_");
}

export interface SlotifyResult {
  /** Declared slots, in scene then document order. */
  slots: Slot[];
  /** The composition HTML with each slotted element's text replaced by `{{slotId}}`. */
  tokenizedHtml: string;
}

/**
 * Declare per-scene text slots for a composition and tokenize the editable text.
 *
 * For each `.scene.clip` wrapper (in document order), each LEAF element (no
 * element children) carrying a {@link TEXT_CLASSES} class becomes a slot — its
 * text is replaced with `{{slotId}}`. Empty text elements (e.g. an unfilled
 * `.cta`) are included so a producer can populate them.
 *
 * Idempotent: an element already holding a single `{{token}}` is left as-is and
 * emits no new slot, so re-running on an already-tokenized composition is a no-op.
 * Returns `{ slots: [], tokenizedHtml: <unchanged> }` for markup without text
 * classes (e.g. a hand-authored `s\d+-` composition, which owns its own slots).
 */
export function slotifyComposition(html: string): SlotifyResult {
  const root = parse(html);
  const slots: Slot[] = [];
  const seen = new Set<string>();

  const scenes = root.querySelectorAll(".scene.clip");
  scenes.forEach((scene, i) => {
    const sceneKey = safeKey(scene.id || `scene-${i + 1}`);
    const index = i + 1;
    // Leaves = elements with no element children. querySelectorAll("*") on an
    // element matches descendants only, so length 0 ⇒ leaf.
    for (const el of scene.querySelectorAll("*")) {
      if (el.querySelectorAll("*").length > 0) continue; // not a leaf
      const cls = TEXT_CLASSES.find((c) => el.classList.contains(c));
      if (!cls) continue;

      const text = (el.text ?? "").trim();
      if (TOKEN_RE.test(text)) continue; // already slot-bound — don't double-wrap

      // Sanitize the class too (stat-v → stat_v): underscores are mustache-safe
      // across both the app's resolveSlots regex and the relay's mustache.
      const slotId = `${sceneKey}_${safeKey(cls)}`;
      if (seen.has(slotId)) continue; // dedupe (shouldn't happen within one scene)
      seen.add(slotId);

      slots.push({
        id: slotId,
        type: "text",
        label: `Scene ${index} · ${CLASS_LABEL[cls] ?? cls}`,
        default: text,
      });
      // `{{slotId}}` is alnum + underscores + braces — no HTML-special chars, so
      // set_content needs no escaping (matches project.ts' text handling).
      el.set_content(`{{${slotId}}}`);
    }
  });

  return { slots, tokenizedHtml: root.toString() };
}
