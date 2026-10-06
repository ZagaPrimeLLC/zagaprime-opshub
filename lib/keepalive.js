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

export async function runKeepalive() {
  const r = await q(`select id, name, external_ref, keepalive_key from proj_opsdash.resources
    where keepalive_enabled and keepalive_key is not null order by name`);
  const results = await Promise.all(r.rows.map(pingOne));
  for (const x of results) {
    await q(`update proj_opsdash.resources set last_ping_at = now(), last_ping_ok = $2, last_ping_status = $3,
      last_ping_note = $4, last_ping_ms = $5 where id = $1`, [x.id, x.ok, x.status, x.note, x.ms]);
  }
  return results;
}
