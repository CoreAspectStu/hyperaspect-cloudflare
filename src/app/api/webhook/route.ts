import { NextRequest, NextResponse } from 'next/server';

/**
 * Render completion webhook handler.
 *
 * The render backend (render.coreaspectai.com) POSTs here when a render finishes.
 * Body: { jobId, status, videoName, email }
 *
 * On a successful render we push a notification to ntfy.sh so the team gets an
 * instant alert, and we log everything for admin visibility (visible via
 * `wrangler tail` / Cloudflare dashboard > Workers > Logs).
 */

const NTFY_TOPIC = 'coreaspect-hyperaspect';

export async function POST(req: NextRequest) {
  // --- Auth: shared bearer token -----------------------------------------
  const secret = process.env.RENDER_SECRET;
  if (!secret) {
    console.error('WEBHOOK: RENDER_SECRET not configured — cannot verify webhook');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const auth = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  // Constant-time-ish comparison to avoid trivial timing leaks
  if (auth.length !== expected.length || auth !== expected) {
    console.warn(`WEBHOOK: rejected unauthorised request (auth header length ${auth.length})`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Parse body --------------------------------------------------------
  let body: { jobId?: string; status?: string; videoName?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { jobId, status, videoName, email } = body;
  const ts = new Date().toISOString();

  if (!jobId || !status) {
    return NextResponse.json({ error: 'jobId and status are required' }, { status: 400 });
  }

  // --- Log for admin visibility -----------------------------------------
  console.log(
    `WEBHOOK_RECV job=${jobId} status=${status} video=${videoName || '—'} email=${email || '—'} at=${ts}`
  );

  // --- Notify on completion ---------------------------------------------
  // We treat 'completed' / 'done' / 'success' as a finished render.
  const doneStates = new Set(['completed', 'done', 'success']);
  if (doneStates.has((status || '').toLowerCase())) {
    const message = `Your HyperAspect video is ready! Job: ${jobId}`;
    try {
      const ntfyResp = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
        method: 'POST',
        headers: {
          'Title': 'HyperAspect Render Complete',
          'Tags': 'tada,cinema',
          'Priority': 'default',
        },
        body: message,
      });
      if (!ntfyResp.ok) {
        console.error(
          `WEBHOOK_NTFY_FAIL job=${jobId} status=${ntfyResp.status} ${await ntfyResp.text().catch(() => '')}`
        );
      } else {
        console.log(`WEBHOOK_NTFY_OK job=${jobId} topic=${NTFY_TOPIC}`);
      }
    } catch (err: any) {
      // Don't fail the webhook just because ntfy is down
      console.error(`WEBHOOK_NTFY_ERROR job=${jobId} ${err?.message || err}`);
    }
  } else {
    console.log(`WEBHOOK_SKIP_NOTIFY job=${jobId} status=${status} (not a completion state)`);
  }

  return NextResponse.json({ received: true, jobId, status }, { status: 200 });
}

// Reject anything that isn't POST — keeps the surface minimal
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
