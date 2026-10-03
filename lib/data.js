import { q } from './db';
import { SCHEMA } from './entities';
import { CLASSES } from './classes';

export async function fetchAll() {
  const [providers, accounts, projects, resources, domains, news] = await Promise.all([
    q(`select * from ${SCHEMA}.providers order by name`),
    q(`select * from ${SCHEMA}.accounts order by label`),
    q(`select * from ${SCHEMA}.projects order by name`),
    q(`select * from ${SCHEMA}.resources order by name`),
    q(`select * from ${SCHEMA}.domains order by domain`),
    q(`select * from ${SCHEMA}.stack_news order by created_at desc limit 200`),
  ]);
  return {
    providers: providers.rows,
    accounts: accounts.rows,
    projects: projects.rows,
    resources: resources.rows,
    domains: domains.rows,
    news: news.rows,
  };
}

const HOSTING_KINDS = CLASSES.hosting;
const DB_KINDS = CLASSES.database;
const REPO_KINDS = CLASSES.repo;

export function overview(d) {
  const accBy = Object.fromEntries(d.accounts.map((a) => [a.slug, a]));
  const unmapped = d.resources.filter((r) => !r.project_slug);
  const prod = d.resources.filter((r) => r.environment === 'prod');

  const byProvider = {};
  for (const r of d.resources) {
    const pr = accBy[r.account_slug]?.provider_slug || 'other';
    byProvider[pr] = (byProvider[pr] || 0) + 1;
  }

  const byEnv = {};
  for (const r of d.resources) {
    const e = r.environment || 'unknown';
    byEnv[e] = (byEnv[e] || 0) + 1;
  }

  const openNews = d.news.filter((n) => ['new', 'reviewed', 'in-progress'].includes(n.status));
  const byCrit = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const n of openNews) byCrit[n.criticality] = (byCrit[n.criticality] || 0) + 1;

  const progress = d.projects.map((p) => {
    const res = d.resources.filter((r) => r.project_slug === p.slug);
    const has = {
      hosting: res.some((r) => HOSTING_KINDS.test(r.kind) && r.environment === 'prod') || res.some((r) => HOSTING_KINDS.test(r.kind)),
      database: res.some((r) => DB_KINDS.test(r.kind)),
      domain: d.domains.some((x) => x.project_slug === p.slug) || Boolean(p.prod_url),
      repo: res.some((r) => REPO_KINDS.test(r.kind)) || Boolean(p.repo_url),
    };
    const score = Object.values(has).filter(Boolean).length;
    const newsCount = openNews.filter((n) => (n.affected_projects || []).includes(p.slug)).length;
    return { ...p, resCount: res.length, has, score, newsCount };
  }).sort((a, b) => b.resCount - a.resCount);

  // duplicate resource names of the same kind across different accounts
  const seen = {};
  const dups = [];
  for (const r of d.resources) {
    const key = r.kind + '|' + r.name.replace(/\s*\(.*\)$/, '');
    if (seen[key] && seen[key] !== r.account_slug) dups.push(r.name);
    else seen[key] = r.account_slug;
  }

  const flags = [];
  if (unmapped.length) flags.push({ level: 'red', title: `${unmapped.length} resources have no project`, detail: 'Link each one to its project so nothing is orphaned.', href: '/projects?show=unassigned' });
  if (byCrit.critical) flags.push({ level: 'red', title: `${byCrit.critical} critical stack update${byCrit.critical === 1 ? '' : 's'} open`, detail: 'Security or breaking changes that need action first.', href: '/news?crit=critical' });
  if (byCrit.high) flags.push({ level: 'warn', title: `${byCrit.high} high-priority stack update${byCrit.high === 1 ? '' : 's'} open`, detail: 'Patches and deadlines inside 30 days.', href: '/news?crit=high' });
  const uniqDups = [...new Set(dups)];
  if (uniqDups.length) flags.push({ level: 'warn', title: `Possible duplicates: ${uniqDups.slice(0, 3).join(', ')}`, detail: 'Same name + kind on more than one account — consolidate or rename.', href: `/projects?q=${encodeURIComponent(uniqDups[0].replace(/\s*\(.*\)$/, ''))}` });
  const weakDomains = d.domains.filter((x) => ['score_security', 'score_compliance', 'score_risk'].some((k) => x[k] != null && x[k] < 60));
  if (weakDomains.length) flags.push({ level: 'warn', title: `${weakDomains.length} domain${weakDomains.length === 1 ? '' : 's'} scoring under 60 on security, compliance or risk`, detail: weakDomains.slice(0, 4).map((x) => x.domain).join(', '), href: '/domains?sort=score_security' });
  const noLogin = d.accounts.filter((a) => /fill in/i.test(a.login_hint || ''));
  if (noLogin.length) flags.push({ level: 'warn', title: `${noLogin.length} account${noLogin.length === 1 ? '' : 's'} missing login details`, detail: noLogin.map((a) => a.label).join(', '), href: '/accounts?q=fill%20in' });
  const noBw = d.accounts.filter((a) => !a.bitwarden_url).length;
  if (noBw) flags.push({ level: 'blue', title: `${noBw} accounts have no Bitwarden link yet`, detail: 'Paste item links so credentials are one click away (they never live here).', href: '/accounts?missing=bitwarden' });

  return { unmapped, prod, byProvider, byEnv, byCrit, openNews, progress, flags };
}
