'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EntityForm, api } from '@/components/crud';
import { Pill } from '@/components/bits';

const TABS = [
  { k: 'all', l: 'All' },
  { k: 'video', l: 'Videos' },
  { k: 'ai', l: 'AI' },
  { k: 'tech', l: 'Tech' },
  { k: 'dev', l: 'Dev & deploys' },
  { k: 'podcast', l: 'Podcasts' },
];

function matches(it, tab) {
  if (tab === 'all') return true;
  if (tab === 'video') return it.kind === 'video';
  if (tab === 'podcast') return it.kind === 'podcast';
  return it.category === tab && it.kind === 'article';
}

export function timeAgo(iso) {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Thumb({ it, big }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="fthumb">
      {it.image && !broken
        ? <img src={it.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : <div className="fallback">{it.source}</div>}
      <span className="fkind">{it.kind === 'video' ? 'Video' : it.kind === 'podcast' ? 'Podcast' : it.category === 'dev' ? 'Dev' : it.category.toUpperCase()}</span>
      {it.video && (
        <span className="play"><span><svg width={big ? 22 : 18} height={big ? 22 : 18} viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg></span></span>
      )}
    </div>
  );
}

function FeedCard({ it, onPlay }) {
  const body = (
    <>
      <Thumb it={it} />
      <div className="fbody">
        <div className="fsrc"><b>{it.source}</b><span>· {timeAgo(it.date)}</span></div>
        <div className="ftitle">{it.title}</div>
        {it.summary && it.kind !== 'video' && <p className="fsum">{it.summary}</p>}
        {it.audio && <audio controls preload="none" src={it.audio} onClick={(e) => e.stopPropagation()} />}
      </div>
    </>
  );
  if (it.video) return <button className="fcard clicky" onClick={() => onPlay(it)}>{body}</button>;
  if (it.audio) return <div className="fcard">{body}<div style={{ padding: '0 14px 12px' }}><a className="btn sm" href={it.url} target="_blank" rel="noopener noreferrer">Episode page ↗</a></div></div>;
  return <a className="fcard clicky" href={it.url} target="_blank" rel="noopener noreferrer">{body}</a>;
}

function Hero({ slides, onPlay }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [paused, slides.length]);
  if (!slides.length) return null;
  return (
    <div className="ch-hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {slides.map((s, idx) => {
        const inner = (
          <>
            <img src={s.image} alt="" referrerPolicy="no-referrer" />
            <span className="shade" />
            <span className="cap">
              <span className="src">{s.source} · {timeAgo(s.date)}</span>
              <h2>{s.title}</h2>
              {s.summary && <p>{s.summary}</p>}
            </span>
            {s.video && <span className="bigplay"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg></span>}
          </>
        );
        return s.video
          ? <button key={s.id} className={`ch-slide ${idx === i ? 'on' : ''}`} onClick={() => onPlay(s)} tabIndex={idx === i ? 0 : -1} aria-hidden={idx !== i}>{inner}</button>
          : <a key={s.id} className={`ch-slide ${idx === i ? 'on' : ''}`} href={s.url} target="_blank" rel="noopener noreferrer" tabIndex={idx === i ? 0 : -1} aria-hidden={idx !== i}>{inner}</a>;
      })}
      <div className="ch-dots">
        {slides.map((s, idx) => <button key={s.id} className={idx === i ? 'on' : ''} onClick={() => setI(idx)} aria-label={`Slide ${idx + 1}`} />)}
      </div>
      <button className="ch-nav prev" onClick={() => setI((x) => (x - 1 + slides.length) % slides.length)} aria-label="Previous">‹</button>
      <button className="ch-nav next" onClick={() => setI((x) => (x + 1) % slides.length)} aria-label="Next">›</button>
    </div>
  );
}

