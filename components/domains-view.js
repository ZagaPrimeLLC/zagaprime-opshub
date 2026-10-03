'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Pchip, Pill, Ext } from '@/components/bits';
import { EntityForm } from '@/components/crud';

const SCORE_KEYS = [
  { key: 'score_security', label: 'Security' },
  { key: 'score_compliance', label: 'Compliance' },
  { key: 'score_seo', label: 'SEO' },
  { key: 'score_performance', label: 'Performance' },
  { key: 'score_risk', label: 'Risk posture' },
];

function scoreColor(v) {
  if (v == null) return 'var(--line2)';
  if (v >= 80) return 'linear-gradient(90deg,#14d4ff,#2fd38a)';
  if (v >= 60) return 'linear-gradient(90deg,#5f63ff,#a52cff)';
  if (v >= 40) return 'var(--warn)';
  return 'var(--flag)';
}

export default function DomainsView({ initial, params }) {
  const [domains, setDomains] = useState(initial.domains);
  const [filter, setFilter] = useState(params.q || '');
  const [editing, setEditing] = useState(params.add ? 'new' : null);
  const { projects, accounts, resources } = initial;

  const projBy = useMemo(() => Object.fromEntries(projects.map((p) => [p.slug, p])), [projects]);
  const accBy = useMemo(() => Object.fromEntries(accounts.map((a) => [a.slug, a])), [accounts]);
  const provName = useMemo(() => Object.fromEntries(initial.providers.map((p) => [p.slug, p.name])), [initial.providers]);
  const q = filter.trim().toLowerCase();
  const match = (...f) => !q || f.some((x) => String(x ?? '').toLowerCase().includes(q));

  useEffect(() => {
    if (!params.focus && !params.add) return;
    const id = params.add ? 'dom-new' : `d-${params.focus}`;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => clearTimeout(t);
  }, [params.focus, params.add]);

  const accountOptions = accounts.map((a) => ({ v: a.slug, l: a.label }));
  const projectOptions = projects.map((p) => ({ v: p.slug, l: p.name }));
  const fields = [
    { name: 'domain', label: 'Domain / subdomain' },
    { name: 'status', label: 'Status', type: 'select', options: ['live', 'staging', 'parked', 'unknown', 'retired'].map((v) => ({ v, l: v })) },
    { name: 'project_slug', label: 'Project', type: 'select', options: projectOptions },
    { name: 'registrar_account', label: 'Registrar account', type: 'select', options: accountOptions },
    { name: 'dns_account', label: 'DNS account', type: 'select', options: accountOptions },
    { name: 'description', label: 'What it is', type: 'textarea' },
    { name: 'built_with', label: 'How it was built', wide: true },
    { name: 'score_security', label: 'Security 0-100' },
    { name: 'score_compliance', label: 'Compliance 0-100' },
    { name: 'score_seo', label: 'SEO 0-100' },
    { name: 'score_performance', label: 'Performance 0-100' },
    { name: 'score_risk', label: 'Risk posture 0-100' },
    { name: 'improvements', label: 'Improvements to make', type: 'textarea' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  function saved(row) {
    setDomains((ds) => {
      const i = ds.findIndex((x) => x.domain === row.domain);
      if (i === -1) return [...ds, row].sort((a, b) => a.domain.localeCompare(b.domain));
      const copy = [...ds]; copy[i] = row; return copy;
    });
    setEditing(null);
  }
  function deleted(row) { setDomains((ds) => ds.filter((x) => x.domain !== row.domain)); setEditing(null); }

  const avg = (key) => {
    const vals = domains.map((d) => d[key]).filter((v) => v != null);
    return vals.length ? Math.round(vals.reduce((s, v) => s + Number(v), 0) / vals.length) : null;
  };

  let shown = domains.filter((d) =>
    (!params.project || d.project_slug === params.project) &&
    match(d.domain, d.description, d.built_with, d.status, projBy[d.project_slug]?.name, d.notes, d.improvements)
  );
  if (params.sort) shown = [...shown].sort((a, b) => (a[params.sort] ?? 999) - (b[params.sort] ?? 999));

  const chips = [];
  if (params.project) chips.push(`Project: ${projBy[params.project]?.name || params.project}`);
  if (params.sort) chips.push(`Sorted by ${SCORE_KEYS.find((s) => s.key === params.sort)?.label || params.sort}, weakest first`);
  if (params.focus) chips.push(`Focused: ${params.focus}`);

  return (
    <>
      <h1 className="pagetitle">Domains</h1>
      <p className="pagesub">
        Every ZagaPrime domain and subdomain: what it is, how it was built, what it maps to — with health scores
        for security, compliance, SEO, performance and risk posture. Click a score tile to rank by it; click any bar to edit after an audit.
      </p>

      <div className="stats">
        <Link className="stat clicky" href="/domains"><div className="v">{domains.length}</div><div className="l"><span>Domains</span><span className="go">→</span></div></Link>
        {SCORE_KEYS.map((s) => (
          <Link className="stat clicky" key={s.key} href={`/domains?sort=${s.key}`}>
            <div className="v">{avg(s.key) ?? '—'}</div><div className="l"><span>Avg {s.label}</span><span className="go">↕</span></div>
          </Link>
        ))}
      </div>

      {chips.length > 0 && (
        <div className="filterchips">
          {chips.map((c) => <span key={c} className="fchip" style={{ paddingRight: 11 }}>{c}</span>)}
          <Link className="fchip" href="/domains">Clear filters <span>×</span></Link>
        </div>
      )}
      <div className="addbar">
        <input id="domains-filter" className="filter" placeholder="Filter domains, stacks, projects…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="btn primary" onClick={() => setEditing('new')}>+ Add domain</button>
      </div>
      {editing === 'new' && (
        <div className="pcard focused" id="dom-new" style={{ marginBottom: 14 }}>
          <EntityForm entity="domains" row={{ status: 'live', project_slug: params.add || '' }} fields={fields} pk="domain" isNew onSaved={saved} onCancel={() => setEditing(null)} />
        </div>
      )}

      <div className="domgrid">
        {shown.map((d) => {
          const proj = projBy[d.project_slug];
          const res = d.project_slug ? resources.filter((r) => r.project_slug === d.project_slug).slice(0, 6) : [];
          const focused = params.focus === d.domain ? ' focused' : '';
          if (editing === d.domain) {
            return (
              <div className={`dcard${focused}`} key={d.domain} id={`d-${d.domain}`}>
                <EntityForm entity="domains" row={d} fields={fields} pk="domain" onSaved={saved} onCancel={() => setEditing(null)} onDeleted={deleted} />
              </div>
            );
          }
          return (
            <div className={`dcard${focused}`} key={d.domain} id={`d-${d.domain}`}>
              <div className="dhead">
                <span className="dname">{d.domain}</span>
                <Pill kind={d.status || 'unknown'} />
              </div>
              <div className="dbody">
                {d.description && <p className="ddesc">{d.description}</p>}
                {d.built_with && <div className="dbuilt"><b>Built with:</b> {d.built_with}</div>}
                <div className="dres">
                  {proj && <span>Project: <Link className="plink" href={`/projects?focus=${proj.slug}`}>{proj.name}</Link></span>}
                  {d.dns_account && accBy[d.dns_account] && <span>· DNS: <Link className="alink" href={`/accounts?focus=${d.dns_account}`}>{accBy[d.dns_account].label}</Link></span>}
                  {d.registrar_account && accBy[d.registrar_account] && <span>· Registrar: <Link className="alink" href={`/accounts?focus=${d.registrar_account}`}>{accBy[d.registrar_account].label}</Link></span>}
                </div>
                {res.length > 0 && (
                  <div className="dres">
                    {res.map((r) => {
                      const ps = accBy[r.account_slug]?.provider_slug;
                      return r.url
                        ? <a className="rlink" key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" title={`Open ${r.name} console`}><Pchip slug={ps} name={provName[ps]} /> {r.name}</a>
                        : <span className="rlink" key={r.id}><Pchip slug={ps} name={provName[ps]} /> {r.name}</span>;
                    })}
                  </div>
                )}
                <div className="scores">
                  {SCORE_KEYS.map((s) => {
                    const v = d[s.key];
                    return (
                      <button className="score" key={s.key} onClick={() => setEditing(d.domain)} title={`Edit ${s.label} score`} style={{ width: '100%', textAlign: 'left', padding: 0 }}>
                        <span className="sl">{s.label}</span>
                        <span className="st"><span className="sf" style={{ width: `${v ?? 0}%`, background: scoreColor(v) }} /></span>
                        <span className="sv">{v ?? '—'}</span>
                      </button>
                    );
                  })}
                </div>
                {d.improvements && <div className="dimprove">{d.improvements}</div>}
              </div>
              <div className="dfoot">
                <a className="btn sm" href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer">Visit <Ext /></a>
                {proj && <Link className="btn sm" href={`/projects?focus=${proj.slug}`}>Stack</Link>}
                <button className="btn sm" onClick={() => setEditing(d.domain)}>Edit</button>
              </div>
            </div>
          );
        })}
      </div>
      {!shown.length && <div className="empty">No domains match. <Link href="/domains" style={{ color: 'var(--accent)' }}>Clear filters</Link></div>}
    </>
  );
}
