import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * POST /api/studio/register — bridge a freshly-generated video into the template
 * store so it can be opened + edited in the studio editor.
 *
 * The generate flow writes the composition to the RENDER FARM
 * (`~/projects/hyperframes-video-creator/videos/<videoName>/index.html` + assets),
 * but the editor reads from the TEMPLATE STORE (`templates/<id>/`). This route
 * copies the farm composition + assets into `templates/<videoName>/` and writes a
 * minimal `template.json`. Scenes/aspect/duration are NOT synthesized here — the
 * store derives them from the HTML via `deriveScenes` at read time.
 *
 * Dev-only for now (Node filesystem access). On Workers (prod) the farm FS is
 * unreachable → 501; prod needs the relay to expose the composition + assets for
 * pull-into-R2 (documented follow-up).
 */
const TEMPLATES_DIR = process.env.TEMPLATES_DIR ?? join(process.cwd(), "templates");
const FARM_VIDEOS =
  process.env.HF_VIDEOS_DIR ??
  join(process.env.HOME ?? "/home/stu", "projects/hyperframes-video-creator/videos");

/** A safe video/template id: no path traversal, no slashes. */
function isSafeName(name: string): boolean {
  return !!name && !name.includes("/") && !name.includes("\\") && !name.includes("..") && /^[A-Za-z0-9._-]+$/.test(name);
}

async function copyFile(src: string, dest: string): Promise<void> {
  await writeFile(dest, await readFile(src));
}

/** Recursive directory copy using only node:fs ops the store already uses. */
async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await copyFile(s, d);
  }
}

export async function POST(req: NextRequest) {
  let body: { videoName?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const videoName = (body.videoName || "").trim();
  if (!isSafeName(videoName)) {
    return NextResponse.json({ error: "invalid or missing videoName" }, { status: 400 });
  }

  // Prod (Workers) can't reach the farm filesystem — dev-only for now.
  try {
    getCloudflareContext();
    return NextResponse.json(
      { error: "registration requires the farm filesystem (dev); prod relay-pull not yet implemented" },
      { status: 501 },
    );
  } catch {
    // not on Workers — proceed
  }

  const farmDir = join(FARM_VIDEOS, videoName);
  const farmHtml = join(farmDir, "index.html");
  try {
    await stat(farmHtml);
  } catch {
    return NextResponse.json({ error: `farm composition not found for "${videoName}"` }, { status: 404 });
  }

  const tplDir = join(TEMPLATES_DIR, videoName);

  // Don't clobber a hand-built (non-generated) template.
  try {
    const existing = JSON.parse(await readFile(join(tplDir, "template.json"), "utf8"));
    if (existing?.family && existing.family !== "generated") {
      return NextResponse.json({ id: videoName, ok: true, skipped: true, reason: "existing non-generated template" });
    }
  } catch {
    // no existing sidecar — proceed
  }

  try {
    await mkdir(tplDir, { recursive: true });
    await copyFile(farmHtml, join(tplDir, "index.html"));
    try {
      await copyDir(join(farmDir, "assets"), join(tplDir, "assets"));
    } catch {
      // no assets dir — fine
    }
    const sidecar = {
      family: "generated",
      name: (body.title || videoName).slice(0, 80),
      compositionPath: "index.html",
      slots: [],
    };
    await writeFile(join(tplDir, "template.json"), JSON.stringify(sidecar, null, 2), "utf8");
  } catch (e) {
    return NextResponse.json({ error: `registration failed: ${(e as Error).message}` }, { status: 500 });
  }

  return NextResponse.json({ id: videoName, ok: true });
}
