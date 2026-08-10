import { NextRequest, NextResponse } from "next/server";
import { getRenderStatus, relayErrorResponse, RelayError, type RenderStatus } from "@/lib/render-bridge";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

// Farm render-output dir (dev only — the Worker can't reach the filesystem in
// prod, where this probe no-ops and the relay status stands on its own).
const FARM_VIDEOS =
  process.env.RENDER_VIDEOS_DIR ??
  join(process.env.HOME ?? "/home/stu", "projects/hyperframes-video-creator/videos");

/**
 * Output-based completion probe. The render farm writes the mp4 to
 * `videos/<id>/renders/`. Offloaded (dell-xps) renders complete there WITHOUT
 * flipping the relay's job status to "completed" — the farm's hf-queue job
 * store and the relay's /video-status job store are separate, and for unknown /
 * evicted jobIds the relay just returns "invalid jobId". So a poll that trusts
 * the relay alone hangs at "running" forever (or 404s). Probing the actual
 * output lets the editor's gate advance.
 *
 * No-op on Workers (the path doesn't exist → readdir throws → null).
 */
async function farmNewestRender(
  videoName: string,
  withinMs?: number,
): Promise<{ path: string; mtime: number } | null> {
  try {
    const dir = join(FARM_VIDEOS, videoName, "renders");
    const files = await readdir(dir);
    let newest: { path: string; mtime: number } | null = null;
    for (const f of files) {
      if (!f.endsWith(".mp4")) continue;
      const s = await stat(join(dir, f));
      if (!newest || s.mtimeMs > newest.mtime) newest = { path: join(dir, f), mtime: s.mtimeMs };
    }
    if (!newest) return null;
    if (withinMs != null && Date.now() - newest.mtime > withinMs) return null;
    return newest;
  } catch {
    return null; // dir missing (prod Workers) → probe disabled
  }
}

function completed(
  base: Pick<RenderStatus, "jobId" | "videoName"> & Partial<RenderStatus>,
  output: string,
  mtime: number,
): RenderStatus {
  return {
    jobId: base.jobId,
    status: "completed",
    progress: 100,
    videoName: base.videoName,
    output,
    error: null,
    createdAt: base.createdAt ?? new Date(mtime).toISOString(),
    completedAt: new Date(mtime).toISOString(),
  };
}

/**
 * GET /api/studio/template/[id]/render/[jobId] — poll a render job's status via
 * the relay, with an output-based completion fallback for offloaded renders.
 *
 * The [id] segment is the template/videoName, kept for symmetry with the
 * enqueue route; status is keyed on [jobId].
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id, jobId } = await params;

  let status: RenderStatus | null = null;
  let relayErr: RelayError | null = null;
  try {
    status = await getRenderStatus(jobId);
  } catch (e) {
    if (e instanceof RelayError) relayErr = e;
    else return relayErrorResponse(e);
  }

  // Case 1: relay knows the job and it's still running/queued — probe for an
  // output newer than the job's createdAt (this job's render, not a prior one).
  if (status && (status.status === "running" || status.status === "queued")) {
    if (status.createdAt) {
      const newest = await farmNewestRender(id);
      const since = Date.parse(status.createdAt);
      if (newest && Number.isFinite(since) && newest.mtime > since) {
        return NextResponse.json(completed(status, newest.path, newest.mtime));
      }
    }
    return NextResponse.json(status);
  }
  if (status) return NextResponse.json(status);

  // Case 2: relay doesn't know the job (invalid/evicted jobId — common for
  // offloaded renders). Probe for a recent output before giving up.
  if (relayErr && (relayErr.status === 404 || relayErr.status === 400)) {
    const newest = await farmNewestRender(id, 30 * 60 * 1000); // < 30 min old
    if (newest) return NextResponse.json(completed({ jobId, videoName: id }, newest.path, newest.mtime));
  }
  return relayErrorResponse(relayErr);
}
