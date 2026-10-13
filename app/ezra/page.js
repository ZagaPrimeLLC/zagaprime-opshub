import { q } from '@/lib/db';
import { SCHEMA } from '@/lib/entities';
import SetupNotice from '@/components/setup';
import EzraView from '@/components/ezra-view';

export const dynamic = 'force-dynamic';

export default async function EzraPage() {
  let jobs = [];
  let news = [];
  let lastCheck = null;
  try {
    [jobs, news, lastCheck] = await Promise.all([
      q(`select * from ${SCHEMA}.ezra_queue order by requested_at desc limit 100`)
        .then((r) => r.rows)
        .catch((e) => { if (e?.code === '42P01') return []; throw e; }),
      q(`select id, title, url, criticality, affected_projects from ${SCHEMA}.stack_news order by created_at desc limit 300`).then((r) => r.rows),
      q(`select content from ${SCHEMA}.kb where key = 'ezra.last_check'`).then((r) => r.rows[0]?.content || null).catch(() => null),
    ]);
  } catch (e) {
    return (<><h1 className="pagetitle">Ezra activity</h1><SetupNotice error={e.message} /></>);
  }
  return <EzraView initial={{ jobs, news, lastCheck }} />;
}
