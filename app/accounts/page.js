import { fetchAll } from '@/lib/data';
import SetupNotice from '@/components/setup';
import AccountsView from '@/components/accounts-view';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  let d;
  try { d = await fetchAll(); }
  catch (e) {
    return (<><h1 className="pagetitle">Accounts</h1><SetupNotice error={e.message} /></>);
  }
  return <AccountsView initial={d} />;
}
