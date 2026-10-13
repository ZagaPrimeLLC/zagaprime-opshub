'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Pill, Ext } from '@/components/bits';
import { mdToHtml } from '@/lib/markdown';

const ACTIVE = ['queued', 'picked-up', 'in-progress'];
const LABEL = {
  queued: 'Queued',
  'picked-up': 'Picked up',
  'in-progress': 'Working',
  'pr-open': 'PR ready for review',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
const POLL_MS = 30_000;

function ago(ts) {
  if (!ts) return null;
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function PrLinks({ links }) {
  if (!Array.isArray(links) || !links.length) return null;
  return (
    <div className="ezralinks">
      {links.map((l, i) => {
        const href = typeof l === 'string' ? l : l?.url;
        const label = typeof l === 'string' ? l.replace(/^https?:\/\/(www\.)?/, '') : (l?.label || l?.url);
        return href ? <a key={i} href={href} target="_blank" rel="noopener noreferrer">{label} <Ext /></a> : null;
      })}
    </div>
  );
}

function Job({ job, item, onCancel, busy }) {
  const kind = job.status === 'pr-open' ? ' pr' : job.status === 'failed' ? ' failed' : '';
  return (
    <div className="newsitem">
      <div className="newstop">
        <span className={`ezrabadge${kind}`}><span className="edot" />{LABEL[job.status] || job.status}</span>
        {item?.criticality && <Pill kind={item.criticality} />}
        <span className="nt">{job.title}</span>
        <span className="mono ezrajobid">job {job.id}</span>
      </div>
      {job.instruction && <p className="newsact"><b>Instruction:</b> {job.instruction}</p>}
      <div className="newsmeta">
        <span>requested {ago(job.requested_at)}</span>
        {job.updated_at && <span>updated {ago(job.updated_at)}</span>}
        {item && (
          <span>from <Link href="/news">stack update</Link>{item.url && <> · <a href={item.url} target="_blank" rel="noopener noreferrer">advisory <Ext /></a></>}</span>
        )}
        {(item?.affected_projects || []).length > 0 && (
          <span>affects:{' '}
            {item.affected_projects.map((s, i) => <span key={s}>{i > 0 && ', '}<Link href={`/projects?focus=${s}`}>{s}</Link></span>)}
          </span>
        )}
      </div>
      <PrLinks links={job.pr_links} />
      {job.result_md && <div className="ezraresult briefbody" dangerouslySetInnerHTML={{ __html: mdToHtml(job.result_md) }} />}
      {job.status === 'queued' && (
        <div className="newsbtns">
          <button className="btn sm" disabled={busy} onClick={() => onCancel(job)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default function EzraView({ initial }) {
  const [jobs, setJobs] = useState(initial.jobs);
  const [lastCheck] = useState(initial.lastCheck);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');
  const [, tick] = useState(0);

  const newsBy = useMemo(() => Object.fromEntries(initial.news.map((n) => [n.id, n])), [initial.news]);

  // Keep the page live: refresh the job list every 30s while it is open.
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch('/api/ezra/queue?status=all', { cache: 'no-store' });
        if (res.ok) { const d = await res.json(); if (Array.isArray(d.jobs)) setJobs(d.jobs); }
      } catch {}
      tick((n) => n + 1);
    }, POLL_MS);
    return () => clearInterval(t);
  }, []);

  async function cancel(job) {
    setBusyId(job.id); setErr('');
    try {
      const res = await fetch('/api/ezra/queue', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: job.id, status: 'cancelled' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not cancel');
      setJobs((js) => js.map((j) => (j.id === data.job.id ? data.job : j)));
    } catch (e) { setErr(e.message); }
    setBusyId(null);
  }

  const active = jobs.filter((j) => ACTIVE.includes(j.status));
  const review = jobs.filter((j) => j.status === 'pr-open');
  const history = jobs.filter((j) => !ACTIVE.includes(j.status) && j.status !== 'pr-open').slice(0, 30);
  const stale = !lastCheck || Date.now() - new Date(lastCheck).getTime() > 2 * 3600 * 1000;

  const section = (title, list, empty) => (
    <section className="ezrasection">
      <h2 className="ezrah">{title} <span className="mono">{list.length}</span></h2>
      <div className="newslist">
        {list.length === 0 && <div className="empty">{empty}</div>}
        {list.map((j) => <Job key={j.id} job={j} item={newsBy[j.news_id]} onCancel={cancel} busy={busyId === j.id} />)}
      </div>
    </section>
  );

  return (
    <>
      <h1 className="pagetitle">Ezra activity</h1>
      <p className="pagesub">
        Everything Ezra is working on. Queue a fix with <b>✦ Fix with Ezra</b> on a <Link href="/news" style={{ color: 'var(--accent)' }}>stack update</Link> or
        by asking Ezra in the chat. The worker picks jobs up, patches the affected repos on a branch, and opens PRs here for your review.
      </p>
      <div className="ezrastats">
        <span className="briefstat"><b>{active.length}</b> active</span>
        <span className="briefstat"><b>{review.length}</b> ready for review</span>
        <span className={`briefstat${stale ? ' warn' : ''}`}>
          worker last checked: <b>{lastCheck ? ago(lastCheck) : 'not yet'}</b>
        </span>
      </div>
      {err && <p style={{ color: 'var(--flag)', fontSize: 13 }}>{err}</p>}
      {section('Ready for your review', review, 'No PRs waiting on you.')}
      {section('Active', active, 'Nothing queued or in progress. Ask Ezra to fix something, or use ✦ Fix with Ezra on a stack update.')}
      {section('Recent', history, 'No finished jobs yet.')}
    </>
  );
}
