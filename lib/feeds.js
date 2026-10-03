import { XMLParser } from 'fast-xml-parser';
import { q } from './db';

const ARRAYS = new Set(['item', 'entry', 'link', 'media:content', 'media:thumbnail', 'enclosure']);
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ARRAYS.has(name),
  processEntities: true,
  htmlEntities: true,
});

const TTL_MS = 20 * 60 * 1000;
const PER_SOURCE = 8;
const UA = 'ZagaPrimeOpsHub/1.0 (+https://dashboard.zagaprime.com)';

const txt = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return txt(v[0]);
  if (typeof v === 'object' && '#text' in v) return String(v['#text']);
  return '';
};
const strip = (s) =>
  String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ').trim();
const firstImg = (html) => (String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || null;
const toIso = (s) => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d.toISOString(); };
const httpsOnly = (u) => (u && /^https?:\/\//i.test(u) ? u.replace(/^http:/i, 'https:') : null);

function fromRss(it, src, channelImg) {
  const link = txt((it.link || [])[0]) || txt(it.guid);
  const html = txt(it['content:encoded']) || txt(it.description);
  const enc = it.enclosure || [];
  const audio = enc.find((e) => /audio/.test(e['@_type'] || ''))?.['@_url'] || null;
  const encImg = enc.find((e) => /image/.test(e['@_type'] || ''))?.['@_url'];
  const mc = (it['media:content'] || []).find((m) => /image/.test(m['@_medium'] || m['@_type'] || '') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(m['@_url'] || ''))?.['@_url'];
  const mt = (it['media:thumbnail'] || [])[0]?.['@_url'];
  const itImg = it['itunes:image']?.['@_href'];
  const isPodcast = src.kind === 'podcast' || Boolean(audio);
  return {
    id: `${src.id}:${link || txt(it.title)}`,
    source: src.name, sourceId: src.id, category: src.category,
    kind: isPodcast ? 'podcast' : 'article',
    title: strip(txt(it.title)),
    url: link,
    image: httpsOnly(mt || mc || encImg || itImg || firstImg(html) || channelImg),
    audio: httpsOnly(audio),
    video: null,
    summary: strip(html).slice(0, 260),
    date: toIso(txt(it.pubDate) || txt(it['dc:date'])),
  };
}

function fromAtom(e, src) {
  const links = e.link || [];
  const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') || links[0];
  const url = alt?.['@_href'] || txt(alt);
  const vid = txt(e['yt:videoId']) || null;
  const group = e['media:group'] || {};
  const thumb = (group['media:thumbnail'] || [])[0]?.['@_url'];
  const html = txt(e.content) || txt(e.summary) || txt(group['media:description']);
  return {
    id: `${src.id}:${url || vid || txt(e.title)}`,
    source: src.name, sourceId: src.id, category: src.category,
    kind: vid ? 'video' : 'article',
    title: strip(txt(e.title)),
    url,
    image: httpsOnly(thumb || (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : null) || firstImg(html)),
    audio: null,
    video: vid,
    summary: strip(html).slice(0, 260),
    date: toIso(txt(e.published) || txt(e.updated)),
  };
}

export async function fetchSource(src) {
  try {
    const res = await fetch(src.url, {
      headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 1800 },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, items: [] };
    const doc = parser.parse(await res.text());
    let items = [];
    if (doc.rss?.channel) {
      const ch = doc.rss.channel;
      const chImg = txt(ch.image?.url) || ch['itunes:image']?.['@_href'] || null;
      items = (ch.item || []).map((it) => fromRss(it, src, chImg));
    } else if (doc.feed) {
      items = (doc.feed.entry || []).map((e) => fromAtom(e, src));
    } else if (doc['rdf:RDF']) {
      items = (doc['rdf:RDF'].item || []).map((it) => fromRss(it, src, null));
    } else {
      return { ok: false, error: 'Not an RSS/Atom feed', items: [] };
    }
    items = items.filter((i) => i.title && i.url).slice(0, PER_SOURCE);
    return { ok: true, items };
  } catch (e) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'Timed out' : String(e?.message || e).slice(0, 120), items: [] };
  }
}

export async function getSources({ all = false } = {}) {
  const r = await q(`select * from proj_opsdash.feed_sources ${all ? '' : 'where enabled'} order by category, name`);
  return r.rows;
}

export async function getFeed({ force = false } = {}) {
  const cache = globalThis.__zpFeed;
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const sources = await getSources();
  const results = await Promise.all(sources.map((s) => fetchSource(s).then((r) => ({ s, r }))));
  const seen = new Set();
  const items = [];
  for (const { r } of results) {
    for (const it of r.items) {
      if (seen.has(it.url)) continue;
      seen.add(it.url);
      items.push(it);
    }
  }
  items.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
  const data = {
    items: items.slice(0, 180),
    sources: results.map(({ s, r }) => ({ id: s.id, name: s.name, ok: r.ok, count: r.items.length, error: r.error || null })),
    fetchedAt: new Date().toISOString(),
  };
  // Only cache real results, so newly enabled sources show up immediately.
  if (data.items.length) globalThis.__zpFeed = { at: Date.now(), data };
  return data;
}

// Round-robin across categories so the ticker mixes AI, tech, dev, video and podcasts.
export function interleave(items) {
  const buckets = {};
  for (const it of items) (buckets[it.kind === 'video' ? 'video' : it.kind === 'podcast' ? 'podcast' : it.category] ||= []).push(it);
  const keys = Object.keys(buckets);
  const out = [];
  let added = true;
  while (added) {
    added = false;
    for (const k of keys) {
      const next = buckets[k].shift();
      if (next) { out.push(next); added = true; }
    }
  }
  return out;
}

export async function openAlerts() {
  try {
    const r = await q(`select id, title, criticality, effort from proj_opsdash.stack_news
      where status in ('new','reviewed','in-progress') and criticality in ('critical','high')
      order by case criticality when 'critical' then 0 else 1 end, created_at desc limit 6`);
    return r.rows;
  } catch { return []; }
}
