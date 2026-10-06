import { Pool } from 'pg';

const urls = [process.env.SUPABASE_DB_URL, process.env.SUPABASE_DB_URL_ALT].filter(Boolean);

function makePool(url) {
  return new Pool({
    connectionString: url,
    max: 3,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 20000,
  });
}

function isConnErr(e) {
  const codes = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'XX000', '28P01', '3D000'];
  return codes.includes(e?.code) || /tenant|not found|timeout|terminat|connect/i.test(String(e?.message || ''));
}

// Find the first connection string that actually works, once per server instance.
// Concurrent callers share the same pending probe, so parallel queries never race.
function getPool() {
  const g = globalThis;
  if (g.__opshubPool) return Promise.resolve(g.__opshubPool);
  if (!g.__opshubPoolPromise) {
    g.__opshubPoolPromise = (async () => {
      let lastErr;
      for (let i = 0; i < urls.length; i++) {
        const pool = makePool(urls[i]);
        try {
          await pool.query('select 1');
          g.__opshubPool = pool;
          g.__opshubUrlIdx = i;
          return pool;
        } catch (e) {
          lastErr = e;
          pool.end().catch(() => {});
        }
      }
      throw lastErr;
    })().finally(() => { g.__opshubPoolPromise = null; });
  }
  return g.__opshubPoolPromise;
}

export async function q(text, params) {
  if (!urls.length) {
    const err = new Error('Database is not connected: set SUPABASE_DB_URL in the environment.');
    err.code = 'NO_DB_URL';
    throw err;
  }
  const pool = await getPool();
  try {
    return await pool.query(text, params);
  } catch (e) {
    // A dropped connection: rebuild the pool once and retry.
    if (isConnErr(e) && globalThis.__opshubPool === pool) {
      globalThis.__opshubPool = null;
      pool.end().catch(() => {});
      return (await getPool()).query(text, params);
    }
    throw e;
  }
}

export function activeDbHost() {
  const u = urls[globalThis.__opshubUrlIdx || 0];
  try { return new URL(u).host; } catch { return null; }
}
