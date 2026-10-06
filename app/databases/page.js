import { loadPulse } from '@/lib/pulse';
import SetupNotice from '@/components/setup';
import DbPulse from '@/components/db-pulse';

export const dynamic = 'force-dynamic';

export default async function DatabasesPage() {
  let d;
  try { d = await loadPulse(); }
  catch (e) {
    return (<><h1 className="pagetitle">Databases</h1><SetupNotice error={e.message} /></>);
  }
  return <DbPulse initial={d} now={new Date().toISOString()} />;
}
