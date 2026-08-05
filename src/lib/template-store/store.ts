/**
 * Template store — how the platform reads/writes templates + compositions.
 *
 * DEV adapter: FsTemplateStore (reads a local `templates/` dir). Only works under
 * `next dev` (Node); Workers have no node:fs.
 * PROD adapter (next brick): R2TemplateStore (Cloudflare R2). Same interface.
 *
 * The store is chosen by environment so the route code never branches on it.
 */
import type { Template, TemplateSummary } from "./types";

export interface TemplateStore {
  list(): Promise<TemplateSummary[]>;
  get(id: string): Promise<Template | null>;
  /** Read the composition HTML (the render target). */
  composition(id: string): Promise<string | null>;
}

// --- Filesystem (dev) adapter -------------------------------------------------
// node:fs is dev-only; keep the import lazy-isolated so a production (Workers)
// build can tree-shake this adapter once R2TemplateStore lands.
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

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
    return t;
  }

  async composition(id: string): Promise<string | null> {
    const t = await this.get(id);
    const rel = t?.compositionPath ?? "index.html";
    try {
      return await readFile(join(this.dir, id, rel), "utf8");
    } catch {
      return null;
    }
  }
}

// --- R2 (prod) adapter — next brick ------------------------------------------
// class R2TemplateStore implements TemplateStore { … env.BUCKETS.TEMPLATES … }

/**
 * Resolve the active store. DEV uses the filesystem; PROD (Workers) will use R2.
 * For now PROD throws explicitly so it can't silently fall back to a node:fs call
 * that would fail on the Workers runtime.
 */
export function getStore(): TemplateStore {
  if (process.env.DEV_STORE === "r2") {
    throw new Error("R2TemplateStore not implemented yet (brick 2).");
  }
  return new FsTemplateStore();
}
