'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Pchip, Pill, Ext } from '@/components/bits';
import { api } from '@/components/crud';

const CRITS = ['critical', 'high', 'medium', 'low'];
const OPEN = ['new', 'reviewed', 'in-progress'];

export default function NewsView({ initial, params }) {
  const [news, setNews] = useState(initial.news);
  const [crit, setCrit] = useState(['all', ...CRITS].includes(params.crit) ? params.crit : 'all');
  const [bucket, setBucket] = useState(['open', 'done', 'dismissed', 'all'].includes(params.bucket) ? params.bucket : 'open');
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');
  const projBy = useMemo(() => Object.fromEntries(initial.projects.map((p) => [p.slug, p])), [initial.projects]);
  const provBy = useMemo(() => Object.fromEntries(initial.providers.map((p) => [p.slug, p])), [initial.providers]);

  const lastSweep = news[0]?.created_at
    ? new Date(news[0].created_at).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET'
    : null;

  function sync(c, b) {
    const sp = new URLSearchParams();
    if (c !== 'all') sp.set('crit', c);
    if (b !== 'open') sp.set('bucket', b);
    if (params.project) sp.set('project', params.project);
    window.history.replaceState(null, '', `/news${sp.toString() ? '?' + sp : ''}`);
  }

  async function setStatus(item, status) {
    setBusyId(item.id); setErr('');
    try {
      const { row } = await api('stack_news', 'PATCH', { __id: item.id, status });
      setNews((ns) => ns.map((n) => (n.id === row.id ? row : n)));
    } catch (e) { setErr(e.message); }
    setBusyId(null);
  }

  const inBucket = (n) => (bucket === 'open' ? OPEN.includes(n.status) : bucket === 'all' ? true : n.status === bucket);
  const shown = news.filter((n) =>
    (crit === 'all' || n.criticality === crit) && inBucket(n) &&
    (!params.project || (n.affected_projects || []).includes(params.project))
  );
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  shown.sort((a, b) => (order[a.criticality] - order[b.criticality]) || (new Date(b.created_at) - new Date(a.created_at)));
  const count = (c) => news.filter((n) => (c === 'all' || n.criticality === c) && inBucket(n) && (!params.project || (n.affected_projects || []).includes(params.project))).length;

  return (
    <>
      <h1 className="pagetitle">Stack updates</h1>
      <p className="pagesub">
        The update agent scans your providers every morning, rates each item by criticality and time to implement, and tags the projects it touches.
        {lastSweep ? ` Last sweep: ${lastSweep}.` : ' No sweeps yet.'} For general tech and AI news, open the <Link href="/channel" style={{ color: 'var(--accent)' }}>Channel</Link>.
      </p>

      {params.project && (
        <div className="filterchips">
          <span className="fchip" style={{ paddingRight: 11 }}>Project: {projBy[params.project]?.name || params.project}</span>
          <Link className="fchip" href="/news">Clear filters <span>×</span></Link>
        </div>
      )}

      <div className="chips">
        {['all', ...CRITS].map((c) => (
          <button key={c} className="chip" aria-pressed={crit === c} onClick={() => { setCrit(c); sync(c, bucket); }}>{c} · {count(c)}</button>
        ))}
        <span style={{ width: 10 }} />
        {['open', 'done', 'dismissed', 'all'].map((b) => (
          <button key={b} className="chip" aria-pressed={bucket === b} onClick={() => { setBucket(b); sync(crit, b); }}>{b}</button>
        ))}
      </div>
      {err && <p style={{ color: 'var(--flag)', fontSize: 13 }}>{err}</p>}

      <div className="newslist">
        {shown.length === 0 && <div className="empty">Nothing here. {bucket === 'open' ? 'All caught up.' : ''}</div>}
        {shown.map((n) => (
          <div className="newsitem" key={n.id}>
            <div className="newstop">
              <Pill kind={n.criticality} />
              {n.provider_slug && <Link href={`/projects?provider=${n.provider_slug}`} title={`Your ${provBy[n.provider_slug]?.name || n.provider_slug} resources`}><Pchip slug={n.provider_slug} name={provBy[n.provider_slug]?.name} /></Link>}
              <span className="nt">{n.url ? <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title} <Ext /></a> : n.title}</span>
              {n.category && <Pill kind="ghost">{n.category}</Pill>}
              {n.effort && <Pill kind="blue">⏱ {n.effort}</Pill>}
            </div>
            {n.summary && <p className="newssum">{n.summary}</p>}
            {n.action && <p className="newsact"><b>Do:</b> {n.action}</p>}
            <div className="newsmeta">
              {n.published_at && <span>published {String(n.published_at).slice(0, 10)}</span>}
              {(n.affected_projects || []).length > 0 && (
                <span>affects:{' '}
                  {(n.affected_projects || []).map((s, i) => <span key={s}>{i > 0 && ', '}<Link href={`/projects?focus=${s}`}>{projBy[s]?.name || s}</Link></span>)}
                </span>
              )}
              <span className="mono">status: {n.status}</span>
            </div>
            <div className="newsbtns">
              {n.status !== 'reviewed' && OPEN.includes(n.status) && <button className="btn sm" disabled={busyId === n.id} onClick={() => setStatus(n, 'reviewed')}>Mark reviewed</button>}
              {n.status !== 'in-progress' && <button className="btn sm" disabled={busyId === n.id} onClick={() => setStatus(n, 'in-progress')}>In progress</button>}
              {n.status !== 'done' && <button className="btn sm primary" disabled={busyId === n.id} onClick={() => setStatus(n, 'done')}>Done</button>}
              {n.status !== 'dismissed' && <button className="btn sm danger" disabled={busyId === n.id} onClick={() => setStatus(n, 'dismissed')}>Dismiss</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