function Player({ item, onClose }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title || 'Video'}>
      <div className="modalbox" onClick={(e) => e.stopPropagation()}>
        <div className="vid">
          <iframe src={`https://www.youtube-nocookie.com/embed/${item.video}?autoplay=1&rel=0`} title={item.title || 'Video'}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        </div>
        <div className="modalbar">
          <span className="t">{item.title || 'Video'}</span>
          {item.url && <a className="btn sm" href={item.url} target="_blank" rel="noopener noreferrer">YouTube ↗</a>}
          <button className="btn sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ChannelView({ feed, sources: initialSources, alerts, params }) {
  const router = useRouter();
  const [tab, setTab] = useState(TABS.some((t) => t.k === params.tab) ? params.tab : 'all');
  const [playing, setPlaying] = useState(() => {
    if (!params.play) return null;
    return feed.items.find((i) => i.video === params.play) || { video: params.play, title: '' };
  });
  const [sources, setSources] = useState(initialSources);
  const [editing, setEditing] = useState(null);
  const [showSources, setShowSources] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const status = useMemo(() => Object.fromEntries(feed.sources.map((s) => [s.id, s])), [feed.sources]);
  const items = feed.items.filter((it) => matches(it, tab));
  const slides = useMemo(() => {
    const withImg = feed.items.filter((i) => i.image);
    const vids = withImg.filter((i) => i.video).slice(0, 3);
    const ai = withImg.filter((i) => !i.video && i.category === 'ai').slice(0, 2);
    const rest = withImg.filter((i) => !vids.includes(i) && !ai.includes(i)).slice(0, 6 - vids.length - ai.length);
    return [...ai, ...vids, ...rest].sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0)).slice(0, 6);
  }, [feed.items]);

  function play(it) {
    setPlaying(it);
    window.history.replaceState(null, '', `/channel?play=${encodeURIComponent(it.video)}`);
  }
  function close() {
    setPlaying(null);
    window.history.replaceState(null, '', `/channel${tab !== 'all' ? `?tab=${tab}` : ''}`);
  }
  function pickTab(k) {
    setTab(k);
    window.history.replaceState(null, '', `/channel${k !== 'all' ? `?tab=${k}` : ''}`);
  }
  async function refresh() {
    setRefreshing(true);
    try { await fetch('/api/feed?refresh=1&limit=1'); } catch {}
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }
  async function toggle(s) {
    const { row } = await api('feed_sources', 'PATCH', { __id: s.id, enabled: !s.enabled });
    setSources((ss) => ss.map((x) => (x.id === row.id ? row : x)));
  }

  const fields = [
    { name: 'name', label: 'Name' },
    { name: 'kind', label: 'Type', type: 'select', options: [{ v: 'rss', l: 'News / blog RSS' }, { v: 'youtube', l: 'YouTube channel feed' }, { v: 'podcast', l: 'Podcast RSS' }] },
    { name: 'category', label: 'Category', type: 'select', options: [{ v: 'tech', l: 'Tech' }, { v: 'ai', l: 'AI' }, { v: 'dev', l: 'Dev & deploys' }, { v: 'video', l: 'Video' }, { v: 'podcast', l: 'Podcast' }] },
    { name: 'url', label: 'Feed URL', wide: true, placeholder: 'https://… (YouTube: https://www.youtube.com/feeds/videos.xml?channel_id=…)' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  const healthy = feed.sources.filter((s) => s.ok).length;

  return (
    <>
      <h1 className="pagetitle">The ZP Channel</h1>
      <p className="pagesub">
        Your daily feed for tech, AI, deployments and learning: news, videos and podcasts from {feed.sources.length} free sources,
        refreshed every 20 minutes. {healthy}/{feed.sources.length} sources live · updated {timeAgo(feed.fetchedAt)}.{' '}
        <button className="btn sm" onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh now'}</button>
      </p>

      {alerts.length > 0 && (
        <div className="alertstrip">
          {alerts.map((a) => (
            <Link key={a.id} href={`/news?crit=${a.criticality}`}><Pill kind={a.criticality} />{a.title}</Link>
          ))}
        </div>
      )}

      <Hero slides={slides} onPlay={play} />

      <div className="chips" role="tablist">
        {TABS.map((t) => {
          const n = feed.items.filter((it) => matches(it, t.k)).length;
          return <button key={t.k} className="chip" aria-pressed={tab === t.k} onClick={() => pickTab(t.k)}>{t.l} · {n}</button>;
        })}
        <button className="chip" style={{ marginLeft: 'auto' }} onClick={() => setShowSources((v) => !v)}>
          {showSources ? 'Hide sources' : `Manage sources (${sources.length})`}
        </button>
      </div>

      {showSources && (
        <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
          <div className="addbar" style={{ margin: 0, padding: '12px 14px' }}>
            <span className="muted" style={{ fontSize: 13, flex: 1 }}>Add any free RSS, YouTube channel or podcast feed. Changes show up on the next refresh.</span>
            <button className="btn primary sm" onClick={() => setEditing('new')}>+ Add source</button>
          </div>
          {editing === 'new' && (
            <EntityForm entity="feed_sources" row={{ kind: 'rss', category: 'tech' }} fields={fields} pk="id" isNew
              onSaved={(row) => { setSources((ss) => [...ss, row]); setEditing(null); }} onCancel={() => setEditing(null)} />
          )}
          <div style={{ overflowX: 'auto' }}>
            <table className="srctable">
              <thead><tr><th>Source</th><th>Type</th><th>Status</th><th>On</th><th></th></tr></thead>
              <tbody>
                {sources.map((s) => {
                  const st = status[s.id];
                  if (editing === s.id) {
                    return (
                      <tr key={s.id}><td colSpan={5} style={{ padding: 0 }}>
                        <EntityForm entity="feed_sources" row={s} fields={fields} pk="id"
                          onSaved={(row) => { setSources((ss) => ss.map((x) => (x.id === row.id ? row : x))); setEditing(null); }}
                          onCancel={() => setEditing(null)}
                          onDeleted={(row) => { setSources((ss) => ss.filter((x) => x.id !== row.id)); setEditing(null); }} />
                      </td></tr>
                    );
                  }
                  return (
                    <tr key={s.id}>
                      <td><b style={{ fontWeight: 600 }}>{s.name}</b><div className="faint mono" style={{ fontSize: 10.5, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div></td>
                      <td><Pill kind="ghost">{s.kind} · {s.category}</Pill></td>
                      <td style={{ fontSize: 12 }}>
                        {!s.enabled ? <span className="faint">off</span>
                          : !st ? <span className="faint">next refresh</span>
                          : st.ok ? <><span className="okdot" style={{ background: 'var(--ok)' }} />{st.count} items</>
                          : <><span className="okdot" style={{ background: 'var(--flag)' }} /><span className="muted">{st.error}</span></>}
                      </td>
                      <td><input type="checkbox" checked={s.enabled} onChange={() => toggle(s)} aria-label={`Enable ${s.name}`} /></td>
                      <td><button className="btn sm" onClick={() => setEditing(s.id)}>Edit</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="feedgrid">
        {items.map((it) => <FeedCard key={it.id} it={it} onPlay={play} />)}
      </div>
      {!items.length && <div className="empty">Nothing in this lane yet. Try Refresh, or add a source.</div>}

      {playing && <Player item={playing} onClose={close} />}
    </>
  );
}
