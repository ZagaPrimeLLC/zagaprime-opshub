import { q } from './db';
import { SCHEMA } from './entities';
import { CLASSES } from './classes';

const DAYS = 30;

// Everything the Databases tab needs: the database resources, their accounts/projects and
// the last 30 days of keep-alive pings (empty with hasLog=false until the table exists).
export async function loadPulse() {
  const [resources, accounts, projects, providers] = await Promise.all([
    q(`select id, kind, name, external_ref, url, environment, account_slug, project_slug, notes,
        keepalive_enabled, keepalive_key is not null as has_key,
        last_ping_at, last_ping_ok, last_ping_status, last_ping_note, last_ping_ms
       from ${SCHEMA}.resources order by name`),
    q(`select slug, provider_slug, label, login_hint, console_url from ${SCHEMA}.accounts`),
    q(`select slug, name from ${SCHEMA}.projects`),
    q(`select slug, name from ${SCHEMA}.providers`),
  ]);

  let pings = [];
  let hasLog = true;
  try {
    const r = await q(`select resource_id, pinged_at, ok, status, ms, note, trigger
      from ${SCHEMA}.keepalive_pings where pinged_at > now() - interval '${DAYS} days'
      order by pinged_at`);
    pings = r.rows;
  } catch (e) {
    if (e?.code !== '42P01') throw e;
    hasLog = false;
  }

  const dbs = resources.rows.filter((r) => CLASSES.database.test(r.kind) || r.keepalive_enabled);
  // The hub's own database is queried by every page load and the daily cron, so it never idles.
  let hubRef = null;
  try { hubRef = decodeURIComponent(new URL(process.env.SUPABASE_DB_URL || '').username).split('.')[1] || null; } catch {}
  return { dbs, hubRef, accounts: accounts.rows, projects: projects.rows, providers: providers.rows, pings, hasLog, days: DAYS };
}
