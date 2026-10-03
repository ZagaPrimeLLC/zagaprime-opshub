import { fetchAll } from '@/lib/data';
import SetupNotice from '@/components/setup';
import NewsView from '@/components/news-view';

export const dynamic = 'force-dynamic';

export default async function NewsPage() {
  let d;
  try { d = await fetchAll(); }
  catch (e) {
    return (<><h1 className="pagetitle">Stack news</h1><SetupNotice error={e.message} /></>);
  }
  return <NewsView initial={d} />;
}
