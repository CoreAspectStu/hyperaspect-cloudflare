/**
 * Composition + asset server for the in-browser scene preview (A0).
 *
 * The preview loads the composition HTML into a same-origin iframe so it can
 * drive the GSAP timeline (`window.__timelines`). Two cases:
 *  1. The path IS the composition document (e.g. `index.html`) → return the
 *     composition HTML with `{{slot}}` tokens resolved against the template's
 *     current `slotValues` (so slot edits show without a render round-trip).
 *  2. Anything else (e.g. `assets/map.png`, `assets/bgm/a.mp3`) → stream the raw
 *     asset bytes with the right MIME, so the iframe's relative `assets/…`
 *     references resolve naturally under this catch-all.
 *
 * Same-origin (served from the Worker itself) is what lets the iframe reach into
 * `contentWindow.__timelines`; a cross-origin src would block it.
 */
import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";
import { getTemplateHtml } from "@/lib/render-bridge";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".pdf": "application/pdf",
};

function mimeFor(rel: string): string {
  const i = rel.lastIndexOf(".");
  if (i < 0) return "application/octet-stream";
  return MIME[rel.slice(i).toLowerCase()] ?? "application/octet-stream";
}

/** Replace `{{ slot }}` tokens with their current values (preview-only). */
function resolveSlots(html: string, values: Record<string, string | number>): string {
  if (!html.includes("{{")) return html;
  return html.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key: string) => {
    const v = values[key];
    return v == null ? "" : String(v);
  });
}

/** Reject any relative path that tries to escape the template dir. */
function sanitizeRawPath(segments: string[]): string | null {
  const decoded = segments.map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const rel = decoded.join("/");
  if (rel === "" || rel.startsWith("/") || rel.includes("\\") || /(^|\/)\.\.(\/|$)/.test(rel)) {
    return null;
  }
  return rel;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; path: string[] }> }) {
  const { id, path } = await ctx.params;
  const rel = sanitizeRawPath(path);
  if (rel == null) {
    return new NextResponse("Not found", { status: 404 });
  }

  const store = getStore();

  // Case 1: the composition document → recomposed HTML.
  const compPath = await store.compositionPath(id);
  if (rel === compPath) {
    const tpl = await store.get(id);
    // Merge slot DEFAULTS with the values.json overlay: store.get() returns the
    // raw overlay (which may omit slots), but a missing bare-numeric token like
    // `site:{{site_area}}` resolves to `site:` and throws a JS SyntaxError that
    // kills the composition's timeline script. Defaults fill every slot.
    const values: Record<string, string | number> = {};
    for (const s of tpl?.slots ?? []) values[s.id] = s.default ?? "";
    Object.assign(values, tpl?.slotValues ?? {});
    // Prefer the mustache SOURCE recomposed with the current slot values, so
    // slot edits show in the preview WITHOUT a render (the stored composition
    // is a pre-resolved baseline with no {{}} tokens). Falls back to the stored
    // composition when the relay is down or the template is unbound.
    let html: string | null = null;
    try {
      const src = await getTemplateHtml(id);
      if (src) html = resolveSlots(src, values);
    } catch {
      // relay unreachable — fall through to the stored composition
    }
    if (html == null) html = resolveSlots((await store.composition(id)) ?? "", values);
    if (!html) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Never cache the live composition — it changes with every edit.
        "Cache-Control": "no-store",
      },
    });
  }

  // Case 2: a static asset → raw bytes. Copy into a concrete ArrayBuffer: the
  // Uint8Array view itself is a rejected BodyInit under TS 5.7+'s generic
  // Uint8Array<ArrayBufferLike> (DOM-lib mismatch), but ArrayBuffer is fine.
  const bytes = await store.readFile(id, rel);
  if (bytes == null) return new NextResponse("Not found", { status: 404 });
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new NextResponse(ab, {
    status: 200,
    headers: {
      "Content-Type": mimeFor(rel),
      "Cache-Control": "public, max-age=300, immutable",
    },
  });
}
