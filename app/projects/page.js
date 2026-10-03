import { fetchAll } from '@/lib/data';
import SetupNotice from '@/components/setup';
import ProjectsView from '@/components/projects-view';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  let d;
  try { d = await fetchAll(); }
  catch (e) {
    return (<><h1 className="pagetitle">Projects</h1><SetupNotice error={e.message} /></>);
  }
  return <ProjectsView initial={d} />;
}
