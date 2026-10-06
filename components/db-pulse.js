'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Pchip, Ext } from '@/components/bits';

const TZ = 'America/New_York';
const DAY = 86400000;
const PAUSE_DAYS = 7; // Supabase pauses free projects after a week without activity
const CRON_UTC = { h: 11, m: 23 }; // vercel.json

const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const dayLabel = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmtTime = (iso) => new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function ago(iso, now) {
  if (!iso) return 'never';
  const s = (now - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function nextCron(now) {
  const d = new Date(now);
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), CRON_UTC.h, CRON_UTC.m);
  return t > now ? t : t + DAY;
}

function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}

function fixFor(note, status) {
  if (status === 404 || /not installed/i.test(note || '')) return 'Run supabase_keepalive.sql in this project’s SQL editor.';
  if (status === 401 || status === 403) return 'Replace the publishable key on this resource.';
  if (/paused/i.test(note || '')) return 'Restore the project in the Supabase dashboard, then ping again.';
  if (/ref/i.test(note || '')) return 'Add the project ref to this resource.';
  if (/timed out|unreachable/i.test(note || '')) return 'Check the project is running and the ref is right.';
  return 'Open the project and check its status.';
}

function engine(kind) {
  if (/supabase/i.test(kind)) return 'Supabase';
  if (/neon/i.test(kind)) return 'Neon';
  if (/d1/i.test(kind)) return 'Cloudflare D1';
  if (/sqlite/i.test(kind)) return 'SQLite';
  if (/postgres/i.test(kind)) return 'PostgreSQL';
  return kind;
}

function unwatchedReason(r, hubRef) {
  if (hubRef && r.external_ref === hubRef) return { level: 'ok', text: 'This dashboard’s own database. Every page load and the daily cron query it, so it never goes idle.' };
  if (/supabase/i.test(r.kind)) return r.has_key
    ? { level: 'warn', text: 'Key saved but keep-alive is switched off — it can pause after 7 quiet days.' }
    : { level: 'flag', text: 'Not protected — free Supabase projects pause after 7 days without traffic. Add its publishable key.' };
  if (/neon/i.test(r.kind)) return { level: 'ok', text: 'Neon sleeps when idle and wakes on the next query. No pause risk.' };
  if (/d1/i.test(r.kind)) return { level: 'ok', text: 'Cloudflare D1 never pauses.' };
  if (/sqlite/i.test(r.kind)) return { level: 'ok', text: 'Local file on its host machine. Nothing to keep awake.' };
  if (/postgres/i.test(r.kind)) return { level: 'ok', text: 'Self-hosted and always on. Covered by its host’s own monitoring.' };
  return { level: 'ok', text: 'No keep-alive needed.' };
}

/* ---------- small visual pieces ---------- */

function FleetRing({ awake, total }) {
  const r = 52, c = 2 * Math.PI * r;
  const pct = total ? awake / total : 0;
  return (
    <svg className="dp-ring" viewBox="0 0 132 132" role="img" aria-label={`${awake} of ${total} databases awake`}>
      <defs>
        <linearGradient id="dp-ring-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14d4ff" /><stop offset=".45" stopColor="#5f63ff" />
          <stop offset=".72" stopColor="#a52cff" /><stop offset="1" stopColor="#ff00c8" />
        </linearGradient>
      </defs>
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
      <circle cx="66" cy="66" r={r} fill="none" stroke="url(#dp-ring-grad)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 66 66)" className="dp-ring-arc" />
      <text x="66" y="62" textAnchor="middle" className="dp-ring-v">{awake}<tspan className="dp-ring-of">/{total}</tspan></text>
      <text x="66" y="84" textAnchor="middle" className="dp-ring-l">AWAKE</text>
    </svg>
  );
}

