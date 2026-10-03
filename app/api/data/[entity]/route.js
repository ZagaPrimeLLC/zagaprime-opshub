import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { ENTITIES, SCHEMA } from '@/lib/entities';

export const dynamic = 'force-dynamic';

function table(entity) {
  const def = ENTITIES[entity];
  if (!def) return null;
  return { def, name: `${SCHEMA}.${entity}` };
}

function fail(e) {
  const status = e.code === 'NO_DB_URL' ? 503 : 500;
  return NextResponse.json({ error: e.message }, { status });
}

export async function GET(req, ctx) {
  const { entity } = await ctx.params;
  const t = table(entity);
  if (!t) return NextResponse.json({ error: 'Unknown entity' }, { status: 404 });
  try {
    const order = t.def.order ? `order by ${t.def.order}` : 'order by created_at desc';
    const r = await q(`select * from ${t.name} ${order}`);
    return NextResponse.json({ rows: r.rows });
  } catch (e) { return fail(e); }
}

export async function POST(req, ctx) {
  const { entity } = await ctx.params;
  const t = table(entity);
  if (!t) return NextResponse.json({ error: 'Unknown entity' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const cols = (t.def.serialPk ? t.def.cols : [t.def.pk, ...t.def.cols.filter((c) => c !== t.def.pk)])
    .filter((c) => body[c] !== undefined);
  if (!cols.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
  const vals = cols.map((c) => (body[c] === '' ? null : body[c]));
  const ph = cols.map((_, i) => `$${i + 1}`).join(',');
  try {
    const r = await q(`insert into ${t.name} (${cols.map((c) => `"${c}"`).join(',')}) values (${ph}) returning *`, vals);
    return NextResponse.json({ row: r.rows[0] });
  } catch (e) { return fail(e); }
}

export async function PATCH(req, ctx) {
  const { entity } = await ctx.params;
  const t = table(entity);
  if (!t) return NextResponse.json({ error: 'Unknown entity' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const id = body.__id;
  if (id === undefined || id === null) return NextResponse.json({ error: 'Missing __id' }, { status: 400 });
  const cols = t.def.cols.filter((c) => body[c] !== undefined);
  if (!cols.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
  const sets = cols.map((c, i) => `"${c}" = $${i + 1}`);
  const vals = cols.map((c) => (body[c] === '' ? null : body[c]));
  if (entity === 'resources') sets.push('updated_at = now()');
  try {
    const r = await q(`update ${t.name} set ${sets.join(', ')} where "${t.def.pk}" = $${cols.length + 1} returning *`, [...vals, id]);
    if (!r.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ row: r.rows[0] });
  } catch (e) { return fail(e); }
}

export async function DELETE(req, ctx) {
  const { entity } = await ctx.params;
  const t = table(entity);
  if (!t) return NextResponse.json({ error: 'Unknown entity' }, { status: 404 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    await q(`delete from ${t.name} where "${t.def.pk}" = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
