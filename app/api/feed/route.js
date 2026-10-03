import { NextResponse } from 'next/server';
import { getFeed, interleave, openAlerts } from '@/lib/feeds';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 60, 180);
  try {
    const [feed, alerts] = await Promise.all([
      getFeed({ force: url.searchParams.get('refresh') === '1' }),
      openAlerts(),
    ]);
    const items = url.searchParams.get('mix') === '1' ? interleave([...feed.items]) : feed.items;
    return NextResponse.json({ items: items.slice(0, limit), alerts, sources: feed.sources, fetchedAt: feed.fetchedAt });
  } catch (e) {
    return NextResponse.json({ error: e.message, items: [], alerts: [] }, { status: 503 });
  }
}
