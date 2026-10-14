import { q } from './db';
import { SCHEMA } from './entities';

// Keeps the Ezra queue in step with GitHub: once Kzee merges or closes the PRs Ezra opened, the job
// moves from pr-open to done (merged) or cancelled (closed without merging), and the linked stack
// update is marked done. Reads PR state through the GitHub REST API with GITHUB_TOKEN (read access
// to pull requests); public repos also work without it. PRs it can't read are left untouched.

const PR_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
const MIN_INTERVAL_MS = 60_000;

async function prState(url) {
  const m = PR_URL.exec(url || '');
  if (!m) return null;
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'zagaprime-opshub' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}/pulls/${m[3]}`, { headers, cache: 'no-store' });
    if (!res.ok) return { state: 'unknown', http: res.status };
    const pr = await res.json();
    return { state: pr.merged_at ? 'merged' : pr.state, merged_at: pr.merged_at || null };
  } catch {
    return { state: 'unknown' };
  }
}

// Decide what a job's PR states add up to. Returns the new job status or null to leave it.
export function outcome(states) {
  const known = states.filter((s) => s && s.state !== 'unknown');
  if (!known.length || known.length < states.filter(Boolean).length) return null; // something unreadable
  if (known.some((s) => s.state === 'open')) return null;
  return known.some((s) => s.state === 'merged') ? 'done' : 'cancelled';
}

function summary(links, status) {
  const merged = links.filter((l) => l.state === 'merged').map((l) => l.label || l.url);
  const closed = links.filter((l) => l.state === 'closed').map((l) => l.label || l.url);
  const parts = [];
  if (merged.length) parts.push(`merged: ${merged.join(', ')}`);
  if (closed.length) parts.push(`closed without merging: ${closed.join(', ')}`);
  return `**${status === 'done' ? 'Done' : 'Closed'}** (synced from GitHub ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC): ${parts.join('; ')}.`;
}

// force skips the once-a-minute throttle (the Sync button). Returns { checked, updated, skipped }.
export async function syncEzraPrs({ force = false } = {}) {
  if (!force) {
    const last = await q(`select content from ${SCHEMA}.kb where key = 'ezra.pr_sync'`).then((r) => r.rows[0]?.content).catch(() => null);
    if (last && Date.now() - new Date(last).getTime() < MIN_INTERVAL_MS) return { skipped: true };
  }
  const now = new Date().toISOString();
  const touched = await q(`update ${SCHEMA}.kb set content = $1 where key = 'ezra.pr_sync'`, [now]).catch(() => ({ rowCount: 1 }));
  if (!touched.rowCount) await q(`insert into ${SCHEMA}.kb (key, content) values ('ezra.pr_sync', $1)`, [now]).catch(() => {});

  const jobs = await q(`select * from ${SCHEMA}.ezra_queue where status = 'pr-open' order by requested_at limit 50`)
    .then((r) => r.rows)
    .catch((e) => { if (e?.code === '42P01') return []; throw e; });

  let updated = 0;
  for (const job of jobs) {
    const links = (Array.isArray(job.pr_links) ? job.pr_links : []).map((l) => (typeof l === 'string' ? { url: l } : { ...l }));
    if (!links.length) continue;
    const states = await Promise.all(links.map((l) => prState(l.url)));
    links.forEach((l, i) => { if (states[i]) { l.state = states[i].state; if (states[i].merged_at) l.merged_at = states[i].merged_at; } });
    const next = outcome(states);
    if (next) {
      const note = summary(links, next);
      const r = await q(
        `update ${SCHEMA}.ezra_queue set status = $2, pr_links = $3,
           result_md = trim(both from coalesce(result_md, '') || E'\\n\\n' || $4), updated_at = now()
         where id = $1 and status = 'pr-open' returning id`,
        [job.id, next, JSON.stringify(links), note]
      );
      if (r.rowCount) {
        updated++;
        if (next === 'done' && job.news_id != null) {
          await q(
            `update ${SCHEMA}.stack_news set status = 'done' where id = $1 and status in ('new','reviewed','in-progress')`,
            [job.news_id]
          ).catch(() => {});
        }
      }
    } else {
      // Still open (or unreadable): just record the latest per-PR state for the page.
      await q(`update ${SCHEMA}.ezra_queue set pr_links = $2 where id = $1 and status = 'pr-open'`, [job.id, JSON.stringify(links)]).catch(() => {});
    }
  }
  return { checked: jobs.length, updated };
}