function Sparkline({ points }) {
  const [hover, setHover] = useState(null);
  if (points.length < 2) {
    return <div className="dp-spark-empty">Latency chart fills in as daily pings land.</div>;
  }
  const W = 240, H = 56, pad = 6;
  const vals = points.map((p) => p.ms);
  const max = Math.max(...vals), min = Math.min(...vals);
  const span = Math.max(1, max - min);
  const xy = points.map((p, i) => [(i / (points.length - 1)) * W, pad + (1 - (p.ms - min) / span) * (H - pad * 2)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const h = hover != null ? xy[hover] : null;

  function move(e) {
    const b = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - b.left) / b.width) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  return (
    <div className="dp-spark" onMouseMove={move} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="dp-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--cyan)" stopOpacity=".28" /><stop offset="1" stopColor="var(--cyan)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#dp-spark-fill)" />
        <path d={line} fill="none" stroke="var(--cyan)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {h && <line x1={h[0]} x2={h[0]} y1="0" y2={H} stroke="var(--line2)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      {h && (
        <>
          <span className="dp-spark-dot" style={{ left: `${(h[0] / W) * 100}%`, top: `${(h[1] / H) * 100}%` }} />
          <span className={`dp-tip ${h[0] / W > 0.6 ? 'left' : ''}`} style={{ left: `${(h[0] / W) * 100}%` }}>
            <b>{points[hover].ms} ms</b>{fmtTime(points[hover].at)}
          </span>
        </>
      )}
      <span className="dp-spark-scale mono">{min}–{max} ms</span>
    </div>
  );
}

function UptimeStrip({ days, byDay }) {
  return (
    <div className="dp-strip" role="list" aria-label="Daily keep-alive results, last 30 days">
      {days.map((k) => {
        const d = byDay[k];
        const state = !d ? 'none' : d.fail === 0 ? 'ok' : d.ok === 0 ? 'fail' : 'mixed';
        const label = !d ? `${dayLabel(k)}: no ping` : `${dayLabel(k)}: ${d.ok} answered, ${d.fail} failed`;
        return <span key={k} role="listitem" className={`dp-cell ${state}`} title={label} aria-label={label} />;
      })}
    </div>
  );
}

function DailyCalls({ days, totals }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...days.map((k) => (totals[k]?.ok || 0) + (totals[k]?.fail || 0)));
  const top = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const grid = top >= 4 ? [top, top / 2, 0] : [top, 0];
  return (
    <div className="dp-calls">
      <div className="dp-calls-plot">
        {grid.map((g) => (
          <div key={g} className="dp-grid" style={{ bottom: `${(g / top) * 100}%` }}><span className="mono">{Math.round(g)}</span></div>
        ))}
        <div className="dp-cols">
          {days.map((k, i) => {
            const t = totals[k] || { ok: 0, fail: 0 };
            const n = t.ok + t.fail;
            return (
              <button key={k} type="button" className="dp-col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${dayLabel(k)}: ${t.ok} answered, ${t.fail} failed`}>
                <span className="dp-stack" style={{ height: `${(n / top) * 100}%` }}>
                  {t.fail > 0 && <span className="dp-seg fail" style={{ flexGrow: t.fail }} />}
                  {t.ok > 0 && <span className="dp-seg ok" style={{ flexGrow: t.ok }} />}
                </span>
                {hover === i && (
                  <span className={`dp-tip ${i > days.length * 0.6 ? 'left' : ''}`} style={{ left: '50%', bottom: `calc(${(n / top) * 100}% + 8px)` }}>
                    <b>{dayLabel(k)}</b>
                    <span><i className="sw ok" />{t.ok} answered</span>
                    <span><i className="sw fail" />{t.fail} failed</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="dp-axis mono">
        <span>{dayLabel(days[0])}</span><span>{dayLabel(days[Math.floor(days.length / 2)])}</span><span>Today</span>
      </div>
    </div>
  );
}

/* ---------- the view ---------- */

export default function DbPulse({ initial, now: serverNow }) {
  const [dbs, setDbs] = useState(initial.dbs);
  const [pings, setPings] = useState(initial.pings);
  const [now, setNow] = useState(Date.parse(serverNow));
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');
  const [logFilter, setLogFilter] = useState('all');
  const [logAll, setLogAll] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const accBy = useMemo(() => Object.fromEntries(initial.accounts.map((a) => [a.slug, a])), [initial.accounts]);
  const projBy = useMemo(() => Object.fromEntries(initial.projects.map((p) => [p.slug, p])), [initial.projects]);
  const provBy = useMemo(() => Object.fromEntries(initial.providers.map((p) => [p.slug, p])), [initial.providers]);

  const days = useMemo(() => {
    const out = [];
    const base = Date.parse(serverNow);
    for (let i = initial.days - 1; i >= 0; i--) {
      const k = dayKey(new Date(base - i * DAY).toISOString());
      if (!out.includes(k)) out.push(k);
    }
    return out;
  }, [serverNow, initial.days]);

  const watched = dbs.filter((r) => r.keepalive_enabled);
  const others = dbs.filter((r) => !r.keepalive_enabled);

  const stats = useMemo(() => {
    const byRes = {};
    const totals = {};
    for (const p of pings) {
      const k = dayKey(p.pinged_at);
      (byRes[p.resource_id] ||= []).push(p);
      totals[k] ||= { ok: 0, fail: 0 };
      totals[k][p.ok ? 'ok' : 'fail']++;
    }
    const per = {};
    for (const r of watched) {
      const list = byRes[r.id] || [];
      const byDay = {};
      for (const p of list) {
        const k = dayKey(p.pinged_at);
        byDay[k] ||= { ok: 0, fail: 0 };
        byDay[k][p.ok ? 'ok' : 'fail']++;
      }
      const okList = list.filter((p) => p.ok);
      const lastOk = okList.length ? okList[okList.length - 1].pinged_at : (r.last_ping_ok ? r.last_ping_at : null);
      const sinceOk = lastOk ? (now - Date.parse(lastOk)) / DAY : null;
      per[r.id] = {
        byDay,
        spark: okList.slice(-30).filter((p) => p.ms != null).map((p) => ({ ms: p.ms, at: p.pinged_at })),
        calls: list.length,
        uptime: list.length ? Math.round((okList.length / list.length) * 100) : null,
        lastOk,
        sinceOk,
      };
    }
    const okAll = pings.filter((p) => p.ok);
    return {
      per, totals,
      calls: pings.length,
      uptime: pings.length ? Math.round((okAll.length / pings.length) * 1000) / 10 : null,
      median: median(okAll.map((p) => p.ms).filter((x) => x != null)),
    };
  }, [pings, watched, now]);

  const awake = watched.filter((r) => r.last_ping_ok).length;
  const next = nextCron(now);
  const lastSweep = watched.map((r) => r.last_ping_at).filter(Boolean).sort().pop();
  const headroom = watched
    .map((r) => stats.per[r.id]?.sinceOk)
    .map((s) => (s == null ? 0 : Math.max(0, PAUSE_DAYS - s)));
  const minHeadroom = headroom.length ? Math.min(...headroom) : null;

  const attention = [
    ...watched.filter((r) => !r.last_ping_ok || (stats.per[r.id]?.sinceOk ?? 99) >= 3).map((r) => ({
      r, level: 'flag',
      what: r.last_ping_note || 'Not confirmed awake yet',
      fix: r.last_ping_ok ? 'Last success is getting old — ping it now.' : fixFor(r.last_ping_note, r.last_ping_status),
    })),
    ...others.filter((r) => /supabase/i.test(r.kind) && r.external_ref !== initial.hubRef).map((r) => ({
      r, level: r.has_key ? 'warn' : 'flag', what: 'No keep-alive protection',
      fix: r.has_key ? 'Switch keep-alive on for this resource.' : 'Add its publishable key and switch keep-alive on.',
    })),
  ];

  async function ping(id) {
    setBusy(id ?? 'all'); setMsg('');
    try {
      const res = await fetch(`/api/keepalive${id ? `?id=${id}` : ''}`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Ping failed');
      const byId = Object.fromEntries(j.results.map((x) => [x.id, x]));
      setDbs((rs) => rs.map((r) => byId[r.id]
        ? { ...r, last_ping_ok: byId[r.id].ok, last_ping_note: byId[r.id].note, last_ping_ms: byId[r.id].ms, last_ping_status: byId[r.id].status, last_ping_at: j.at }
        : r));
      setPings((ps) => [...ps, ...j.results.map((x) => ({ resource_id: x.id, pinged_at: j.at, ok: x.ok, status: x.status, ms: x.ms, note: x.note, trigger: 'manual' }))]);
      setNow(Date.now());
      setMsg(id ? (j.results[0]?.ok ? `${j.results[0].name} answered in ${j.results[0].ms} ms.` : `${j.results[0]?.name}: ${j.results[0]?.note}`)
        : `${j.healthy} of ${j.pinged} databases answered.`);
    } catch (e) { setMsg(e.message); }
    setBusy(null);
  }

  const nameBy = Object.fromEntries(dbs.map((r) => [r.id, r.name]));
  const log = [...pings].reverse()
    .filter((p) => logFilter === 'all' || (logFilter === 'failed' ? !p.ok : p.trigger === 'manual'));
  const shown = logAll ? log.slice(0, 200) : log.slice(0, 12);

  return (
    <div className="dp">
      <header className="dp-hero card">
        <div className="dp-hero-ring"><FleetRing awake={awake} total={watched.length} /></div>
        <div className="dp-hero-main">
          <div className="dp-kicker"><span className="dp-live" /> Database pulse</div>
          <h1 className="pagetitle">Every database, awake and accounted for</h1>
          <p className="pagesub" style={{ marginBottom: 14 }}>
            The keep-alive calls each Supabase project once a day so free projects never pause. This page shows every call, how fast each database answered, and which ones need you.
          </p>
          <div className="dp-hero-meta">
            <div><span className="dp-meta-l">Next scheduled ping</span><span className="dp-meta-v mono">{countdown(next - now)}</span></div>
            <div><span className="dp-meta-l">Last sweep</span><span className="dp-meta-v">{lastSweep ? `${fmtTime(lastSweep)} · ${ago(lastSweep, now)}` : '—'}</span></div>
            <button className="btn primary" onClick={() => ping(null)} disabled={!!busy}>{busy === 'all' ? 'Pinging…' : 'Ping all now'}</button>
          </div>
          {msg && <div className="dp-msg" role="status">{msg}</div>}
        </div>
      </header>

      {!initial.hasLog && (
        <div className="dp-banner">
          <b>Ping history is off.</b> Run <span className="mono">keepalive_pings.sql</span> once in the zagaprime-opshub SQL editor and every call from then on is charted here. Until then the page shows each database’s latest result.
        </div>
      )}

      <div className="stats dp-stats">
        <div className="stat"><div className="v">{awake}<span className="dp-of">/{watched.length}</span></div><div className="l">Awake now</div></div>
        <div className="stat"><div className="v">{stats.uptime == null ? '—' : `${stats.uptime}%`}</div><div className="l">30-day success</div></div>
        <div className="stat"><div className="v">{stats.calls}</div><div className="l">Calls logged · 30d</div></div>
        <div className="stat"><div className="v">{stats.median == null ? '—' : <>{stats.median}<span className="dp-of"> ms</span></>}</div><div className="l">Median response</div></div>
        <div className="stat">
          <div className="v" style={{ color: minHeadroom == null ? undefined : minHeadroom <= 2 ? 'var(--flag)' : minHeadroom <= 4 ? 'var(--warn)' : 'var(--ok)' }}>
            {minHeadroom == null ? '—' : <>{minHeadroom.toFixed(1)}<span className="dp-of"> d</span></>}
          </div>
          <div className="l">Least pause headroom</div>
        </div>
      </div>

      {attention.length > 0 && (
        <section className="dp-attn card" aria-labelledby="dp-attn-h">
          <h2 id="dp-attn-h"><span className="dp-attn-icon" aria-hidden="true">!</span>Needs you · {attention.length}</h2>
          <ul>
            {attention.map(({ r, level, what, fix }) => (
              <li key={r.id}>
                <span className={`pill ${level}`}>{level === 'flag' ? 'Action' : 'Check'}</span>
                <div className="dp-attn-body">
                  <div><b>{r.name}</b> <span className="mono faint" style={{ fontSize: 11 }}>{r.external_ref || ''}</span></div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{what} — {fix}</div>
                </div>
                {r.keepalive_enabled
                  ? <button className="btn sm" onClick={() => ping(r.id)} disabled={!!busy}>{busy === r.id ? '…' : 'Ping'}</button>
                  : <Link className="btn sm" href={`/projects?focus=${r.project_slug || ''}`}>Fix</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="viewtitle">Keep-alive calls per day <span className="dp-legend"><i className="sw ok" />Answered <i className="sw fail" />Failed</span></h2>
      <div className="chartcard"><DailyCalls days={days} totals={stats.totals} /></div>

      <h2 className="viewtitle">Protected databases · {watched.length}</h2>
      <div className="dp-grid-cards">
        {watched.map((r) => {
          const s = stats.per[r.id] || { byDay: {}, spark: [] };
          const acc = accBy[r.account_slug];
          const since = s.sinceOk;
          const used = since == null ? 1 : Math.min(1, since / PAUSE_DAYS);
          const level = since == null ? 'flag' : since >= 5 ? 'flag' : since >= 3 ? 'warn' : 'ok';
          const state = r.last_ping_ok ? 'ok' : r.last_ping_at ? 'fail' : 'idle';
          return (
            <article key={r.id} className={`dp-card card ${state}`}>
              <div className="dp-card-head">
                <span className={`dp-orb ${state}`} aria-hidden="true" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="dp-name">{r.name}</div>
                  <div className="mono faint dp-ref">{r.external_ref || 'project ref missing'}</div>
                </div>
                <span className={`pill ${state === 'ok' ? 'live' : 'flag'}`}>{state === 'ok' ? 'Awake' : state === 'fail' ? 'Failing' : 'Not pinged'}</span>
              </div>

              <div className="dp-card-meta">
                <span><Pchip slug={acc?.provider_slug} name={provBy[acc?.provider_slug]?.name} />{acc ? <Link href={`/accounts?focus=${acc.slug}`}>{acc.login_hint && !/fill in/i.test(acc.login_hint) ? acc.login_hint : acc.label}</Link> : '—'}</span>
                {projBy[r.project_slug] && <Link className="dp-proj" href={`/projects?focus=${r.project_slug}`}>{projBy[r.project_slug].name}</Link>}
              </div>

              <div className="dp-pause">
                <div className="dp-pause-top">
                  <span>Pause clock</span>
                  <span className={`dp-pause-v ${level}`}>
                    {since == null ? 'Unprotected' : `${Math.max(0, PAUSE_DAYS - since).toFixed(1)} days of headroom`}
                  </span>
                </div>
                <div className="dp-pause-track" role="meter" aria-valuemin={0} aria-valuemax={PAUSE_DAYS} aria-valuenow={since == null ? PAUSE_DAYS : Math.min(PAUSE_DAYS, since)} aria-label="Days since last successful ping">
                  <span className={`dp-pause-fill ${level}`} style={{ width: `${Math.max(4, used * 100)}%` }} />
                  {[3, 5].map((t) => <span key={t} className="dp-pause-tick" style={{ left: `${(t / PAUSE_DAYS) * 100}%` }} />)}
                </div>
                <div className="dp-pause-foot faint"><span>Last success {ago(s.lastOk, now)}</span><span>pauses at {PAUSE_DAYS}d</span></div>
              </div>

              <div className="dp-sub">Response time</div>
              <Sparkline points={s.spark} />

              <div className="dp-sub" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Last 30 days</span><span className="mono">{s.uptime == null ? '' : `${s.uptime}% · ${s.calls} calls`}</span>
              </div>
              <UptimeStrip days={days} byDay={s.byDay} />

              <div className="dp-card-foot">
                <span className="dp-note">{r.last_ping_ok ? `Answered in ${r.last_ping_ms ?? '—'} ms · ${ago(r.last_ping_at, now)}` : (r.last_ping_note || 'Waiting for the first ping')}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn sm" onClick={() => ping(r.id)} disabled={!!busy}>{busy === r.id ? 'Pinging…' : 'Ping'}</button>
                  {r.url && <a className="btn sm" href={r.url} target="_blank" rel="noreferrer">Console <Ext /></a>}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <h2 className="viewtitle">Call log</h2>
      <div className="chips" role="group" aria-label="Filter call log">
        {[['all', 'All calls'], ['failed', 'Failed'], ['manual', 'Manual']].map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={logFilter === k} onClick={() => setLogFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        {shown.length ? (
          <table className="srctable">
            <thead><tr><th>When</th><th>Database</th><th>Result</th><th>HTTP</th><th>Time</th><th>Source</th></tr></thead>
            <tbody>
              {shown.map((p, i) => (
                <tr key={`${p.resource_id}-${p.pinged_at}-${i}`}>
                  <td className="mono" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{fmtTime(p.pinged_at)}</td>
                  <td>{nameBy[p.resource_id] || `#${p.resource_id}`}</td>
                  <td style={{ fontSize: 12.5 }}><span className="okdot" style={{ background: p.ok ? 'var(--ok)' : 'var(--flag)' }} />{p.ok ? 'Answered' : p.note}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{p.status ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{p.ms != null ? `${p.ms} ms` : '—'}</td>
                  <td><span className={`pill ${p.trigger === 'manual' ? 'blue' : 'ghost'}`}>{p.trigger === 'manual' ? 'manual' : 'daily'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {log.length > shown.length && (
          <div style={{ padding: 10, textAlign: 'center', borderTop: '1px solid var(--line)' }}>
            <button className="btn sm" onClick={() => setLogAll(true)}>Show {Math.min(200, log.length) - shown.length} more</button>
          </div>
        )}
        {!shown.length && <div className="empty" style={{ padding: 20 }}>{initial.hasLog ? 'No calls match this filter yet.' : 'Calls appear here once ping history is on.'}</div>}
      </div>

      <h2 className="viewtitle">Other databases · {others.length}</h2>
      <div className="dp-inv">
        {others.map((r) => {
          const why = unwatchedReason(r, initial.hubRef);
          const acc = accBy[r.account_slug];
          return (
            <div key={r.id} className="dp-inv-row card">
              <span className={`okdot`} style={{ background: `var(--${why.level === 'ok' ? 'ok' : why.level === 'warn' ? 'warn' : 'flag'})` }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div><b style={{ fontWeight: 600 }}>{r.name}</b> <span className="pill ghost">{engine(r.kind)}</span></div>
                <div className="muted" style={{ fontSize: 12.5 }}>{why.text}</div>
                <div className="faint" style={{ fontSize: 11.5 }}>
                  {acc ? acc.label : '—'}{projBy[r.project_slug] ? <> · <Link href={`/projects?focus=${r.project_slug}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{projBy[r.project_slug].name}</Link></> : null}
                </div>
              </div>
              {r.url && <a className="btn sm" href={r.url} target="_blank" rel="noreferrer">Open <Ext /></a>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
