/**
 * Template store — how the platform reads templates + compositions.
 *
 * Two adapters behind one {@link TemplateStore} interface (architecture D1):
 *  - `FsTemplateStore` — dev (`next dev`, Node) reads a local `templates/` dir.
 *  - `R2TemplateStore` — prod (Workers) reads Cloudflare R2.
 * `getStore()` picks per runtime: R2 when the Workers binding is present (via
 * `getRequestContext()`), else the filesystem. Scenes are DERIVED from the
 * composition HTML (D3) in both, via the shared `applyComposition()` helper.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Template, TemplateSummary } from "./types";
import { deriveScenes, deriveMeta } from "./derive";

export interface TemplateStore {
  list(): Promise<TemplateSummary[]>;
  get(id: string): Promise<Template | null>;
  /** Read the composition HTML (the render target). */
  composition(id: string): Promise<string | null>;
  /** Resolve the compositionPath (default "index.html") without a full get(). */
  compositionPath(id: string): Promise<string>;
  /**
   * Read an arbitrary asset file (e.g. `assets/foo.png`) as bytes, or null if
   * absent. Used to serve template assets to the in-browser scene preview.
   * `rel` is relative to the template dir and must not escape it.
   */
  readFile(id: string, rel: string): Promise<Uint8Array | null>;
  /**
   * Write an arbitrary file (e.g. `assets/foo.png`, `template.json`) relative to
   * the template dir. Used by the generated-video register path to materialize a
   * template (composition + assets + sidecar). Creates parent dirs as needed.
   */
  writeFile(id: string, rel: string, body: string | ArrayBuffer): Promise<void>;
  /**
   * Persist deterministic slot-value edits (D4). Stored as a per-template
   * `values.json` overlay until the Video model lands.
   */
  saveValues(id: string, values: Record<string, string | number>): Promise<void>;
  /**
   * Persist a structural composition edit (D3/D4) — overwrite the composition
   * HTML at its compositionPath. Used by the projection's apply path (brick 15).
   */
  saveComposition(id: string, html: string): Promise<void>;
}

/** Object prefix: `templates/{id}/template.json`, `templates/{id}/{compositionPath}`. */
const R2_PREFIX = "templates/";

/**
 * Apply D3 scene-derivation to a loaded template: prefer scenes DERIVED from the
 * composition HTML (single source), keep the sidecar-declared `scenes` only as a
 * fallback; fill aspect/durationSec from the composition root when unset. Shared by
 * both stores so derivation stays identical across dev and prod.
 */
function applyComposition(t: Template, html: string | null): void {
  if (!html) return;
  const derived = deriveScenes(html);
  if (derived.length) t.scenes = derived;
  const meta = deriveMeta(html);
  if (meta) {
    if (!t.aspect && meta.width != null && meta.height != null) {
      t.aspect = { width: meta.width, height: meta.height };
    }
    if (t.durationSec == null && meta.duration != null) {
      t.durationSec = meta.duration;
    }
  }
}

/** Parse a `values.json` overlay (if any) onto the template's `slotValues`. */
function applyValues(t: Template, json: string | null): void {
  if (!json) return;
  try {
    const parsed = JSON.parse(json) as Record<string, string | number>;
    if (parsed && typeof parsed === "object") t.slotValues = parsed;
  } catch {
    // malformed values.json — ignore, fall back to slot defaults
  }
}

/* ── Structural R2 types (dep-free; the real Workers R2 bucket matches this) ── */
interface R2ObjectBodyLike {
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}
interface R2ObjectsLike {
  objects: { key: string }[];
  delimitedPrefixes: string[];
  truncated: boolean;
  cursor?: string;
}
interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  list(opts?: {
    prefix?: string;
    delimiter?: string;
    cursor?: string;
    limit?: number;
  }): Promise<R2ObjectsLike>;
  put(key: string, body: string | ArrayBuffer | ReadableStream): Promise<unknown>;
}

// --- Filesystem (dev) adapter -------------------------------------------------
// node:fs is dev-only. Under nodejs_compat the import resolves in the Workers
// bundle too, but FsTemplateStore is never instantiated there (getStore() returns
// the R2 store), so these never run in prod.
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

const TEMPLATES_DIR =
  process.env.TEMPLATES_DIR ?? join(process.cwd(), "templates");

export class FsTemplateStore implements TemplateStore {
  constructor(private dir: string = TEMPLATES_DIR) {}

  async list(): Promise<TemplateSummary[]> {
    let entries: string[] = [];
    try {
      entries = await readdir(this.dir);
    } catch {
      return []; // no templates dir yet → empty library
    }
    const out: TemplateSummary[] = [];
    for (const id of entries) {
      try {
        await stat(join(this.dir, id, "template.json"));
      } catch {
        continue;
      }
      const t = JSON.parse(
        await readFile(join(this.dir, id, "template.json"), "utf8"),
      ) as Partial<Template>;
      out.push({ id, family: t.family ?? "unknown", name: t.name ?? id });
    }
    return out;
  }

  async get(id: string): Promise<Template | null> {
    let raw: string;
    try {
      raw = await readFile(join(this.dir, id, "template.json"), "utf8");
    } catch {
      return null;
    }
    const t = JSON.parse(raw) as Template;
    t.id = id;
    t.compositionPath = t.compositionPath ?? "index.html";
    applyComposition(t, await this.composition(id));
    try {
      applyValues(t, await readFile(join(this.dir, id, "values.json"), "utf8"));
    } catch {
      // no values.json yet — slot defaults stand
    }
    return t;
  }

