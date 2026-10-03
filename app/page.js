import Link from 'next/link';
import { fetchAll, overview } from '@/lib/data';
import { pcolor, PCOLORS } from '@/lib/providers';
import { BarList, Donut } from '@/components/bits';
import SetupNotice from '@/components/setup';

export const dynamic = 'force-dynamic';

const ENV_COLORS = { prod: 'var(--ok)', staging: 'var(--warn)', preview: 'var(--info)', dev: 'var(--info)', unknown: 'var(--line2)' };
const CRIT_COLORS = { critical: 'var(--flag)', high: 'var(--warn)', medium: 'var(--info)', low: 'var(--faint)' };

export default async function Overview() {
  let d;
  try {
    d = await fetchAll();
  } catch (e) {
    return (
      <>
        <h1 className="pagetitle">Overview</h1>
        <SetupNotice error={e.message} />
      </>
    );
  }
  const o = overview(d);
  const provBars = Object.entries(o.byProvider)
    .sort((a, b) => b[1] - a[1])
    .map(([slug, n]) => ({ label: d.providers.find((p) => p.slug === slug)?.name || slug, value: n, color: pcolor(slug).c }));
  const envParts = Object.entries(o.byEnv).sort((a, b) => b[1] - a[1])
    .map(([e, n]) => ({ label: e, value: n, color: ENV_COLORS[e] || 'var(--line2)' }));
  const critParts = Object.entries(o.byCrit).map(([c, n]) => ({ label: c, value: n, color: CRIT_COLORS[c] }));
  const lastSweep = d.news[0]?.created_at ? new Date(d.news[0].created_at).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <>
      <h1 className="pagetitle">Overview</h1>
      <p className="pagesub">Everything ZagaPrime runs, in one place. {lastSweep ? `Last news sweep: ${lastSweep} ET.` : 'News agent has not run yet.'}</p>

      <div className="stats">
        <Stat v={d.projects.length} l="Projects" />
        <Stat v={d.accounts.length} l="Accounts" />
        <Stat v={d.resources.length} l="Resources" />
        <Stat v={o.prod.length} l="In production" />
        <Stat v={o.unmapped.length} l="Unmapped" />
        <Stat v={o.openNews.length} l="Open updates" />
      </div>

      <div className="charts">
        <div className="chartcard"><h3>Resources by provider</h3><BarList items={provBars} /></div>
        <div className="chartcard"><h3>Environments</h3><Donut parts={envParts} /></div>
        <div className="chartcard"><h3>Open updates by criticality</h3><Donut parts={critParts} /></div>
      </div>

      <h2 className="viewtitle">Needs attention</h2>
      <div className="flags">
        {o.flags.length === 0 && <div className="empty">All clear — nothing flagged.</div>}
        {o.flags.map((f, i) => (
          <div className={`flagrow ${f.level}`} key={i}>
            <div><div className="ft">{f.title}</div><div className="fd">{f.detail}</div></div>
          </div>
        ))}
      </div>

      <h2 className="viewtitle">Project progress — hosting · database · domain · repo</h2>
      <div className="progrows">
        {o.progress.map((p) => (
          <div className="prog" key={p.slug}>
            <div>
              <div className="pn">{p.name}</div>
              <div className="pc">{p.resCount} resources{p.newsCount ? ` · ${p.newsCount} open update${p.newsCount === 1 ? '' : 's'}` : ''}</div>
            </div>
            <div className="ptrack"><span className="pfill" style={{ width: `${(p.score / 4) * 100}%`, background: p.score === 4 ? 'var(--ok)' : p.score >= 2 ? 'var(--warn)' : 'var(--flag)' }} /></div>
            <div className="pbadges">
              {['hosting', 'database', 'domain', 'repo'].map((k) => (
                <span key={k} className={`pb ${p.has[k] ? 'on' : ''}`}>{k}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className="viewtitle">Domain health — lowest scores first</h2>
      <div className="domwrap">
        <table className="domtable">
          <thead><tr><th>Domain</th><th>Status</th><th>Security</th><th>Compliance</th><th>SEO</th><th>Perf</th><th>Risk posture</th></tr></thead>
          <tbody>
            {[...d.domains]
              .sort((a, b) => (minScore(a) ?? 101) - (minScore(b) ?? 101))
              .map((x) => (
                <tr key={x.domain}>
                  <td className="mono"><Link href="/domains">{x.domain}</Link></td>
                  <td><span className={`pill ${x.status || 'unknown'}`}>{x.status || '—'}</span></td>
                  {['score_security', 'score_compliance', 'score_seo', 'score_performance', 'score_risk'].map((k) => (
                    <td key={k} style={{ fontVariantNumeric: 'tabular-nums', color: x[k] == null ? 'var(--faint)' : x[k] >= 80 ? 'var(--ok)' : x[k] >= 60 ? 'var(--fg)' : x[k] >= 40 ? 'var(--warn)' : 'var(--flag)' }}>{x[k] ?? '—'}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="pagesub" style={{ marginTop: 26 }}>
        Source of truth: schema <span className="mono">proj_opsdash</span> on the shared Supabase host. Edit everything under{' '}
        <Link href="/projects">Projects</Link> and <Link href="/accounts">Accounts</Link>. Credentials never leave Bitwarden.
      </p>
    </>
  );
}

function minScore(x) {
  const vals = ['score_security', 'score_compliance', 'score_performance', 'score_risk'].map((k) => x[k]).filter((v) => v != null);
  return vals.length ? Math.min(...vals) : null;
}

function Stat({ v, l }) {
  return (
    <div className="stat"><div className="v">{v}</div><div className="l">{l}</div></div>
  );
}
