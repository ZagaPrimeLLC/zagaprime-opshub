import { fetchAll } from '@/lib/data';
import SetupNotice from '@/components/setup';
import DomainsView from '@/components/domains-view';

export const dynamic = 'force-dynamic';

export default async function DomainsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  let d;
  try { d = await fetchAll(); }
  catch (e) {
    return (<><h1 className="pagetitle">Domains</h1><SetupNotice error={e.message} /></>);
  }
  const params = { q: sp.q || '', focus: sp.focus || null, project: sp.project || null, sort: sp.sort || null, add: sp.add || null };
  return <DomainsView key={JSON.stringify(params)} initial={d} params={params} />;
}
