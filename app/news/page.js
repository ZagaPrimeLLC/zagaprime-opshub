import { fetchAll } from '@/lib/data';
import SetupNotice from '@/components/setup';
import NewsView from '@/components/news-view';

export const dynamic = 'force-dynamic';

export default async function NewsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  let d;
  try { d = await fetchAll(); }
  catch (e) {
    return (<><h1 className="pagetitle">Stack updates</h1><SetupNotice error={e.message} /></>);
  }
  const params = { crit: sp.crit || 'all', bucket: sp.bucket || 'open', project: sp.project || null };
  return <NewsView key={JSON.stringify(params)} initial={d} params={params} />;
}
