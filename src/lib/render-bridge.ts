import { NextResponse } from "next/server";

/**
 * Render-bridge client — thin wrappers over the public render relay
 * (render.coreaspectai.com). The Worker has no tailnet access, so the relay is
 * its only bridge to the render farm: it enqueues via its hf-queue and renders
 * on core-control through the `hyperframes-render@<name>.service` systemd unit.
 *
 * Auth: shared bearer `RENDER_SECRET` (same secret as /api/webhook, /api/extract-slots).
 * Upstream contract: ~/services/propodoc-render/server.mjs —
 *   POST /video-rerender/:id { variables? } → recompose {{token}} template + enqueue → 202 { jobId, …, unresolvedPlaceholders }
 *   POST /video-render       { videoName, variables?, webhookUrl? } → 202 { jobId, status, videoName } (canonical; variables ignored)
 *   GET  /video-status/:id   → { jobId, status, progress, videoName, output, error, createdAt, completedAt }
 *
 * Variable binding (brick 7): `variables` (slot values) are bound into the composition
 * via the relay's mustache recompose (`/video-rerender`) — the composition's editable
 * values are `{{slotId}}` tokens in videos/_templates/<id>/index.html, resolved from
 * manifest defaults + the slot values. `/video-render` (the fallback for unbound
 * templates) does not apply variables. See enqueueRender.
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
 * Enqueue a render for a staged `videoName`, binding `variables` (slot values)
 * into the composition first. The relay renders the composition at
 * ~/projects/hyperframes-video-creator/videos/<videoName>/index.html.
 *
 * Variable binding (brick 7): prefer the relay's recompose-then-render endpoint
 * (`/video-rerender`), which substitutes `{{slotId}}` tokens in a mustache
 * template (`videos/_templates/<videoName>/index.html` + manifest defaults) with
 * the slot values before enqueuing — so edits actually change the mp4. If the
 * template isn't bound (no _templates/manifest → relay 500 "recompose failed"),
 * fall back to `/video-render`, which renders the staged composition as-is.
 *
 * Returns { jobId, status, videoName }. Throws RelayError(409) if a job already
 * exists, RelayError(422) if any `{{token}}` is unresolved (never render literal
 * tokens), RelayError(502) if the relay is unreachable.
 */
export async function enqueueRender(
  videoName: string,
  opts?: { variables?: Record<string, unknown>; webhookUrl?: string },
): Promise<RenderJob> {
  const body: Record<string, unknown> = {};
  if (opts?.variables) body.variables = opts.variables;
  if (opts?.webhookUrl) body.webhookUrl = opts.webhookUrl;

  try {
    return await rerenderAndEnqueue(videoName, body);
  } catch (e) {
    // Unbound template (no _templates/manifest) → recompose 500s; render canonical.
    if (e instanceof RelayError && e.status === 500) {
      return await directEnqueue(videoName, body);
    }
    throw e;
  }
}

/** Recompose the composition with `body.variables` (mustache), then enqueue. */
async function rerenderAndEnqueue(
  videoName: string,
  body: Record<string, unknown>,
): Promise<RenderJob> {
  const { resp, parsed } = await postJson(
    `/video-rerender/${encodeURIComponent(videoName)}`,
    body,
  );
  if (!resp.ok) {
    throw new RelayError(resp.status, `relay ${resp.status} for ${videoName}`, parsed);
  }
  const r = parsed as {
    jobId?: string;
    status?: string;
    videoName?: string;
    unresolvedPlaceholders?: string[];
  };
  if (r.unresolvedPlaceholders && r.unresolvedPlaceholders.length) {
    throw new RelayError(
      422,
      `unresolved template bindings: ${r.unresolvedPlaceholders.join(", ")}`,
      parsed,
    );
  }
  if (!r.jobId) {
    throw new RelayError(502, `relay returned no jobId for ${videoName}`, parsed);
  }
  return { jobId: r.jobId, status: r.status ?? "queued", videoName: r.videoName ?? videoName };
}

/** Fallback: enqueue a canonical render (variables ignored by this path). */
async function directEnqueue(
  videoName: string,
  body: Record<string, unknown>,
): Promise<RenderJob> {
  const { resp, parsed } = await postJson(`/video-render`, { videoName, ...body });
  if (!resp.ok) {
    throw new RelayError(resp.status, `relay ${resp.status} for ${videoName}`, parsed);
  }
  return parsed as RenderJob;
}

