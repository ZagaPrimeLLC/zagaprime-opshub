'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Pchip, Pill, Ext } from '@/components/bits';
import { EntityForm, ENV_OPTIONS, KIND_OPTIONS } from '@/components/crud';
import { CLASSES } from '@/lib/classes';

const ADD_KIND = { hosting: 'Vercel project', database: 'Supabase project', repo: 'Repo' };

export default function ProjectsView({ initial, params }) {
  const [projects, setProjects] = useState(initial.projects);
  const [resources, setResources] = useState(initial.resources);
  const [filter, setFilter] = useState(params.q || '');
  const [open, setOpen] = useState(() => {
    const o = {};
    if (params.focus) o[params.focus] = true;
    if (params.show === 'unassigned') o.__un = true;
    return o;
  });
  const [editingRes, setEditingRes] = useState(params.focus && params.add ? `new:${params.focus}` : null);
  const [editingProj, setEditingProj] = useState(null);
  const accounts = initial.accounts;

  const accBy = useMemo(() => Object.fromEntries(accounts.map((a) => [a.slug, a])), [accounts]);
  const provName = useMemo(() => Object.fromEntries(initial.providers.map((p) => [p.slug, p.name])), [initial.providers]);
  const q = filter.trim().toLowerCase();
  const match = (...f) => !q || f.some((x) => String(x ?? '').toLowerCase().includes(q));

  // structured filters from deep links
  const scoped = Boolean(params.provider || params.env || (params.kind && !params.focus));
  const resPass = (r) =>
    (!params.provider || accBy[r.account_slug]?.provider_slug === params.provider) &&
    (!params.env || (r.environment || 'unknown') === params.env) &&
    (!params.kind || CLASSES[params.kind]?.test(r.kind));
  const expandAll = params.expand === 'all' || scoped || Boolean(q);

  useEffect(() => {
    const id = params.focus ? `p-${params.focus}` : params.show === 'unassigned' ? 'p-__un' : null;
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => clearTimeout(t);
  }, [params.focus, params.show]);

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
    const key = p.slug ?? '__un';
    const all = resources.filter((r) => (isUn ? !r.project_slug : r.project_slug === p.slug));
    const focusedHere = params.focus === p.slug;
    const kindHere = focusedHere && params.kind ? all.filter((r) => CLASSES[params.kind]?.test(r.kind)) : null;
    const pool = kindHere || (scoped ? all.filter(resPass) : all);
    if (scoped && !pool.length && !focusedHere) return null;
    const pMatch = match(p.name, p.client, p.slug, p.prod_url);
    const rows = pool.filter((r) => pMatch || match(r.name, r.kind, r.external_ref, r.notes, accBy[r.account_slug]?.label));
    if (q && !pMatch && !rows.length) return null;
    const shown = q ? rows : pool;
    const isOpen = expandAll || open[key];
    const provs = [...new Set(all.map((r) => accBy[r.account_slug]?.provider_slug).filter(Boolean))];
    const newKey = `new:${p.slug ?? 'none'}`;
    const focusCls = focusedHere || (isUn && params.show === 'unassigned') ? ' focused' : '';

    return (
      <div className={`pcard${isOpen ? ' open' : ''}${focusCls}`} key={key} id={`p-${key}`}>
        <button className="pcard-head" onClick={() => setOpen((o) => ({ ...o, [key]: !isOpen }))} aria-expanded={isOpen}>
          <span className="pcard-title">
            <span className="name">{p.name}</span>
            <span className="sub">
              {p.client || (isUn ? 'link these to their projects' : '')} · {all.length} resource{all.length === 1 ? '' : 's'}
              {scoped || kindHere ? ` · ${shown.length} shown` : ''}{p.status && p.status !== 'active' ? ` · ${p.status}` : ''}
            </span>
          </span>
          <span className="stackchips">{provs.slice(0, 6).map((s) => <Pchip key={s} slug={s} name={provName[s]} />)}</span>
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
            {shown.map((r) => {
              const acc = accBy[r.account_slug];
              return editingRes === r.id ? (
                <EntityForm key={r.id} entity="resources" row={r} fields={resFields} pk="id"
                  onSaved={savedRes} onCancel={() => setEditingRes(null)} onDeleted={deletedRes} />
              ) : (
                <div className="rrow" key={r.id}>
                  <Pchip slug={acc?.provider_slug} name={provName[acc?.provider_slug]} />
                  <span className="rname">
                    <span className="rtxt">{r.name} {r.external_ref && <span className="mono faint">{r.external_ref}</span>}</span>
                    <span className="rnote">
                      {r.notes ? `${r.notes} · ` : ''}{r.kind}
                      {acc && <> · <Link href={`/accounts?focus=${acc.slug}`}>{acc.label}</Link></>}
                    </span>
                  </span>
                  {r.environment && <Link href={`/projects?env=${r.environment}`} style={{ textDecoration: 'none' }}><Pill kind={r.environment} /></Link>}
                  <span className="rowactions">
                    {r.url && <a className="openlink" href={r.url} target="_blank" rel="noopener noreferrer">Open <Ext /></a>}
                    <button className="btn sm" onClick={() => setEditingRes(r.id)}>Edit</button>
                  </span>
                </div>
              );
            })}
            {shown.length === 0 && editingRes !== newKey && (
              <div className="rrow faint" style={{ fontSize: 13 }}>
                {kindHere ? `No ${params.kind} resource linked yet.` : 'No resources match.'}
              </div>
            )}
            {editingRes === newKey ? (
              <EntityForm entity="resources"
                row={{ project_slug: p.slug ?? '', environment: 'prod', kind: focusedHere && params.add ? ADD_KIND[params.add] || '' : '' }}
                fields={resFields} pk="id" isNew onSaved={savedRes} onCancel={() => setEditingRes(null)} />
            ) : (
              <div className="rrow">
                <button className="btn sm" onClick={() => setEditingRes(newKey)}>+ Add resource</button>
                {!isUn && editingProj !== p.slug && <button className="btn sm" onClick={() => setEditingProj(p.slug)}>Edit project</button>}
                {!isUn && <Link className="btn sm" href={`/domains?project=${p.slug}`}>Domains</Link>}
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
  const chips = [];
  if (params.provider) chips.push(`Provider: ${provName[params.provider] || params.provider}`);
  if (params.env) chips.push(`Environment: ${params.env}`);
  if (params.kind) chips.push(`Showing: ${params.kind}`);
  if (params.focus) chips.push(`Focused: ${projects.find((p) => p.slug === params.focus)?.name || params.focus}`);
  if (params.show === 'unassigned') chips.push('Unassigned resources');

  return (
    <>
      <h1 className="pagetitle">Projects</h1>
      <p className="pagesub">Every project and the full stack behind it. Edit, link and add anything — changes land in the registry immediately.</p>
      {chips.length > 0 && (
        <div className="filterchips">
          {chips.map((c) => <span key={c} className="fchip" style={{ paddingRight: 11 }}>{c}</span>)}
          <Link className="fchip" href="/projects">Clear filters <span>×</span></Link>
        </div>
      )}
      <div className="addbar">
        <input id="projects-filter" className="filter" placeholder="Filter projects, resources, refs, accounts…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="btn primary" onClick={() => setEditingProj('new')}>+ New project</button>
      </div>
      {editingProj === 'new' && (
        <div className="pcard" style={{ marginBottom: 14 }}>
          <EntityForm entity="projects" row={{ status: 'active' }} fields={projFields} pk="slug" isNew
            onSaved={savedProj} onCancel={() => setEditingProj(null)} />
        </div>
      )}
      {params.show === 'unassigned' && unCard && (
        <>
          <h2 className="viewtitle" style={{ marginTop: 8 }}>Unassigned — {unCount} resources not linked to a project</h2>
          <div className="grid" style={{ marginBottom: 24 }}>{unCard}</div>
          <h2 className="viewtitle">All projects</h2>
        </>
      )}
      <div className="grid">{cards}</div>
      {params.show !== 'unassigned' && unCard && (
        <>
          <h2 className="viewtitle">Unassigned — {unCount} resources not linked to a project</h2>
          <div className="grid">{unCard}</div>
        </>
      )}
      {!cards.length && !unCard && <div className="empty">Nothing matches these filters. <Link href="/projects" style={{ color: 'var(--accent)' }}>Clear filters</Link></div>}
    </>
  );
}
