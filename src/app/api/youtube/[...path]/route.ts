import { NextRequest, NextResponse } from "next/server";

/**
 * HyperFrames → core-control Python API gateway (ADR-003, ADR-005).
 *
 * The youtube-ai-video FastAPI microservice runs on core-control bound to
 * 127.0.0.1:3001. This catch-all proxies every /api/youtube/* request the
 * /admin/youtube-pipeline page issues onto the Python backend:
 *
 *   POST /api/youtube/process-youtube-video  ->  POST /process-youtube-video
 *   GET  /api/youtube/status/{job_id}        ->  GET  /status/{job_id}
 *   GET  /api/youtube/videos                 ->  GET  /videos
 *   GET  /api/youtube/videos/{id}            ->  GET  /videos/{id}
 *   POST /api/youtube/videos/{id}/comments   ->  POST /videos/{id}/comments
 *   GET  /api/youtube/videos/{id}/file       ->  GET  /videos/{id}/file  (streamed)
 *
 * Auth: consistent with the rest of HyperFrames' /api/* routes, the /admin page
 * gates access client-side (sessionStorage) and this gateway trusts that gate
 * (ADR-005 — the Python service trusts the Next.js layer). Tighten here if a
 * server-side admin session is introduced for the wider app.
 */

const PYTHON_API_BASE =
  process.env.YOUTUBE_API_URL || "http://127.0.0.1:3001";

// Never forward these to the Python service.
const STRIP_REQ_HEADERS = new Set([
  "host", "connection", "content-length", "transfer-encoding",
]);

// Hop-by-hop / framework headers we strip from the upstream response.
const STRIP_RES_HEADERS = new Set([
  "content-encoding", "content-length", "transfer-encoding",
  "connection", "keep-alive",
]);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function forward(req: NextRequest, segments: string[]) {
  const path = segments.map(encodeURIComponent).join("/");
  const search = req.nextUrl.search || ""; // preserve ?limit= / ?status=
  const upstream = new URL(`${PYTHON_API_BASE}/${path}${search}`);

  const method = req.method;
  const init: RequestInit = {
    method,
    headers: buildForwardHeaders(req),
  };

  // Forward JSON bodies for POST/PUT; let GETs through clean.
  if (method !== "GET" && method !== "HEAD") {
    try {
      init.body = await req.text();
    } catch {
      /* no body — fine */
    }
  }

  let upstreamResp: Response;
  try {
    upstreamResp = await fetch(upstream, init);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        code: 502,
        message:
          "Cannot reach the youtube-ai-video Python API at " +
          PYTHON_API_BASE + ". Is the systemd service running? (" + msg + ")",
      },
      { status: 502 }
    );
  }

  return passThrough(upstreamResp);
}

function buildForwardHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP_REQ_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  // Signal the originating gateway to the Python service (ADR-005 trust hop).
  headers.set("x-forwarded-from", "hyperframes-admin");
  return headers;
}

function passThrough(upstreamResp: Response): NextResponse {
  const headers = new Headers();
  upstreamResp.headers.forEach((value, key) => {
    if (!STRIP_RES_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  // Stream the body untouched — works for JSON, logs, AND large video/mp4 files
  // (the /videos/{id}/file endpoint, Story 4.1). Supports range requests.
  return new NextResponse(upstreamResp.body, {
    status: upstreamResp.status,
    statusText: upstreamResp.statusText,
    headers,
  });
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return forward(req, path);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return forward(req, path);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return forward(req, path);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
