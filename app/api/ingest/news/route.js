import { NextResponse } from 'next/server';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Write-only door for the daily stack-news agent. Middleware checks the NEWS_INGEST_TOKEN bearer.
const CRIT = new Set(['critical', 'high', 'medium', 'low']);

// GET: recent URLs + valid slugs, so the agent can skip duplicates and tag projects.
export async function GET() {
  const [news, projects, providers] = await Promise.all([
    q(`select url, title from proj_opsdash.stack_news order by created_at desc limit 150`),
    q(`select slug, name from proj_opsdash.projects order by slug`),
    q(`select slug, name from proj_opsdash.providers order by slug`),
  ]);
  return NextResponse.json({ recent: news.rows, projects: projects.rows, providers: providers.rows });
}

// POST: { items: [{ title, url, summary, criticality, category, effort, action, provider_slug, affected_projects, published_at }] }
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items.slice(0, 12) : [];
  if (!items.length) return NextResponse.json({ error: 'Send { items: [...] }' }, { status: 400 });
  const [projects, providers] = await Promise.all([
    q(`select slug from proj_opsdash.projects`).then((r) => new Set(r.rows.map((x) => x.slug))),
    q(`select slug from proj_opsdash.providers`).then((r) => new Set(r.rows.map((x) => x.slug))),
  ]);
  let inserted = 0;
  const skipped = [];
  for (const it of items) {
    if (!it?.title || !it?.url) { skipped.push({ title: it?.title, reason: 'title and url required' }); continue; }
    const crit = CRIT.has(it.criticality) ? it.criticality : 'low';
    const prov = providers.has(it.provider_slug) ? it.provider_slug : null;
    const affected = Array.isArray(it.affected_projects) ? it.affected_projects.filter((s) => projects.has(s)) : null;
    const r = await q(
      `insert into proj_opsdash.stack_news (provider_slug, title, url, summary, criticality, category, effort, action, affected_projects, published_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (url) do nothing returning id`,
      [prov, String(it.title).slice(0, 300), String(it.url).slice(0, 1000), it.summary ? String(it.summary).slice(0, 2000) : null, crit,
        it.category ? String(it.category).slice(0, 40) : null, it.effort ? String(it.effort).slice(0, 80) : null,
        it.action ? String(it.action).slice(0, 1000) : null, affected && affected.length ? affected : null,
        /^\d{4}-\d{2}-\d{2}$/.test(it.published_at || '') ? it.published_at : null]
    );
    if (r.rows.length) inserted++; else skipped.push({ title: it.title, reason: 'duplicate url' });
  }
  return NextResponse.json({ ok: true, inserted, skipped });
}
