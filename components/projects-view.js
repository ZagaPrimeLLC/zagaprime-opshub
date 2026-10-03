'use client';
import { useMemo, useState } from 'react';
import { Pchip, Pill, Ext } from '@/components/bits';
import { EntityForm, ENV_OPTIONS, KIND_OPTIONS } from '@/components/crud';

export default function ProjectsView({ initial }) {
  const [projects, setProjects] = useState(initial.projects);
  const [resources, setResources] = useState(initial.resources);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState({});
  const [editingRes, setEditingRes] = useState(null); // resource id | 'new:<projectSlug|none>'
  const [editingProj, setEditingProj] = useState(null); // project slug | 'new'
  const accounts = initial.accounts;

  const accBy = useMemo(() => Object.fromEntries(accounts.map((a) => [a.slug, a])), [accounts]);
  const q = filter.trim().toLowerCase();
  const match = (...f) => !q || f.some((x) => String(x ?? '').toLowerCase().includes(q));

  const accountOptions = accounts.map((a) => ({ v: a.slug, l: a.label }));
  const projectOptions = projects.map((p) => ({ v: p.slug, l: p.name }));

  const resFields = [
    { name: 'name', label: 'Name' },
    { name: 'kind', label: 'Kind', type: 'select', options: KIND_OPTIONS },
    { name: 'environment', label: 'Env', type: 'select', options: ENV_OPTIONS },
    { name: 'account_slug', label: 'Account', type: 'select', options: accountOptions },
    { name: 'project_slug', label: 'Project', type: 'select', options: projectOptions },
    { name: 'external_ref', label: 'Ref / ID' },
    { name: 'url', label: 'Console URL', wide: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];
  const projFields = [
    { name: 'slug', label: 'Slug (short id)' },
    { name: 'name', label: 'Name' },
    { name: 'client', label: 'Client' },
    { name: 'status', label: 'Status', type: 'select', options: ['active', 'paused', 'archived'].map((v) => ({ v, l: v })) },
    { name: 'prod_url', label: 'Live URL' },
    { name: 'repo_url', label: 'Repo URL' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  function savedRes(row) {
    setResources((rs) => {
      const i = rs.findIndex((r) => r.id === row.id);
      if (i === -1) return [...rs, row];
      const copy = [...rs]; copy[i] = row; return copy;
    });
    setEditingRes(null);
  }
  function deletedRes(row) { setResources((rs) => rs.filter((r) => r.id !== row.id)); setEditingRes(null); }
  function savedProj(row) {
    setProjects((ps) => {
      const i = ps.findIndex((p) => p.slug === row.slug);
      if (i === -1) return [...ps, row].sort((a, b) => a.name.localeCompare(b.name));
      const copy = [...ps]; copy[i] = row; return copy;
    });
    setEditingProj(null);
  }
  function deletedProj(row) { setProjects((ps) => ps.filter((p) => p.slug !== row.slug)); setEditingProj(null); }

  function card(p) {
    const isUn = p.slug === null;
    const res = resources.filter((r) => (isUn ? !r.project_slug : r.project_slug === p.slug));
    const pMatch = match(p.name, p.client, p.slug, p.prod_url);
    const rows = res.filter((r) => pMatch || match(r.name, r.kind, r.external_ref, r.notes, accBy[r.account_slug]?.label));
    if (q && !pMatch && !rows.length) return null;
    const shown = q ? rows : res;
    const isOpen = Boolean(q) || open[p.slug ?? '__un'];
    const provs = [...new Set(shown.map((r) => accBy[r.account_slug]?.provider_slug).filter(Boolean))];
    const newKey = `new:${p.slug ?? 'none'}`;

    return (
      <div className={`pcard${isOpen ? ' open' : ''}`} key={p.slug ?? '__un'}>
        <button className="pcard-head" onClick={() => setOpen((o) => ({ ...o, [p.slug ?? '__un']: !isOpen }))}>
          <span className="pcard-title">
            <span className="name">{p.name}</span>
            <span className="sub">{p.client || (isUn ? 'link these to projects' : '')} · {res.length} resource{res.length === 1 ? '' : 's'}{p.status && p.status !== 'active' ? ` · ${p.status}` : ''}</span>
          </span>
          <span className="stackchips">{provs.slice(0, 6).map((s) => <Pchip key={s} slug={s} />)}</span>
          {p.prod_url && (
            <a className="openlink" href={p.prod_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Open live site"><Ext /></a>
          )}
          <svg className="caret" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M9 6l6 6-6 6" /></svg>
        </button>
        {isOpen && (
          <div className="pcard-body">
            {!isUn && editingProj === p.slug && (
              <EntityForm entity="projects" row={p} fields={projFields} pk="slug"
                onSaved={savedProj} onCancel={() => setEditingProj(null)} onDeleted={deletedProj} />
            )}
            {shown.map((r) =>
              editingRes === r.id ? (
                <EntityForm key={r.id} entity="resources" row={r} fields={resFields} pk="id"
                  onSaved={savedRes} onCancel={() => setEditingRes(null)} onDeleted={deletedRes} />
              ) : (
                <div className="rrow" key={r.id}>
                  <Pchip slug={accBy[r.account_slug]?.provider_slug} />
                  <span className="rname">
                    <span className="rtxt">{r.name} {r.external_ref && <span className="mono faint">{r.external_ref}</span>}</span>
                    <span className="rnote">{r.notes || `${r.kind}${accBy[r.account_slug] ? ' · ' + accBy[r.account_slug].label : ''}`}</span>
                  </span>
                  {r.environment && <Pill kind={r.environment} />}
                  <span className="rowactions">
                    {r.url && <a className="openlink" href={r.url} target="_blank" rel="noopener noreferrer">Open <Ext /></a>}
                    <button className="btn sm" onClick={() => setEditingRes(r.id)}>Edit</button>
                  </span>
                </div>
              )
            )}
            {editingRes === newKey ? (
              <EntityForm entity="resources" row={{ project_slug: p.slug ?? '', environment: 'prod' }} fields={resFields} pk="id" isNew
                onSaved={savedRes} onCancel={() => setEditingRes(null)} />
            ) : (
              <div className="rrow">
                <button className="btn sm" onClick={() => setEditingRes(newKey)}>+ Add resource</button>
                {!isUn && editingProj !== p.slug && <button className="btn sm" onClick={() => setEditingProj(p.slug)}>Edit project</button>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const unCount = resources.filter((r) => !r.project_slug).length;
  const cards = projects.map(card).filter(Boolean);
  const unCard = card({ slug: null, name: 'Unassigned', client: '' });

  return (
    <>
      <h1 className="pagetitle">Projects</h1>
      <p className="pagesub">Every project and the full stack behind it. Edit, link and add anything — changes land in the registry immediately.</p>
      <div className="addbar">
        <input className="filter" placeholder="Filter projects, resources, refs, accounts…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="btn primary" onClick={() => setEditingProj('new')}>+ New project</button>
      </div>
      {editingProj === 'new' && (
        <div className="pcard" style={{ marginBottom: 14 }}>
          <EntityForm entity="projects" row={{ status: 'active' }} fields={projFields} pk="slug" isNew
            onSaved={savedProj} onCancel={() => setEditingProj(null)} />
        </div>
      )}
      <div className="grid">{cards}</div>
      {unCard && (
        <>
          <h2 className="viewtitle">Unassigned — {unCount} resources not linked to a project</h2>
          <div className="grid">{unCard}</div>
        </>
      )}
      {q && !cards.length && !unCard && <div className="empty">Nothing matches “{filter}”.</div>}
    </>
  );
}