  async composition(id: string): Promise<string | null> {
    let rel = "index.html";
    try {
      const raw = await readFile(join(this.dir, id, "template.json"), "utf8");
      rel = (JSON.parse(raw) as Partial<Template>).compositionPath ?? "index.html";
    } catch {
      // no template.json — assume default
    }
    try {
      return await readFile(join(this.dir, id, rel), "utf8");
    } catch {
      return null;
    }
  }

  async compositionPath(id: string): Promise<string> {
    try {
      const raw = await readFile(join(this.dir, id, "template.json"), "utf8");
      return (JSON.parse(raw) as Partial<Template>).compositionPath ?? "index.html";
    } catch {
      return "index.html";
    }
  }

  async readFile(id: string, rel: string): Promise<Uint8Array | null> {
    try {
      const buf = await readFile(join(this.dir, id, rel));
      // Node Buffer → Uint8Array view (no copy).
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
      return null;
    }
  }

  async writeFile(id: string, rel: string, body: string | ArrayBuffer): Promise<void> {
    const abs = join(this.dir, id, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, typeof body === "string" ? body : Buffer.from(body));
  }

  async saveValues(id: string, values: Record<string, string | number>): Promise<void> {
    await writeFile(join(this.dir, id, "values.json"), JSON.stringify(values, null, 2), "utf8");
  }

  async saveComposition(id: string, html: string): Promise<void> {
    let rel = "index.html";
    try {
      const raw = await readFile(join(this.dir, id, "template.json"), "utf8");
      rel = (JSON.parse(raw) as Partial<Template>).compositionPath ?? "index.html";
    } catch {
      // no template.json — default index.html
    }
    await writeFile(join(this.dir, id, rel), html, "utf8");
  }
}

// --- R2 (prod) adapter --------------------------------------------------------
/** Cloudflare R2-backed store. Object layout mirrors the dev dir: `templates/{id}/…`. */
export class R2TemplateStore implements TemplateStore {
  constructor(private bucket: R2BucketLike) {}

  async list(): Promise<TemplateSummary[]> {
    const out: TemplateSummary[] = [];
    let cursor: string | undefined;
    do {
      const res = await this.bucket.list({
        prefix: R2_PREFIX,
        delimiter: "/",
        cursor,
        limit: 100,
      });
      for (const prefix of res.delimitedPrefixes) {
        const id = prefix.slice(R2_PREFIX.length).replace(/\/$/, "");
        if (!id) continue;
        const body = await this.bucket.get(`${prefix}template.json`);
        if (!body) continue;
        const t = JSON.parse(await body.text()) as Partial<Template>;
        out.push({ id, family: t.family ?? "unknown", name: t.name ?? id });
      }
      cursor = res.truncated ? res.cursor : undefined;
    } while (cursor);
    return out;
  }

  async get(id: string): Promise<Template | null> {
    const body = await this.bucket.get(`${R2_PREFIX}${id}/template.json`);
    if (!body) return null;
    const t = JSON.parse(await body.text()) as Template;
    t.id = id;
    t.compositionPath = t.compositionPath ?? "index.html";
    applyComposition(t, await this.composition(id));
    const vbody = await this.bucket.get(`${R2_PREFIX}${id}/values.json`);
    applyValues(t, vbody ? await vbody.text() : null);
    return t;
  }

  async composition(id: string): Promise<string | null> {
    const rel = await this.compositionPath(id);
    const body = await this.bucket.get(`${R2_PREFIX}${id}/${rel}`);
    return body ? await body.text() : null;
  }

  async readFile(id: string, rel: string): Promise<Uint8Array | null> {
    const body = await this.bucket.get(`${R2_PREFIX}${id}/${rel}`);
    if (!body) return null;
    return new Uint8Array(await body.arrayBuffer());
  }

  async writeFile(id: string, rel: string, body: string | ArrayBuffer): Promise<void> {
    await this.bucket.put(`${R2_PREFIX}${id}/${rel}`, body);
  }

  /** Read compositionPath from the sidecar (default "index.html") without a full get(). */
  async compositionPath(id: string): Promise<string> {
    const body = await this.bucket.get(`${R2_PREFIX}${id}/template.json`);
    if (!body) return "index.html";
    try {
      return (
        (JSON.parse(await body.text()) as Partial<Template>).compositionPath ??
        "index.html"
      );
    } catch {
      return "index.html";
    }
  }

  async saveValues(id: string, values: Record<string, string | number>): Promise<void> {
    await this.bucket.put(`${R2_PREFIX}${id}/values.json`, JSON.stringify(values, null, 2));
  }

  async saveComposition(id: string, html: string): Promise<void> {
    const rel = await this.compositionPath(id);
    await this.bucket.put(`${R2_PREFIX}${id}/${rel}`, html);
  }
}

/**
 * Resolve the active store by runtime. In Workers (OpenNext) the R2 binding is
 * reachable via getRequestContext(); in `next dev` (Node) there is no request
 * context → fall back to the filesystem. Set DEV_STORE=fs to force the filesystem
 * store even under Workers.
 */
export function getStore(): TemplateStore {
  if (process.env.DEV_STORE !== "fs") {
    const bucket = r2Bucket();
    if (bucket) return new R2TemplateStore(bucket);
  }
  return new FsTemplateStore();
}

/** Pull the R2 binding from the Cloudflare context, or null if not on Workers. */
function r2Bucket(): R2BucketLike | null {
  try {
    const env = getCloudflareContext().env as unknown as {
      TEMPLATES?: R2BucketLike;
    };
    return env.TEMPLATES ?? null;
  } catch {
    return null; // next dev (Node) — no Cloudflare context
  }
}
