import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { SCHEMA } from '@/lib/entities';

export const dynamic = 'force-dynamic';

// The Ezra fix queue. The dashboard (signed-in session) queues jobs with "Fix with Ezra";
// the Ezra agent (NEWS_INGEST_TOKEN bearer) picks them up, works them, and reports back.
// Statuses: queued -> picked-up -> in-progress -> pr-open -> done | failed | cancelled

const STATUSES = ['queued', 'picked-up', 'in-progress', 'pr-open', 'done', 'failed', 'cancelled'];
const OPEN = ['queued', 'picked-up', 'in-progress', 'pr-open'];

async function ensureTable() {
  await q(`create table if not exists ${SCHEMA}.ezra_queue (
    id serial primary key,
    news_id integer,
    title text not null,
    instruction text,
    status text not null default 'queued',
    result_md text,
    pr_links jsonb,
    requested_at timestamptz not null default now(),
    updated_at timestamptz
  )`);
}

const missingTable = (e) => e?.code === '42P01';
const fail = (e) => NextResponse.json({ error: e.message }, { status: e.code === 'NO_DB_URL' ? 503 : 500 });

// GET: ?status=queued|open|all (default open), newest first.
export async function GET(req) {
  const status = new URL(req.url).searchParams.get('status') || 'open';
  try {
    let r;
    if (status === 'all') r = await q(`select * from ${SCHEMA}.ezra_queue order by requested_at desc limit 100`);
    else if (status === 'open') r = await q(`select * from ${SCHEMA}.ezra_queue where status = any($1) order by requested_at desc limit 100`, [OPEN]);
    else r = await q(`select * from ${SCHEMA}.ezra_queue where status = $1 order by requested_at asc limit 100`, [status]);
    return NextResponse.json({ jobs: r.rows });
  } catch (e) {
    if (missingTable(e)) return NextResponse.json({ jobs: [] });
    return fail(e);
  }
}

// POST: { news_id?, title, instruction? } — queue a job. If an open job already exists for the
// same news item, return it instead of queueing a duplicate.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const title = body.title ? String(body.title).slice(0, 300) : null;
  if (!title) return NextResponse.json({ error: 'Send { title, news_id?, instruction? }' }, { status: 400 });
  const newsId = Number.isInteger(body.news_id) ? body.news_id : null;
  const instruction = body.instruction ? String(body.instruction).slice(0, 4000) : null;
  try {
    const run = async () => {
      if (newsId != null) {
        const dup = await q(`select * from ${SCHEMA}.ezra_queue where news_id = $1 and status = any($2) limit 1`, [newsId, OPEN]);
        if (dup.rows.length) return { job: dup.rows[0], existing: true };
      }
      const r = await q(
        `insert into ${SCHEMA}.ezra_queue (news_id, title, instruction) values ($1,$2,$3) returning *`,
        [newsId, title, instruction]
      );
      return { job: r.rows[0], existing: false };
    };
    let out;
    try { out = await run(); }
    catch (e) {
      if (!missingTable(e)) throw e;
      await ensureTable();
      out = await run();
    }
    return NextResponse.json({ ok: true, ...out });
  } catch (e) { return fail(e); }
}

// PATCH: { id, status?, result_md?, pr_links? } — Ezra reports progress; the UI can cancel.
export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const sets = [];
  const vals = [];
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
    vals.push(body.status); sets.push(`status = $${vals.length}`);
  }
  if (body.result_md !== undefined) { vals.push(body.result_md ? String(body.result_md).slice(0, 20000) : null); sets.push(`result_md = $${vals.length}`); }
  if (body.pr_links !== undefined) {
    const links = Array.isArray(body.pr_links) ? body.pr_links.slice(0, 40) : null;
    vals.push(links ? JSON.stringify(links) : null); sets.push(`pr_links = $${vals.length}`);
  }
  if (!sets.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
  sets.push('updated_at = now()');
  try {
    const r = await q(`update ${SCHEMA}.ezra_queue set ${sets.join(', ')} where id = $${vals.length + 1} returning *`, [...vals, id]);
    if (!r.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, job: r.rows[0] });
  } catch (e) {
    if (missingTable(e)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return fail(e);
  }
}
