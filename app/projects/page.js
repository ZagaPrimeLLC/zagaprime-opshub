import { fetchAll } from '@/lib/data';
import SetupNotice from '@/components/setup';
import ProjectsView from '@/components/projects-view';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  let d;
  try { d = await fetchAll(); }
  catch (e) {
    return (<><h1 className="pagetitle">Projects</h1><SetupNotice error={e.message} /></>);
  }
  const params = {
    q: sp.q || '', focus: sp.focus || null, show: sp.show || null, provider: sp.provider || null,
    env: sp.env || null, kind: sp.kind || null, add: sp.add || null, expand: sp.expand || null,
  };
  return <ProjectsView key={JSON.stringify(params)} initial={d} params={params} />;
}
