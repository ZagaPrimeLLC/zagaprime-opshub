import { q } from './db';
import { fetchAll, overview } from './data';
import { getFeed } from './feeds';

// Builds the live snapshot Ezra answers from.
export async function buildContext() {
  const d = await fetchAll();
  const o = overview(d);
  const kb = await q('select key, content from proj_opsdash.kb order by key').then((r) => r.rows).catch(() => []);
  const ezraJobs = await q(
    `select id, news_id, title, status, pr_links, requested_at from proj_opsdash.ezra_queue
     where status in ('queued','picked-up','in-progress','pr-open') order by requested_at desc limit 20`
  ).then((r) => r.rows).catch(() => []);
  const latestBrief = await q(
    `select brief_date, headline from proj_opsdash.daily_brief order by brief_date desc limit 1`
  ).then((r) => r.rows[0]).catch(() => null);
  let feed = null;
  try { feed = await getFeed(); } catch {}

  const accBy = Object.fromEntries(d.accounts.map((a) => [a.slug, a]));
  const provBy = Object.fromEntries(d.providers.map((p) => [p.slug, p.name]));
  const lines = [];

  lines.push('## Company knowledge');
  for (const k of kb) lines.push(k.content);

  lines.push('\n## Summary');
  lines.push(`${d.projects.length} projects, ${d.accounts.length} accounts, ${d.resources.length} resources (${o.prod.length} prod, ${o.unmapped.length} unmapped), ${d.domains.length} domains, ${o.openNews.length} open stack updates.`);
  for (const f of o.flags) lines.push(`- FLAG: ${f.title} — ${f.detail}`);

  lines.push('\n## Accounts (slug | provider | label | login hint | notes)');
  for (const a of d.accounts) lines.push(`${a.slug} | ${provBy[a.provider_slug] || a.provider_slug} | ${a.label} | ${a.login_hint || ''} | ${a.notes || ''}${a.bitwarden_url ? ' | has Bitwarden link' : ''}`);

  lines.push('\n## Projects and their resources');
  for (const p of o.progress) {
    lines.push(`### ${p.name} (slug: ${p.slug}; client: ${p.client || '-'}; status: ${p.status}; live: ${p.prod_url || '-'}; stack completeness ${p.score}/4: hosting=${p.has.hosting}, database=${p.has.database}, domain=${p.has.domain}, repo=${p.has.repo})`);
    for (const r of d.resources.filter((x) => x.project_slug === p.slug)) {
      lines.push(`- ${r.kind}: ${r.name}${r.external_ref ? ` [${r.external_ref}]` : ''} · ${r.environment || '-'} · account ${accBy[r.account_slug]?.label || '-'}${r.notes ? ` · ${r.notes}` : ''}${r.keepalive_enabled ? ` · keep-alive: ${r.last_ping_ok ? 'awake' : r.last_ping_note || 'not pinged yet'}${r.last_ping_at ? ` (last ping ${r.last_ping_at.toISOString?.() || r.last_ping_at})` : ''}` : ''}`);
    }
  }
  lines.push('\n### Unassigned resources');
  for (const r of o.unmapped) lines.push(`- ${r.kind}: ${r.name} · account ${accBy[r.account_slug]?.label || '-'}${r.notes ? ` · ${r.notes}` : ''}`);

  lines.push('\n## Domains (domain | status | project | built with | security/compliance/seo/perf/risk | improvements)');
  for (const x of d.domains) {
    lines.push(`${x.domain} | ${x.status || '-'} | ${x.project_slug || '-'} | ${x.built_with || '-'} | ${[x.score_security, x.score_compliance, x.score_seo, x.score_performance, x.score_risk].map((v) => v ?? '-').join('/')} | ${x.improvements || ''}`);
    if (x.description) lines.push(`  ${x.description}`);
  }

  lines.push('\n## Open stack updates (from the daily news agent; use the id as news_id when queueing a fix)');
  for (const n of o.openNews) lines.push(`- (id ${n.id}) [${n.criticality}] ${n.title} — effort ${n.effort || '?'} — do: ${n.action || '-'} — affects: ${(n.affected_projects || []).join(', ') || 'general'} — ${n.url || ''}`);

  lines.push('\n## Ezra queue (open fix jobs)');
  if (!ezraJobs.length) lines.push('(empty — nothing queued right now)');
  for (const j of ezraJobs) {
    const prs = Array.isArray(j.pr_links) ? j.pr_links.map((l) => (typeof l === 'string' ? l : l?.url)).filter(Boolean).join(', ') : '';
    lines.push(`- (job ${j.id}) [${j.status}] ${j.title}${j.news_id != null ? ` — stack update id ${j.news_id}` : ''}${prs ? ` — PRs: ${prs}` : ''}`);
  }

  if (latestBrief) {
    lines.push(`\n## Latest Daily Brief (${String(latestBrief.brief_date).slice(0, 10)}, full text at /brief)`);
    lines.push(latestBrief.headline);
  }

  if (feed?.items?.length) {
    lines.push(`\n## Today's channel headlines (fetched ${feed.fetchedAt})`);
    for (const it of feed.items.slice(0, 40)) {
      lines.push(`- (${it.kind === 'article' ? it.category : it.kind}) ${it.source}: ${it.title} — ${it.date ? it.date.slice(0, 10) : ''} — ${it.url}`);
    }
  }
  return lines.join('\n');
}
