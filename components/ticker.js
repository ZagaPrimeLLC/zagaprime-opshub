'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

function hrefFor(it) {
  if (it.video) return { href: `/channel?play=${encodeURIComponent(it.video)}`, internal: true };
  if (it.kind === 'podcast') return { href: '/channel?tab=podcast', internal: true };
  return { href: it.url, internal: false };
}

function Card({ it }) {
  const { href, internal } = hrefFor(it);
  const inner = (
    <>
      <span className="tthumb">
        {it.image && <img src={it.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
        {it.video && (
          <span className="play"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg></span>
        )}
      </span>
      <span className="tmeta">
        <span className="tsrc">{it.source}{it.kind === 'podcast' ? ' · podcast' : it.video ? ' · video' : ''}</span>
        <span className="ttitle">{it.title}</span>
      </span>
    </>
  );
  return internal
    ? <Link className="tcard" href={href} title={it.title}>{inner}</Link>
    : <a className="tcard" href={href} target="_blank" rel="noopener noreferrer" title={it.title}>{inner}</a>;
}

function AlertCard({ a }) {
  return (
    <Link className="tcard" href={`/news?crit=${a.criticality}`} title={a.title}>
      <span className="tthumb" style={{ display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 11, color: '#fff', background: a.criticality === 'critical' ? 'var(--flag)' : 'var(--warn)' }}>
        {a.criticality === 'critical' ? 'CRIT' : 'HIGH'}
      </span>
      <span className="tmeta">
        <span className="tsrc alert">Stack alert · {a.effort || 'action needed'}</span>
        <span className="ttitle">{a.title}</span>
      </span>
    </Link>
  );
}

export default function Ticker() {
  const pathname = usePathname();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/feed?limit=36&mix=1')
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j) => { if (alive) { setData(j); setFailed(false); } })
        .catch(() => { if (alive) setFailed(true); });
    load();
    const t = setInterval(load, 15 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (pathname === '/login') return null;

  const items = data?.items || [];
  const alerts = data?.alerts || [];
  const cards = [
    ...alerts.map((a) => <AlertCard key={'a' + a.id} a={a} />),
    ...items.map((it) => <Card key={it.id} it={it} />),
  ];
  const dur = `${Math.max(60, cards.length * 6)}s`;

  return (
    <div className="ticker" aria-label="Live tech and AI news">
      <Link className="ticker-label" href="/channel"><span className="dot" />Live</Link>
      <div className="ticker-viewport">
        {cards.length ? (
          <div className="ticker-track" style={{ '--dur': dur }}>
            {cards}
            {cards.map((c, i) => <span key={'dup' + i} aria-hidden="true" style={{ display: 'contents' }}>{c}</span>)}
          </div>
        ) : (
          <div className="ticker-empty">
            {failed ? 'News feed is unavailable right now. Open the Channel to retry.'
              : data ? 'No headlines yet. Open the Channel to manage sources.'
              : 'Loading today’s tech, AI and deployment headlines…'}
          </div>
        )}
      </div>
      <Link className="ticker-more" href="/channel">Channel →</Link>
    </div>
  );
}
