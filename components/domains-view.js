'use client';
import { useMemo, useState } from 'react';
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
  if (v >= 80) return 'var(--ok)';
  if (v >= 60) return 'var(--accent)';
  if (v >= 40) return 'var(--warn)';
  return 'var(--flag)';
}

export default function DomainsView({ initial }) {
  const [domains, setDomains] = useState(initial.domains);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null); // domain | 'new'
  const { projects, accounts, resources } = initial;

  const projBy = useMemo(() => Object.fromEntries(projects.map((p) => [p.slug, p])), [projects]);
  const accBy = useMemo(() => Object.fromEntries(accounts.map((a) => [a.slug, a])), [accounts]);
  const q = filter.trim().toLowerCase();
  const match = (...f) => !q || f.some((x) => String(x ?? '').toLowerCase().includes(q));

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

  const shown = domains.filter((d) =>
    match(d.domain, d.description, d.built_with, d.status, projBy[d.project_slug]?.name, d.notes, d.improvements)
  );

  return (
    <>
      <h1 className="pagetitle">Domains</h1>
      <p className="pagesub">
        Every ZagaPrime domain and subdomain: what it is, how it was built, what it maps to — with baseline health scores
        across security, compliance, SEO, performance and risk posture. Scores are initial assessments; edit any card to update them after an audit.
      </p>

      <div className="stats">
        <div className="stat"><div className="v">{domains.length}</div><div className="l">Domains</div></div>
        {SCORE_KEYS.map((s) => {
          const v = avg(s.key);
          return (
            <div className="stat" key={s.key} style={{ borderTopColor: scoreColor(v) }}>
              <div className="v">{v ?? '—'}</div><div className="l">Avg {s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="addbar">
        <input className="filter" placeholder="Filter domains, stacks, projects…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="btn primary" onClick={() => setEditing('new')}>+ Add domain</button>
      </div>
      {editing === 'new' && (
        <div className="pcard" style={{ marginBottom: 14 }}>
          <EntityForm entity="domains" row={{ status: 'live' }} fields={fields} pk="domain" isNew onSaved={saved} onCancel={() => setEditing(null)} />
        </div>
      )}

      <div className="domgrid">
        {shown.map((d) => {
          const proj = projBy[d.project_slug];
          const res = resources.filter((r) => r.project_slug === d.project_slug && d.project_slug).slice(0, 6);
          if (editing === d.domain) {
            return (
              <div className="dcard" key={d.domain}>
                <EntityForm entity="domains" row={d} fields={fields} pk="domain" onSaved={saved} onCancel={() => setEditing(null)} onDeleted={deleted} />
              </div>
            );
          }
          return (
            <div className="dcard" key={d.domain}>
              <div className="dhead">
                <span className="dname">{d.domain}</span>
                <Pill kind={d.status || 'unknown'} />
              </div>
              <div className="dbody">
                {d.description && <p className="ddesc">{d.description}</p>}
                {d.built_with && <div className="dbuilt"><b>Built with:</b> {d.built_with}</div>}
                <div className="dres">
                  {proj && <span>Project: <b style={{ color: 'var(--fg)' }}>{proj.name}</b></span>}
                  {d.dns_account && accBy[d.dns_account] && <span>· DNS: {accBy[d.dns_account].label}</span>}
                  {d.registrar_account && accBy[d.registrar_account] && <span>· Registrar: {accBy[d.registrar_account].label}</span>}
                </div>
                {res.length > 0 && (
                  <div className="dres">
                    {res.map((r) => (
                      r.url
                        ? <a className="rlink" key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"><Pchip slug={accBy[r.account_slug]?.provider_slug} /> {r.name}</a>
                        : <span className="rlink" key={r.id}><Pchip slug={accBy[r.account_slug]?.provider_slug} /> {r.name}</span>
                    ))}
                  </div>
                )}
                <div className="scores">
                  {SCORE_KEYS.map((s) => {
                    const v = d[s.key];
                    return (
                      <div className="score" key={s.key}>
                        <span className="sl">{s.label}</span>
                        <span className="st"><span className="sf" style={{ width: `${v ?? 0}%`, background: scoreColor(v) }} /></span>
                        <span className="sv">{v ?? '—'}</span>
                      </div>
                    );
                  })}
                </div>
                {d.improvements && <div className="dimprove">{d.improvements}</div>}
              </div>
              <div className="dfoot">
                <a className="btn sm" href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer">Visit <Ext /></a>
                <button className="btn sm" onClick={() => setEditing(d.domain)}>Edit</button>
              </div>
            </div>
          );
        })}
      </div>
      {q && !shown.length && <div className="empty">Nothing matches “{filter}”.</div>}
    </>
  );
}
