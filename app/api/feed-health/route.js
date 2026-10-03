import { NextResponse } from 'next/server';
import { getFeed } from '@/lib/feeds';

export const dynamic = 'force-dynamic';

// Public, non-sensitive: which public news feeds are reachable. Used for monitoring.
export async function GET() {
  try {
    const f = await getFeed();
    const ok = f.sources.filter((s) => s.ok).length;
    return NextResponse.json({ ok: true, sources: f.sources.length, healthy: ok, items: f.items.length, fetchedAt: f.fetchedAt,
      detail: f.sources.map((s) => ({ name: s.name, ok: s.ok, count: s.count, error: s.error })) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.code === 'NO_DB_URL' ? e.message : 'Feed unavailable' }, { status: 503 });
  }
}
