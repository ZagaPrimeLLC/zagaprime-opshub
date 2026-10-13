import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { SCHEMA } from '@/lib/entities';

export const dynamic = 'force-dynamic';

// The daily stack-news agent posts a narrative morning brief here (one per day, upsert on date).
// Middleware lets in the NEWS_INGEST_TOKEN bearer or a signed-in session.

async function ensureTable() {
  await q(`create table if not exists ${SCHEMA}.daily_brief (
    id serial primary key,
    brief_date date not null unique,
    headline text not null,
    body_md text not null,
    stats jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz
  )`);
}

function missingTable(e) {
  return e?.code === '42P01';
}

// GET: recent briefs (date + headline only, newest first) so the agent can skip duplicates.
// ?date=YYYY-MM-DD returns that one brief in full.
export async function GET(req) {
  const date = new URL(req.url).searchParams.get('date');
  try {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const r = await q(`select * from ${SCHEMA}.daily_brief where brief_date = $1`, [date]);
      return NextResponse.json({ brief: r.rows[0] || null });
    }
    const r = await q(`select brief_date, headline, created_at from ${SCHEMA}.daily_brief order by brief_date desc limit 45`);
    return NextResponse.json({ briefs: r.rows });
  } catch (e) {
    if (missingTable(e)) return NextResponse.json(date ? { brief: null } : { briefs: [] });
    return NextResponse.json({ error: e.message }, { status: e.code === 'NO_DB_URL' ? 503 : 500 });
  }
}

// POST: { brief_date?: 'YYYY-MM-DD' (default today ET), headline, body_md, stats? }
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const headline = body.headline ? String(body.headline).slice(0, 300) : null;
  const bodyMd = body.body_md ? String(body.body_md).slice(0, 20000) : null;
  if (!headline || !bodyMd) {
    return NextResponse.json({ error: 'Send { headline, body_md, brief_date?, stats? }' }, { status: 400 });
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.brief_date || '')
    ? body.brief_date
    : new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const stats = body.stats && typeof body.stats === 'object' ? body.stats : null;
  try {
    const run = () => q(
      `insert into ${SCHEMA}.daily_brief (brief_date, headline, body_md, stats)
       values ($1,$2,$3,$4)
       on conflict (brief_date) do update set headline = excluded.headline, body_md = excluded.body_md,
         stats = excluded.stats, updated_at = now()
       returning id, brief_date, created_at, updated_at`,
      [date, headline, bodyMd, stats]
    );
    let r;
    try { r = await run(); }
    catch (e) {
      if (!missingTable(e)) throw e;
      await ensureTable();
      r = await run();
    }
    return NextResponse.json({ ok: true, brief: r.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.code === 'NO_DB_URL' ? 503 : 500 });
  }
}
