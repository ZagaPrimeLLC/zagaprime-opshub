import { NextResponse } from 'next/server';
import { runKeepalive } from '@/lib/keepalive';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function run(req, trigger) {
  try {
    const raw = new URL(req.url).searchParams.get('id');
    const id = raw && /^\d+$/.test(raw) ? Number(raw) : null;
    const { at, logged, results } = await runKeepalive({ id, trigger });
    const ok = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, pinged: results.length, healthy: ok, at, logged, trigger, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// GET: the daily Vercel cron. POST: "Ping now" from the dashboard (all, or ?id= one database).
export const GET = (req) => run(req, 'cron');
export const POST = (req) => run(req, 'manual');
