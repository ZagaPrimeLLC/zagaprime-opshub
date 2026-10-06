import { q } from './db';

// Pings every Supabase project marked keepalive_enabled so free-plan projects never pause.
// Uses each project's publishable (public) key and a read-only keepalive() function.

async function pingOne(row) {
  const base = { id: row.id, name: row.name };
  if (!row.external_ref) {
    return { ...base, ok: false, status: null, ms: null, note: 'Add the project ref to ping this database' };
  }
  const url = `https://${row.external_ref}.supabase.co/rest/v1/rpc/keepalive`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { apikey: row.keepalive_key, 'content-type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const ms = Date.now() - t0;
    if (res.ok) return { ...base, ok: true, status: res.status, ms, note: 'Database answered' };
    const text = (await res.text().catch(() => '')).slice(0, 300);
    let note = `HTTP ${res.status}`;
    if (res.status === 404) note = 'Reached the API, but keepalive() is not installed yet';
    else if (res.status === 401 || res.status === 403) note = 'Key rejected — check the publishable key';
    else if (res.status === 540 || /paused/i.test(text)) note = 'Project is paused — restore it in the Supabase dashboard';
    return { ...base, ok: false, status: res.status, ms, note };
  } catch (e) {
    return { ...base, ok: false, status: null, ms: Date.now() - t0,
      note: e?.name === 'TimeoutError' ? 'Timed out — project may be paused or restoring' : 'Unreachable — check the project ref' };
  }
}

// Ping history is optional: until keepalive_pings exists, pings still run and update resources.
async function logPing(x, trigger, at) {
  try {
    await q(`insert into proj_opsdash.keepalive_pings (resource_id, pinged_at, ok, status, ms, note, trigger)
      values ($1, $2, $3, $4, $5, $6, $7)`, [x.id, at, x.ok, x.status, x.ms, x.note, trigger]);
    return true;
  } catch (e) {
    if (e?.code === '42P01') return false;
    throw e;
  }
}

export async function runKeepalive({ id = null, trigger = 'cron' } = {}) {
  const r = await q(`select id, name, external_ref, keepalive_key from proj_opsdash.resources
    where keepalive_enabled and keepalive_key is not null and ($1::int is null or id = $1::int) order by name`, [id]);
  const results = await Promise.all(r.rows.map(pingOne));
  const at = new Date().toISOString();
  let logged = true;
  for (const x of results) {
    await q(`update proj_opsdash.resources set last_ping_at = $6, last_ping_ok = $2, last_ping_status = $3,
      last_ping_note = $4, last_ping_ms = $5 where id = $1`, [x.id, x.ok, x.status, x.note, x.ms, at]);
    if (logged) logged = await logPing(x, trigger, at);
  }
  return { at, logged, results };
}
