import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET, OPTIONS } from "./route";

/**
 * Real-behavior tests for the HyperFrames → core-control Python API gateway.
 *
 * The route handler is invoked directly with real `NextRequest` objects and the
 * upstream Python service is faked via `globalThis.fetch`, so these tests
 * exercise the gateway's actual auth gating (ADR-005), URL/body forwarding
 * (ADR-003), and error handling — without needing the Python systemd service.
 */

type Ctx = { params: Promise<{ path?: string[] }> };
const ctx = (path: string[]): Ctx => ({ params: Promise.resolve({ path }) });

interface MakeReqOpts {
  url: string;
  method?: string;
  body?: string;
  cookie?: string; // raw cookie header value, e.g. "ha-auth=ok"
  contentType?: string;
}

function makeReq(opts: MakeReqOpts): NextRequest {
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.contentType) headers.set("content-type", opts.contentType);
  return new NextRequest(opts.url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body,
  });
}

function fakeUpstream(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): typeof fetch {
  return vi.fn(async () => {
    const res = new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
    return res as unknown as Promise<Response>;
  }) as unknown as typeof fetch;
}

describe("youtube gateway route", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // --- AC3: authentication via HyperFrames' ha-auth cookie (ADR-005) ---------

  it("rejects a POST with no ha-auth cookie (401)", async () => {
    const req = makeReq({
      url: "http://localhost/api/youtube/process-youtube-video",
      method: "POST",
      body: "{}",
      contentType: "application/json",
      // no cookie
    });
    const res = await POST(req, ctx(["process-youtube-video"]));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe(401);
  });

  it("rejects a request when the ha-auth cookie has the wrong value (401)", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const req = makeReq({
      url: "http://localhost/api/youtube/videos",
      cookie: "ha-auth=nope",
    });
    const res = await GET(req, ctx(["videos"]));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // --- AC1 + AC2: proxy an authenticated POST to the Python backend ----------

  it("proxies an authenticated POST to core-control and passes through 202 + job_id", async () => {
    const fetchMock = fakeUpstream(
      { job_id: "abc-123", status: "PENDING" },
      { status: 202 },
    );
    globalThis.fetch = fetchMock;

    const payload = JSON.stringify({
      url: "https://youtu.be/dQw4w9WgXcQ",
      style: "cyberpunk-neon",
      mode: "recompose",
      advanced_config: {},
    });
    const req = makeReq({
      url: "http://localhost/api/youtube/process-youtube-video",
      method: "POST",
      body: payload,
      cookie: "ha-auth=ok",
      contentType: "application/json",
    });

    const res = await POST(req, ctx(["process-youtube-video"]));

    // Pass-through of the upstream 202 + body (AC2).
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ job_id: "abc-123", status: "PENDING" });

    // The request actually reached the Python service at the right place (AC1/AC2).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = (
      fetchMock as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [URL, RequestInit];
    expect(String(calledUrl)).toBe(
      "http://127.0.0.1:3001/process-youtube-video",
    );
    expect(init.method).toBe("POST");
    // The client's JSON body is forwarded verbatim.
    expect(init.body).toBe(payload);
    // The gateway stamps its trust hop (ADR-005).
    expect((init.headers as Headers).get("x-forwarded-from")).toBe(
      "hyperframes-admin",
    );
  });

  it("preserves the query string when proxying a GET (videos?limit=60)", async () => {
    const fetchMock = fakeUpstream({ videos: [] });
    globalThis.fetch = fetchMock;

    const req = makeReq({
      url: "http://localhost/api/youtube/videos?limit=60",
      cookie: "ha-auth=ok",
    });
    const res = await GET(req, ctx(["videos"]));

    expect(res.status).toBe(200);
    const [calledUrl] = (
      fetchMock as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [URL];
    expect(String(calledUrl)).toBe("http://127.0.0.1:3001/videos?limit=60");
  });

  it("encodes path segments into the upstream URL (status/{job_id})", async () => {
    const fetchMock = fakeUpstream({ job_id: "job-9", status: "PROCESSING" });
    globalThis.fetch = fetchMock;

    const req = makeReq({
      url: "http://localhost/api/youtube/status/job-9",
      cookie: "ha-auth=ok",
    });
    await GET(req, ctx(["status", "job-9"]));
    const [calledUrl] = (
      fetchMock as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [URL];
    expect(String(calledUrl)).toBe("http://127.0.0.1:3001/status/job-9");
  });

  // --- Story 3.3 (FR-7): comment/feedback forwarding ------------------------
  // The /admin/youtube-pipeline grid posts structured feedback to
  // POST /api/youtube/videos/{job_id}/comments; the gateway must forward the
  // three-segment path (incl. the UUID job_id), the comment JSON body, and pass
  // the backend's 201 back to the client. Auth still gates the comment POST.

  it("proxies an authenticated comment POST to /videos/{job_id}/comments (201 passthrough)", async () => {
    const fetchMock = fakeUpstream(
      {
        comment_id: "cmt-1",
        job_id: "11111111-2222-3333-4444-555555555555",
        body: "Neon looks great",
        visuals: "good",
        audio_sync: "yes",
        created_at: "2026-08-09T00:00:00Z",
      },
      { status: 201 },
    );
    globalThis.fetch = fetchMock;

    const jobId = "11111111-2222-3333-4444-555555555555";
    const payload = JSON.stringify({
      body: "Neon looks great",
      visuals: "good",
      audio_sync: "yes",
    });
    const req = makeReq({
      url: `http://localhost/api/youtube/videos/${jobId}/comments`,
      method: "POST",
      body: payload,
      cookie: "ha-auth=ok",
      contentType: "application/json",
    });

    const res = await POST(req, ctx(["videos", jobId, "comments"]));

    // The Python backend persists the comment and returns 201; pass it through.
    expect(res.status).toBe(201);
    expect((await res.json()).comment_id).toBe("cmt-1");

    // The three-segment comment path (with the hyphenated UUID intact) lands on
    // the Python service verbatim — encodeURIComponent leaves UUID hyphens as-is.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = (
      fetchMock as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [URL, RequestInit];
    expect(String(calledUrl)).toBe(
      `http://127.0.0.1:3001/videos/${jobId}/comments`,
    );
    expect(init.method).toBe("POST");
    // The comment JSON (body + structured visuals/audio_sync) is forwarded as-is.
    expect(init.body).toBe(payload);
  });

  it("still requires the ha-auth cookie to post a comment (401, never reaches the backend)", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const req = makeReq({
      url: "http://localhost/api/youtube/videos/some-job/comments",
      method: "POST",
      body: JSON.stringify({ body: "x" }),
      contentType: "application/json",
      // no ha-auth cookie
    });
    const res = await POST(req, ctx(["videos", "some-job", "comments"]));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // --- Resilience -----------------------------------------------------------

  it("returns 502 when the Python service is unreachable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:3001");
    }) as unknown as typeof fetch;

    const req = makeReq({
      url: "http://localhost/api/youtube/status/job-9",
      cookie: "ha-auth=ok",
    });
    const res = await GET(req, ctx(["status", "job-9"]));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe(502);
  });

  it("answers CORS preflight (OPTIONS) with 204 and no auth requirement", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
  });
});
