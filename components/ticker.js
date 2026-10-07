'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

function hrefFor(it) {
  if (it.video) return { href: `/channel?play=${encodeURIComponent(it.video)}`, internal: true };
  if (it.kind === 'podcast') return { href: '/channel?tab=podcast', internal: true };
  return { href: it.url, internal: false };
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

// Real artwork first (feed image or the page's preview image), then the site's own icon.
function Thumb({ image, url, video, badge }) {
  const [broken, setBroken] = useState(false);
  const host = hostOf(url);
  const showImg = image && !broken;
  return (
    <span className="tthumb">
      {showImg
        ? <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : host && <span className="tfav"><img src={`https://www.google.com/s2/favicons?domain=${host}&sz=128`} alt="" loading="lazy" referrerPolicy="no-referrer" /></span>}
      {video && (
        <span className="play"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg></span>
      )}
      {badge && <span className={`tbadge ${badge}`}>{badge === 'critical' ? 'Critical' : 'High'}</span>}
    </span>
  );
}

function Card({ it }) {
  const { href, internal } = hrefFor(it);
  const inner = (
    <>
      <Thumb image={it.image} url={it.url} video={it.video} />
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
    <Link className="tcard alert" href={`/news?crit=${a.criticality}`} title={a.title}>
      <Thumb image={a.image} url={a.url} badge={a.criticality} />
      <span className="tmeta">
        <span className="tsrc alert">{a.provider ? `${a.provider} · ` : 'Stack alert · '}{a.effort || 'action needed'}</span>
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
  const dur = `${Math.max(90, cards.length * 8)}s`;

  return (
    <div className="ticker" aria-label="Live tech and AI news">
      <Link className="ticker-label" href="/channel"><span className="tl-main"><span className="dot" />Live</span><span className="tl-sub">Tech · AI · Dev</span></Link>
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
      <Link className="ticker-more" href="/channel">All news →</Link>
    </div>
  );
}
