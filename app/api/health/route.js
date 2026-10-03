import { NextResponse } from 'next/server';
import { q, activeDbHost } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const r = await q('select count(*)::int as n from proj_opsdash.resources');
    return NextResponse.json({ ok: true, resources: r.rows[0].n, db: activeDbHost() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.code === 'NO_DB_URL' ? e.message : 'Database unreachable: ' + e.message }, { status: 503 });
  }
}
