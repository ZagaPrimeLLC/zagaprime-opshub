import { NextResponse } from 'next/server';
import { runKeepalive } from '@/lib/keepalive';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function run() {
  try {
    const results = await runKeepalive();
    const ok = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, pinged: results.length, healthy: ok, at: new Date().toISOString(), results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// GET: the daily Vercel cron. POST: "Ping now" from the dashboard. Both pass middleware auth.
export const GET = run;
export const POST = run;
