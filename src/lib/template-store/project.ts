/**
 * Structural-edit projection (architecture D3/D4 · the §8 spike).
 *
 * Where {@link ./derive.ts} reads scenes/tracks OUT of the composition HTML, this
 * module projects structured scene-object edits BACK INTO the HTML — the missing
 * half of "HTML is the single source; the LLM edits addressable scene objects that
 * project to/patch the HTML" (D3). It is the structural tier of D4 (brick 14 did
 * the slot tier): the LLM PROPOSES structural edits; this projection patches the
 * HTML; the result is staged + gated (brick 15).
 *
 * Scope (MVP spike): in-place patches to EXISTING scenes/tracks only — no DOM
 * insertion/deletion (reorder/add/remove is a later increment). Four ops, each
 * validated against the composition (target must exist; slot-bound `{{token}}`
 * text is never clobbered). Unknown targets are rejected, not applied — the LLM
 * cannot invent scenes/tracks.
 *
 * Runtime-agnostic: `node-html-parser` only (Workers `nodejs_compat` + Node dev),
 * same parser as derive.ts.
 */
import { parse, type HTMLElement } from "node-html-parser";

const MEDIA_TAGS = new Set(["video", "audio", "img", "source"]);
/** id is safe to splice into a `#id` selector (deal-01 ids are `s\d+-[\w-]`). */
const SAFE_ID = /^[A-Za-z][\w-]*$/;
/** An element whose entire text is a mustache token is slot-bound — don't clobber. */
const TOKEN_RE = /^\{\{[^}]+\}\}$/;

export type StructuralEdit =
  | { op: "sceneDuration"; sceneId: string; duration: number }
  | { op: "trackRef"; trackId: string; ref: string; sceneId?: string }
  | { op: "trackTiming"; trackId: string; start?: number; duration?: number; sceneId?: string }
  | { op: "text"; trackId: string; text: string; sceneId?: string };

export interface StructuralDiff {
  op: string;
  target: string; // human label, e.g. "scene s3" / "track s3-still"
  attr: string; // "data-duration" | "src" | "data-start" | "text"
  from: string;
  to: string;
}

export interface ProjectionResult {
  /** Patched HTML (best-effort: valid edits applied; rejected ones skipped). */
  html: string;
  /** One diff entry per successfully applied edit. */
  diff: StructuralDiff[];
  /** Per-edit validation errors (that edit was skipped). Empty on full success. */
  errors: string[];
}

function findById(root: HTMLElement, id: string): HTMLElement | null {
  if (!id || !SAFE_ID.test(id)) return null;
  return root.querySelector(`#${id}`);
}

function isScene(el: HTMLElement): boolean {
  return el.classList.contains("scene") && el.classList.contains("clip");
}

/** Escape literal text so node-html-parser's set_content embeds it verbatim. */
function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtNum(n: number): string {
  return Number.isFinite(n) ? String(n) : String(n);
}

/**
 * Apply structural edits to a composition HTML string. Edits are applied
 * independently; a failing edit is recorded in `errors` and skipped (the rest
 * still apply). Returns the patched HTML + a diff of what changed.
 */
export function applyStructuralEdits(html: string, edits: StructuralEdit[]): ProjectionResult {
  const root = parse(html);
  const diff: StructuralDiff[] = [];
  const errors: string[] = [];

  for (const edit of edits) {
    switch (edit.op) {
      case "sceneDuration": {
        const sc = findById(root, edit.sceneId);
        if (!sc || !isScene(sc)) {
          errors.push(`sceneDuration: unknown scene "${edit.sceneId}"`);
          break;
        }
        const from = sc.attributes["data-duration"] ?? "";
        sc.setAttribute("data-duration", fmtNum(edit.duration));
        diff.push({ op: edit.op, target: `scene ${edit.sceneId}`, attr: "data-duration", from, to: fmtNum(edit.duration) });
        break;
      }

      case "trackRef": {
        const el = findById(root, edit.trackId);
        if (!el) {
          errors.push(`trackRef: unknown track "${edit.trackId}"`);
          break;
        }
        if (!MEDIA_TAGS.has(el.tagName.toLowerCase())) {
          errors.push(`trackRef: "${edit.trackId}" is not a media element`);
          break;
        }
        const from = el.attributes.src ?? "";
        el.setAttribute("src", edit.ref);
        diff.push({ op: edit.op, target: `track ${edit.trackId}`, attr: "src", from, to: edit.ref });
        break;
      }

      case "trackTiming": {
        const el = findById(root, edit.trackId);
        if (!el) {
          errors.push(`trackTiming: unknown track "${edit.trackId}"`);
          break;
        }
        if (typeof edit.start === "number") {
          const from = el.attributes["data-start"] ?? "";
          el.setAttribute("data-start", fmtNum(edit.start));
          diff.push({ op: edit.op, target: `track ${edit.trackId}`, attr: "data-start", from, to: fmtNum(edit.start) });
        }
        if (typeof edit.duration === "number") {
          const from = el.attributes["data-duration"] ?? "";
          el.setAttribute("data-duration", fmtNum(edit.duration));
          diff.push({ op: edit.op, target: `track ${edit.trackId}`, attr: "data-duration", from, to: fmtNum(edit.duration) });
        }
        if (typeof edit.start !== "number" && typeof edit.duration !== "number") {
          errors.push(`trackTiming: "${edit.trackId}" needs start or duration`);
        }
        break;
      }

      case "text": {
        const el = findById(root, edit.trackId);
        if (!el) {
          errors.push(`text: unknown track "${edit.trackId}"`);
          break;
        }
        const cur = (el.text ?? "").trim();
        if (TOKEN_RE.test(cur)) {
          // Slot-bound (brick 7 mustache binding) — a structural text edit must
          // not clobber it. Route through slot edits instead.
          errors.push(`text: "${edit.trackId}" is slot-bound (${cur}) — edit via slots`);
          break;
        }
        const from = cur;
        el.set_content(escapeText(edit.text));
        diff.push({ op: edit.op, target: `track ${edit.trackId}`, attr: "text", from, to: edit.text });
        break;
      }

      default:
        errors.push(`unknown op: ${(edit as { op?: string }).op ?? "(none)"}`);
    }
  }

  return { html: root.toString(), diff, errors };
}
