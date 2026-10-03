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
  const codes = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'XX000'];
  return codes.includes(e?.code) || /tenant|timeout|terminat/i.test(String(e?.message || ''));
}

export async function q(text, params) {
  if (!urls.length) {
    const err = new Error('Database is not connected: set SUPABASE_DB_URL in the environment.');
    err.code = 'NO_DB_URL';
    throw err;
  }
  if (!globalThis.__opshubPool) {
    globalThis.__opshubPool = makePool(urls[globalThis.__opshubUrlIdx || 0]);
  }
  try {
    return await globalThis.__opshubPool.query(text, params);
  } catch (e) {
    const idx = globalThis.__opshubUrlIdx || 0;
    if (isConnErr(e) && urls[idx + 1]) {
      globalThis.__opshubUrlIdx = idx + 1;
      try { globalThis.__opshubPool.end().catch(() => {}); } catch {}
      globalThis.__opshubPool = makePool(urls[idx + 1]);
      return await globalThis.__opshubPool.query(text, params);
    }
    throw e;
  }
}

export function activeDbHost() {
  const u = urls[globalThis.__opshubUrlIdx || 0];
  try { return new URL(u).host; } catch { return null; }
}
