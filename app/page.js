import Link from 'next/link';
import { fetchAll, overview } from '@/lib/data';
import { pcolor } from '@/lib/providers';
import { BarList, Donut } from '@/components/bits';
import SetupNotice from '@/components/setup';

export const dynamic = 'force-dynamic';

const ENV_COLORS = { prod: '#2fd38a', staging: '#facc15', preview: '#14d4ff', dev: '#5f63ff', unknown: '#6c769d' };
const CRIT_COLORS = { critical: '#ff4d6d', high: '#facc15', medium: '#5f63ff', low: '#6c769d' };
const SCORE_KEYS = [
  ['score_security', 'Security'], ['score_compliance', 'Compliance'], ['score_seo', 'SEO'],
  ['score_performance', 'Perf'], ['score_risk', 'Risk posture'],
];

function scoreColor(v) {
  if (v == null) return 'var(--faint)';
  if (v >= 80) return 'var(--ok)';
  if (v >= 60) return 'var(--fg)';
  if (v >= 40) return 'var(--warn)';
  return 'var(--flag)';
}
function minScore(x) {
  const vals = ['score_security', 'score_compliance', 'score_performance', 'score_risk'].map((k) => x[k]).filter((v) => v != null);
  return vals.length ? Math.min(...vals) : null;
}

export default async function Overview() {
  let d;
  try {
    d = await fetchAll();
  } catch (e) {
    return (<><h1 className="pagetitle">Overview</h1><SetupNotice error={e.message} /></>);
  }
  const o = overview(d);
  const provBars = Object.entries(o.byProvider)
    .sort((a, b) => b[1] - a[1])
    .map(([slug, n]) => ({
      label: d.providers.find((p) => p.slug === slug)?.name || slug,
      value: n,
      color: pcolor(slug).c,
      href: slug === 'other' ? '/projects' : `/projects?provider=${slug}`,
    }));
  const envParts = Object.entries(o.byEnv).sort((a, b) => b[1] - a[1])
    .map(([e, n]) => ({ label: e, value: n, color: ENV_COLORS[e] || '#6c769d', href: `/projects?env=${e}` }));
  const critParts = Object.entries(o.byCrit)
    .map(([c, n]) => ({ label: c, value: n, color: CRIT_COLORS[c], href: `/news?crit=${c}` }));
  const lastSweep = d.news[0]?.created_at
    ? new Date(d.news[0].created_at).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;
  const complete = o.progress.filter((p) => p.score === 4).length;

  const stats = [
    { v: d.projects.length, l: 'Projects', href: '/projects' },
    { v: d.accounts.length, l: 'Accounts', href: '/accounts' },
    { v: d.resources.length, l: 'Resources', href: '/projects?expand=all' },
    { v: o.prod.length, l: 'In production', href: '/projects?env=prod' },
    { v: o.unmapped.length, l: 'Unmapped', href: '/projects?show=unassigned' },
    { v: d.domains.length, l: 'Domains', href: '/domains' },
    { v: o.openNews.length, l: 'Open updates', href: '/news' },
  ];

  return (
    <>
      <section className="hero">
        <h1>Welcome back, Kzee.</h1>
        <p>
          {o.openNews.filter((n) => n.criticality === 'critical').length > 0
            ? `${o.openNews.filter((n) => n.criticality === 'critical').length} critical stack update needs you today. `
            : 'No critical stack updates open. '}
          {complete}/{o.progress.length} projects have a complete stack. {lastSweep ? `Last news sweep ${lastSweep} ET.` : ''}
        </p>
      </section>

      <div className="stats">
        {stats.map((s) => (
          <Link key={s.l} className="stat clicky" href={s.href}>
            <div className="v">{s.v}</div>
            <div className="l"><span>{s.l}</span><span className="go">→</span></div>
          </Link>
        ))}
      </div>

      <div className="charts">
        <div className="chartcard"><h3>Resources by provider</h3><BarList items={provBars} /></div>
        <div className="chartcard"><h3>Environments</h3><Donut parts={envParts} label="resources" /></div>
        <div className="chartcard"><h3>Open updates by criticality</h3><Donut parts={critParts} label="open" /></div>
      </div>

      <h2 className="viewtitle">Needs attention</h2>
      <div className="flags">
        {o.flags.length === 0 && <div className="empty">All clear — nothing flagged.</div>}
        {o.flags.map((f, i) => (
          <Link className={`flagrow clicky ${f.level}`} key={i} href={f.href || '/'}>
            <div><div className="ft">{f.title}</div><div className="fd">{f.detail}</div></div>
            <span className="fgo">→</span>
          </Link>
        ))}
      </div>

      <h2 className="viewtitle">Project progress — hosting · database · domain · repo <Link href="/projects">All projects →</Link></h2>
      <div className="progrows">
        {o.progress.map((p) => {
          const pct = (p.score / 4) * 100;
          const fill = p.score === 4 ? 'var(--grad)' : p.score >= 2 ? 'linear-gradient(90deg,#5f63ff,#a52cff)' : 'var(--flag)';
          return (
            <div className="prog" key={p.slug}>
              <div>
                <Link className="pn" href={`/projects?focus=${p.slug}`}>{p.name}</Link>
                <div className="pc">
                  {p.resCount} resources
                  {p.newsCount ? <> · <Link href={`/news?project=${p.slug}`}>{p.newsCount} open update{p.newsCount === 1 ? '' : 's'}</Link></> : null}
                </div>
              </div>
              <Link className="ptrack" href={`/projects?focus=${p.slug}`} title={`${p.score}/4 stack pieces in place`}>
                <span className="pfill" style={{ width: `${pct}%`, background: fill }} />
              </Link>
              <div className="pbadges">
                {['hosting', 'database', 'domain', 'repo'].map((k) => {
                  const on = p.has[k];
                  const href = k === 'domain'
                    ? (on ? `/domains?project=${p.slug}` : `/domains?add=${p.slug}`)
                    : (on ? `/projects?focus=${p.slug}&kind=${k}` : `/projects?focus=${p.slug}&add=${k}`);
                  return (
                    <Link key={k} className={`pb ${on ? 'on' : 'off'}`} href={href} title={on ? `Show ${k}` : `Add ${k}`}>{k}</Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="viewtitle">Domain health — weakest first <Link href="/domains">All domains →</Link></h2>
      <div className="domwrap">
        <table className="domtable">
          <thead>
            <tr>
              <th>Domain</th><th>Status</th>
              {SCORE_KEYS.map(([k, l]) => <th key={k}><Link href={`/domains?sort=${k}`}>{l}</Link></th>)}
            </tr>
          </thead>
          <tbody>
            {[...d.domains]
              .sort((a, b) => (minScore(a) ?? 101) - (minScore(b) ?? 101))
              .map((x) => {
                const href = `/domains?focus=${encodeURIComponent(x.domain)}`;
                return (
                  <tr key={x.domain}>
                    <td className="mono"><Link href={href}>{x.domain}</Link></td>
                    <td><Link href={href}><span className={`pill ${x.status || 'unknown'}`}>{x.status || '—'}</span></Link></td>
                    {SCORE_KEYS.map(([k]) => (
                      <td key={k} style={{ fontVariantNumeric: 'tabular-nums', color: scoreColor(x[k]) }}><Link href={href}>{x[k] ?? '—'}</Link></td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <p className="pagesub" style={{ marginTop: 26 }}>
        Source of truth: schema <span className="mono">proj_opsdash</span> on the shared Supabase host. Credentials never leave Bitwarden.
        Ask the ZP assistant (bottom right) anything about the stack.
      </p>
    </>
  );
}
