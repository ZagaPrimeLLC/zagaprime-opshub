import { fetchAll } from '@/lib/data';
import SetupNotice from '@/components/setup';
import DomainsView from '@/components/domains-view';

export const dynamic = 'force-dynamic';

export default async function DomainsPage() {
  let d;
  try { d = await fetchAll(); }
  catch (e) {
    return (<><h1 className="pagetitle">Domains</h1><SetupNotice error={e.message} /></>);
  }
  return <DomainsView initial={d} />;
}
