import { q } from './db';
import { SCHEMA } from './entities';

export const EZRA_OPEN = ['queued', 'picked-up', 'in-progress', 'pr-open'];
export const EZRA_RETRYABLE = ['failed', 'cancelled'];

// Put a failed or cancelled job back in the queue. The previous outcome is appended to the
// instruction so the worker knows what went wrong last time; old PR links and results are cleared
// so the card reads cleanly while it waits. Returns { job } or { error, status }.
export async function retryEzraJob(id, note) {
  const cur = await q(`select * from ${SCHEMA}.ezra_queue where id = $1`, [id]);
  const job = cur.rows[0];
  if (!job) return { error: 'Not found', status: 404 };
  if (!EZRA_RETRYABLE.includes(job.status)) {
    return { error: `Only failed or cancelled jobs can be retried (this one is ${job.status}).`, status: 409 };
  }
  if (job.news_id != null) {
    const dup = await q(
      `select id from ${SCHEMA}.ezra_queue where news_id = $1 and id <> $2 and status = any($3) limit 1`,
      [job.news_id, id, EZRA_OPEN]
    );
    if (dup.rows.length) return { error: `Job ${dup.rows[0].id} is already open for this stack update.`, status: 409 };
  }
  const parts = [];
  if (job.instruction) parts.push(job.instruction.trim());
  const outcome = job.status === 'failed' ? 'failed' : 'was cancelled';
  const prev = (job.result_md || '').trim();
  parts.push(`Retry: the previous attempt ${outcome}${prev ? `: ${prev.slice(0, 1500)}` : '.'}`);
  if (note && String(note).trim()) parts.push(`Retry note from Kzee: ${String(note).trim().slice(0, 1000)}`);
  const instruction = parts.join('\n\n').slice(-4000);
  const r = await q(
    `update ${SCHEMA}.ezra_queue
       set status = 'queued', instruction = $2, result_md = null, pr_links = null,
           requested_at = now(), updated_at = now()
     where id = $1 and status = any($3)
     returning *`,
    [id, instruction, EZRA_RETRYABLE]
  );
  if (!r.rows.length) return { error: 'The job changed before it could be retried; refresh and try again.', status: 409 };
  return { job: r.rows[0] };
}
