import { NextResponse } from "next/server";

/**
 * Render-bridge client — thin wrappers over the public render relay
 * (render.coreaspectai.com). The Worker has no tailnet access, so the relay is
 * its only bridge to the render farm: it enqueues via its hf-queue and renders
 * on core-control through the `hyperframes-render@<name>.service` systemd unit.
 *
 * Auth: shared bearer `RENDER_SECRET` (same secret as /api/webhook, /api/extract-slots).
 * Upstream contract: ~/services/propodoc-render/server.mjs —
 *   POST /video-render      { videoName, variables?, webhookUrl? } → 202 { jobId, status, videoName }
 *   GET  /video-status/:id  → { jobId, status, progress, videoName, output, error, createdAt, completedAt }
 *
 * NOTE (brick 6): the render ExecStart does NOT consume --variables-file, so
 * `variables` are currently NOT applied — the composition renders as-is (deal-01's
 * inlined DEAL block). Passing slot values is harmless and keeps the plumbing
 * ready for the gated-diff (D5). Wiring variables into the render is follow-up #2.
 */

const RENDER_BASE = "https://render.coreaspectai.com";

/** A non-2xx relay response, carrying the upstream status + parsed body for mapping. */
export class RelayError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "RelayError";
  }
}

function bearer(): string {
  const secret = process.env.RENDER_SECRET;
  if (!secret) {
    throw new RelayError(500, "RENDER_SECRET not configured");
  }
  return `Bearer ${secret}`;
}

async function parseBody(resp: Response): Promise<unknown> {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export interface RenderJob {
  jobId: string;
  status: string;
  videoName: string;
}

export interface RenderStatus extends RenderJob {
  progress: number;
  output: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Enqueue a render for a staged `videoName`. The relay renders the composition
 * at ~/projects/hyperframes-video-creator/videos/<videoName>/index.html.
 * Returns { jobId, status, videoName }. Throws RelayError(409) if a job already
 * exists for this video, RelayError(502) if the relay is unreachable.
 */
export async function enqueueRender(
  videoName: string,
  opts?: { variables?: Record<string, unknown>; webhookUrl?: string },
): Promise<RenderJob> {
  const body: Record<string, unknown> = { videoName };
  if (opts?.variables) body.variables = opts.variables;
  if (opts?.webhookUrl) body.webhookUrl = opts.webhookUrl;

  let resp: Response;
  try {
    resp = await fetch(`${RENDER_BASE}/video-render`, {
      method: "POST",
      headers: { authorization: bearer(), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new RelayError(502, `render relay unreachable: ${(e as Error).message}`);
  }

  const parsed = await parseBody(resp);
  if (!resp.ok) {
    throw new RelayError(resp.status, `relay ${resp.status} for ${videoName}`, parsed);
  }
  return parsed as RenderJob;
}

/**
 * Poll a render job by id. Returns the full status row. Throws RelayError(404)
 * if the relay doesn't know the job, RelayError(502) if unreachable.
 */
export async function getRenderStatus(jobId: string): Promise<RenderStatus> {
  let resp: Response;
  try {
    resp = await fetch(`${RENDER_BASE}/video-status/${encodeURIComponent(jobId)}`, {
      headers: { authorization: bearer() },
    });
  } catch (e) {
    throw new RelayError(502, `render relay unreachable: ${(e as Error).message}`);
  }

  const parsed = await parseBody(resp);
  if (!resp.ok) {
    throw new RelayError(resp.status, `relay ${resp.status} for job ${jobId}`, parsed);
  }
  return parsed as RenderStatus;
}

/** Map a thrown RelayError (or unexpected error) to a NextResponse, passing the
 * upstream status + body through so callers see the real relay verdict (409, 404…). */
export function relayErrorResponse(e: unknown) {
  if (e instanceof RelayError) {
    return NextResponse.json(
      { error: e.message, upstream: e.body ?? undefined },
      { status: e.status },
    );
  }
  return NextResponse.json(
    { error: "unexpected render-bridge error", detail: (e as Error)?.message ?? String(e) },
    { status: 500 },
  );
}
