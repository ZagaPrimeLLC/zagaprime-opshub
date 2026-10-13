import Link from 'next/link';
import { q } from '@/lib/db';
import { SCHEMA } from '@/lib/entities';
import { mdToHtml } from '@/lib/markdown';
import SetupNotice from '@/components/setup';

export const dynamic = 'force-dynamic';

function fmtDate(d) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function shortDate(d) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function BriefPage({ searchParams }) {
  const sp = (await searchParams) || {};
  let briefs = [];
  try {
    const r = await q(`select id, brief_date, headline, body_md, stats, created_at, updated_at from ${SCHEMA}.daily_brief order by brief_date desc limit 45`);
    briefs = r.rows;
  } catch (e) {
    if (e?.code !== '42P01') {
      return (<><h1 className="pagetitle">Daily Brief</h1><SetupNotice error={e.message} /></>);
    }
  }

  const want = /^\d{4}-\d{2}-\d{2}$/.test(sp.date || '') ? sp.date : null;
  const iso = (b) => String(b.brief_date).slice(0, 10);
  const current = (want && briefs.find((b) => iso(b) === want)) || briefs[0] || null;
  const stats = current?.stats && typeof current.stats === 'object' ? current.stats : null;

  return (
    <>
      <h1 className="pagetitle">Daily Brief</h1>
      <p className="pagesub">
        The stack agent&rsquo;s morning read on everything you run: what changed overnight, what it means for your projects,
        and what&rsquo;s worth doing about it. Item-by-item detail lives in <Link href="/news" style={{ color: 'var(--accent)' }}>Stack updates</Link>.
      </p>

      {briefs.length > 1 && (
        <div className="chips">
          {briefs.slice(0, 14).map((b) => (
            <Link key={b.id} className="chip" href={iso(b) === iso(briefs[0]) ? '/brief' : `/brief?date=${iso(b)}`}
              aria-pressed={current && iso(b) === iso(current)}>
              {shortDate(iso(b))}
            </Link>
          ))}
        </div>
      )}

      {!current && (
        <div className="empty">
          No briefs yet. The next morning sweep will post the first one — or ask the stack agent for one now.
        </div>
      )}

      {current && (
        <article className="briefcard">
          <div className="briefhead">
            <span className="briefdate">{fmtDate(iso(current))}</span>
            {current.updated_at && <span className="briefupd mono">updated {new Date(current.updated_at).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET</span>}
          </div>
          <h2 className="briefheadline">{current.headline}</h2>
          {stats && (
            <div className="briefstats">
              {Object.entries(stats).slice(0, 6).map(([k, v]) => (
                <span key={k} className="briefstat"><b>{String(v)}</b> {k.replace(/_/g, ' ')}</span>
              ))}
            </div>
          )}
          <div className="briefbody" dangerouslySetInnerHTML={{ __html: mdToHtml(current.body_md) }} />
        </article>
      )}
    </>
  );
}
