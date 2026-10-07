// Finds a page's preview image (og:image / twitter:image) so news cards can show real artwork.
// Results, including misses, are cached per server instance for a day.

const TTL = 24 * 60 * 60 * 1000;
const MAX_BYTES = 300_000;

function cache() {
  return (globalThis.__zpOgCache ||= new Map());
}

function pick(html, base) {
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  const want = ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'];
  const found = {};
  for (const m of metas) {
    const key = (m.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1]?.toLowerCase();
    const val = (m.match(/\bcontent\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (key && val && want.includes(key) && !found[key]) found[key] = val;
  }
  const raw = want.map((k) => found[k]).find(Boolean)
    || (html.match(/<link\b[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i) || [])[1];
  if (!raw) return null;
  try {
    const u = new URL(raw.replace(/&amp;/g, '&'), base);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch { return null; }
}

async function fetchOne(url) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ZagaPrimeOpsHub/1.0; +https://dashboard.zagaprime.com)', accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (!res.ok || !/html/i.test(res.headers.get('content-type') || '')) return null;
    const reader = res.body.getReader();
    let html = '';
    const dec = new TextDecoder();
    while (html.length < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});
    return pick(html, res.url || url);
  } catch { return null; }
}

export async function ogImage(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const c = cache();
  const hit = c.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.img;
  const img = await fetchOne(url);
  c.set(url, { at: Date.now(), img });
  return img;
}

// Fill in `image` for items that lack one, a few pages at a time.
export async function withImages(items, { limit = 40, concurrency = 8 } = {}) {
  const todo = items.filter((i) => !i.image && i.url).slice(0, limit);
  for (let i = 0; i < todo.length; i += concurrency) {
    await Promise.all(todo.slice(i, i + concurrency).map(async (it) => { it.image = await ogImage(it.url); }));
  }
  return items;
}
