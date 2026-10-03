'use client';
import { useMemo, useState } from 'react';
import { Pchip, Pill, Ext } from '@/components/bits';
import { api } from '@/components/crud';

const CRITS = ['critical', 'high', 'medium', 'low'];
const OPEN = ['new', 'reviewed', 'in-progress'];

export default function NewsView({ initial }) {
  const [news, setNews] = useState(initial.news);
  const [crit, setCrit] = useState('all');
  const [bucket, setBucket] = useState('open'); // open | done | dismissed | all
  const [busyId, setBusyId] = useState(null);
  const projBy = useMemo(() => Object.fromEntries(initial.projects.map((p) => [p.slug, p])), [initial.projects]);
  const provBy = useMemo(() => Object.fromEntries(initial.providers.map((p) => [p.slug, p])), [initial.providers]);

  const lastSweep = news[0]?.created_at
    ? new Date(news[0].created_at).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET'
    : null;

  async function setStatus(item, status) {
    setBusyId(item.id);
    try {
      const { row } = await api('stack_news', 'PATCH', { __id: item.id, status });
      setNews((ns) => ns.map((n) => (n.id === row.id ? row : n)));
    } catch (e) { alert(e.message); }
    setBusyId(null);
  }

  const shown = news.filter((n) => {
    if (crit !== 'all' && n.criticality !== crit) return false;
    if (bucket === 'open') return OPEN.includes(n.status);
    if (bucket === 'all') return true;
    return n.status === bucket;
  });

  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  shown.sort((a, b) => (order[a.criticality] - order[b.criticality]) || (new Date(b.created_at) - new Date(a.created_at)));

  return (
    <>
      <h1 className="pagetitle">Stack news</h1>
      <p className="pagesub">
        The update agent scans your providers daily, rates each item by criticality and time to implement, and tags the projects it touches.
        {lastSweep ? ` Last sweep: ${lastSweep}.` : ' No sweeps yet — the first one lands with the morning run.'}
      </p>

      <div className="chips">
        {['all', ...CRITS].map((c) => (
          <button key={c} className="chip" aria-pressed={crit === c} onClick={() => setCrit(c)}>{c}</button>
        ))}
        <span style={{ width: 10 }} />
        {['open', 'done', 'dismissed', 'all'].map((b) => (
          <button key={b} className="chip" aria-pressed={bucket === b} onClick={() => setBucket(b)}>{b}</button>
        ))}
      </div>

      <div className="newslist">
        {shown.length === 0 && <div className="empty">Nothing here. {bucket === 'open' ? 'All caught up.' : ''}</div>}
        {shown.map((n) => (
          <div className="newsitem" key={n.id}>
            <div className="newstop">
              <Pill kind={n.criticality} />
              {n.provider_slug && <Pchip slug={n.provider_slug} name={provBy[n.provider_slug]?.name} />}
              <span className="nt">{n.url ? <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title} <Ext /></a> : n.title}</span>
              {n.category && <Pill kind="ghost">{n.category}</Pill>}
              {n.effort && <Pill kind="blue">⏱ {n.effort}</Pill>}
            </div>
            {n.summary && <p className="newssum">{n.summary}</p>}
            {n.action && <p className="newsact"><b>Do:</b> {n.action}</p>}
            <div className="newsmeta">
              {n.published_at && <span>published {n.published_at}</span>}
              {(n.affected_projects || []).length > 0 && (
                <span>affects: {(n.affected_projects || []).map((s) => projBy[s]?.name || s).join(', ')}</span>
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
