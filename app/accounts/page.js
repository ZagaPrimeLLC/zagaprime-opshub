import { fetchAll } from '@/lib/data';
import SetupNotice from '@/components/setup';
import AccountsView from '@/components/accounts-view';

export const dynamic = 'force-dynamic';

export default async function AccountsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  let d;
  try { d = await fetchAll(); }
  catch (e) {
    return (<><h1 className="pagetitle">Accounts</h1><SetupNotice error={e.message} /></>);
  }
  const params = { q: sp.q || '', focus: sp.focus || null, provider: sp.provider || null, missing: sp.missing || null };
  return <AccountsView key={JSON.stringify(params)} initial={d} params={params} />;
}