/** POST JSON to the relay; never throws on HTTP status (caller inspects resp). */
async function postJson(
  path: string,
  body: Record<string, unknown>,
): Promise<{ resp: Response; parsed: unknown }> {
  let resp: Response;
  try {
    resp = await fetch(`${RENDER_BASE}${path}`, {
      method: "POST",
      headers: { authorization: bearer(), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new RelayError(502, `render relay unreachable: ${(e as Error).message}`);
  }
  return { resp, parsed: await parseBody(resp) };
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

/** Lint report shape from `hyperframes lint --json` (flat — no nested wrapper). */
export interface CheckReport {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  findings: Array<{
    severity: string; // "error" | "warning" | "info"
    code: string;
    message?: string;
    selector?: string;
  }>;
}

/**
 * GET /video-check/:id — the structural lint gate (D5 step 1). The relay runs
 * `hyperframes lint --json` on the STAGED composition. `ok` is the pass verdict
 * (true = 0 errors); warnings/info are advisory. Throws RelayError(404) if the
 * composition isn't staged, RelayError(502) if the relay/lint fails.
 */
export async function getCheckReport(videoName: string): Promise<CheckReport> {
  let resp: Response;
  try {
    resp = await fetch(`${RENDER_BASE}/video-check/${encodeURIComponent(videoName)}`, {
      headers: { authorization: bearer() },
    });
  } catch (e) {
    throw new RelayError(502, `render relay unreachable: ${(e as Error).message}`);
  }

  const parsed = await parseBody(resp);
  if (!resp.ok) {
    throw new RelayError(
      resp.status,
      `relay ${resp.status} for check ${videoName}`,
      parsed,
    );
  }
  return parsed as CheckReport;
}

/** Vision-QA report from hf-adversarial-review.py (GLM-4.6V scores 12 key frames). */
export interface ReviewReport {
  video?: string;
  average_score: number; // 0-10
  passed: boolean;
  threshold: number;
  frames_reviewed: number;
  per_frame?: Array<{
    score: number;
    issues?: string[];
    strengths?: string[];
    fix_needed?: boolean;
  }>;
  all_issues?: string[];
  fixes?: Array<{ priority?: string; issue?: string; fix?: string }>;
}

/**
 * GET /video-review/:id — vision-QA gate (D5 step 3). Async: returns the cached
 * report if fresh (`ready: true`), or `{ ready: false }` (HTTP 202) if a review is
 * running on the relay (the editor polls). Throws RelayError(404) if there's no
 * rendered mp4 to review, RelayError(502) if the relay is unreachable.
 */
export async function getReviewReport(
  videoName: string,
): Promise<{ ready: boolean; report?: ReviewReport }> {
  let resp: Response;
  try {
    resp = await fetch(`${RENDER_BASE}/video-review/${encodeURIComponent(videoName)}`, {
      headers: { authorization: bearer() },
    });
  } catch (e) {
    throw new RelayError(502, `render relay unreachable: ${(e as Error).message}`);
  }

  const parsed = await parseBody(resp);
  if (resp.status === 202) return { ready: false };
  if (!resp.ok) {
    throw new RelayError(
      resp.status,
      `relay ${resp.status} for review ${videoName}`,
      parsed,
    );
  }
  return { ready: true, report: parsed as ReviewReport };
}

/** Human sign-off state for a render (D5 step 4). `current` = the approval is for
 * the latest mp4 (else a newer render is pending re-approval). */
export interface ApprovalState {
  status: "approved" | "rejected" | "pending";
  mp4?: string | null;
  score?: number | null;
  at?: string | null;
  current: boolean;
}

/** GET /video-approve/:id — read the producer's sign-off for the latest render. */
export async function getApproval(videoName: string): Promise<ApprovalState> {
  let resp: Response;
  try {
    resp = await fetch(`${RENDER_BASE}/video-approve/${encodeURIComponent(videoName)}`, {
      headers: { authorization: bearer() },
    });
  } catch (e) {
    throw new RelayError(502, `render relay unreachable: ${(e as Error).message}`);
  }
  const parsed = await parseBody(resp);
  if (!resp.ok) {
    throw new RelayError(resp.status, `relay ${resp.status} for approval ${videoName}`, parsed);
  }
  return parsed as ApprovalState;
}

/** POST /video-approve/:id — record the producer's sign-off (approved/rejected). */
export async function setApproval(
  videoName: string,
  decision: { status: "approved" | "rejected"; mp4: string; score?: number },
): Promise<ApprovalState> {
  let resp: Response;
  try {
    resp = await fetch(`${RENDER_BASE}/video-approve/${encodeURIComponent(videoName)}`, {
      method: "POST",
      headers: { authorization: bearer(), "content-type": "application/json" },
      body: JSON.stringify(decision),
    });
  } catch (e) {
    throw new RelayError(502, `render relay unreachable: ${(e as Error).message}`);
  }
  const parsed = await parseBody(resp);
  if (!resp.ok) {
    throw new RelayError(resp.status, `relay ${resp.status} for approval ${videoName}`, parsed);
  }
  return parsed as ApprovalState;
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
