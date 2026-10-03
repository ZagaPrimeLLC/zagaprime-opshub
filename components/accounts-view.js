'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Pchip, Ext } from '@/components/bits';
import { EntityForm } from '@/components/crud';

export default function AccountsView({ initial, params }) {
  const [accounts, setAccounts] = useState(initial.accounts);
  const [providers, setProviders] = useState(initial.providers);
  const [filter, setFilter] = useState(params.q || '');
  const [editing, setEditing] = useState(null);
  const resources = initial.resources;
  const projects = initial.projects;

  const q = filter.trim().toLowerCase();
  const match = (...f) => !q || f.some((x) => String(x ?? '').toLowerCase().includes(q));
  const projBy = useMemo(() => Object.fromEntries(projects.map((p) => [p.slug, p])), [projects]);

  useEffect(() => {
    const id = params.focus ? `a-${params.focus}` : params.provider ? `prov-${params.provider}` : null;
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => clearTimeout(t);
  }, [params.focus, params.provider]);

  const providerOptions = providers.map((p) => ({ v: p.slug, l: p.name }));
  const accFields = [
    { name: 'slug', label: 'Slug (short id)' },
    { name: 'provider_slug', label: 'Provider', type: 'select', options: providerOptions },
    { name: 'label', label: 'Label' },
    { name: 'login_hint', label: 'Login / email / org' },
    { name: 'console_url', label: 'Console URL', wide: true },
    { name: 'bitwarden_url', label: 'Bitwarden item link', wide: true, placeholder: 'https://vault.bitwarden.com/#/vault?itemId=…' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];
  const provFields = [
    { name: 'slug', label: 'Slug' },
    { name: 'name', label: 'Name' },
    { name: 'category', label: 'Category' },
    { name: 'console_url', label: 'Console URL', wide: true },
  ];

  function savedAcc(row) {
    setAccounts((as) => {
      const i = as.findIndex((a) => a.slug === row.slug);
      if (i === -1) return [...as, row].sort((a, b) => a.label.localeCompare(b.label));
      const copy = [...as]; copy[i] = row; return copy;
    });
    setEditing(null);
  }
  function deletedAcc(row) { setAccounts((as) => as.filter((a) => a.slug !== row.slug)); setEditing(null); }
  function savedProv(row) { setProviders((ps) => [...ps.filter((p) => p.slug !== row.slug), row].sort((a, b) => a.name.localeCompare(b.name))); setEditing(null); }

  const passes = (a, P) =>
    (!params.missing || (params.missing === 'bitwarden' && !a.bitwarden_url)) &&
    (match(a.label, a.login_hint, a.notes, P.name) || resources.some((r) => r.account_slug === a.slug && match(r.name, r.external_ref)));

  function acard(a) {
    const res = resources.filter((r) => r.account_slug === a.slug);
    const projSlugs = [...new Set(res.map((r) => r.project_slug).filter(Boolean))];
    const focused = params.focus === a.slug ? ' focused' : '';
    if (editing === a.slug) {
      return (
        <div className={`acard${focused}`} key={a.slug} id={`a-${a.slug}`} style={{ padding: 0, overflow: 'hidden' }}>
          <EntityForm entity="accounts" row={a} fields={accFields} pk="slug"
            onSaved={savedAcc} onCancel={() => setEditing(null)} onDeleted={deletedAcc} />
        </div>
      );
    }
    return (
      <div className={`acard${focused}`} key={a.slug} id={`a-${a.slug}`}>
        <div className="alabel">{a.label}</div>
        <div className="alogin">{a.login_hint || '—'}</div>
        {a.notes && <div className="anote">{a.notes}</div>}
        {res.length > 0 && (
          <div className="aprojects">
            <b>{res.length}</b> resources · used by{' '}
            {projSlugs.length
              ? projSlugs.map((s, i) => <span key={s}>{i > 0 && ', '}<Link href={`/projects?focus=${s}`}>{projBy[s]?.name || s}</Link></span>)
              : '—'}
          </div>
        )}
        <div className="abtns">
          {a.console_url && <a className="btn sm" href={a.console_url} target="_blank" rel="noopener noreferrer">Console <Ext /></a>}
          {a.bitwarden_url
            ? <a className="btn sm" href={a.bitwarden_url} target="_blank" rel="noopener noreferrer">Bitwarden <Ext /></a>
            : <button className="btn sm" style={{ borderStyle: 'dashed', color: 'var(--faint)' }} onClick={() => setEditing(a.slug)}>+ Bitwarden link</button>}
          <button className="btn sm" onClick={() => setEditing(a.slug)}>Edit</button>
        </div>
      </div>
    );
  }

  const sections = providers.map((P) => {
    const accs = accounts.filter((a) => a.provider_slug === P.slug && passes(a, P));
    const total = accounts.filter((a) => a.provider_slug === P.slug).length;
    if (!accs.length && (q || params.missing)) return null;
    const focused = params.provider === P.slug ? ' focused' : '';
    return (
      <div className={`provsec${focused}`} key={P.slug} id={`prov-${P.slug}`} style={focused ? { borderRadius: 14, padding: 10 } : undefined}>
        <div className="provhead">
          <Pchip slug={P.slug} name={P.name} big />
          <span className="pname">{P.name}</span>
          <Link className="pmeta" href={`/projects?provider=${P.slug}`} style={{ textDecoration: 'none' }}>{total} account{total === 1 ? '' : 's'}{P.category ? ` · ${P.category}` : ''} · see resources →</Link>
          {P.console_url && <a className="consolelink" href={P.console_url} target="_blank" rel="noopener noreferrer">console <Ext /></a>}
        </div>
        <div className="acc-grid">{accs.map(acard)}</div>
      </div>
    );
  }).filter(Boolean);

  const chips = [];
  if (params.missing === 'bitwarden') chips.push('Missing Bitwarden link');
  if (params.focus) chips.push(`Focused: ${accounts.find((a) => a.slug === params.focus)?.label || params.focus}`);
  if (params.provider) chips.push(`Provider: ${providers.find((p) => p.slug === params.provider)?.name || params.provider}`);

  return (
    <>
      <h1 className="pagetitle">Accounts</h1>
      <p className="pagesub">Every login across every provider — console in one click, Bitwarden item beside it. Secrets never live here.</p>
      {chips.length > 0 && (
        <div className="filterchips">
          {chips.map((c) => <span key={c} className="fchip" style={{ paddingRight: 11 }}>{c}</span>)}
          <Link className="fchip" href="/accounts">Clear filters <span>×</span></Link>
        </div>
      )}
      <div className="addbar">
        <input id="accounts-filter" className="filter" placeholder="Filter accounts, logins, providers…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="btn primary" onClick={() => setEditing('new')}>+ Add account</button>
        <button className="btn" onClick={() => setEditing('new-provider')}>+ Add provider</button>
      </div>
      {editing === 'new' && (
        <div className="pcard" style={{ marginBottom: 14 }}>
          <EntityForm entity="accounts" row={{}} fields={accFields} pk="slug" isNew onSaved={savedAcc} onCancel={() => setEditing(null)} />
        </div>
      )}
      {editing === 'new-provider' && (
        <div className="pcard" style={{ marginBottom: 14 }}>
          <EntityForm entity="providers" row={{}} fields={provFields} pk="slug" isNew onSaved={savedProv} onCancel={() => setEditing(null)} />
        </div>
      )}
      {sections}
      {!sections.length && <div className="empty">Nothing matches. <Link href="/accounts" style={{ color: 'var(--accent)' }}>Clear filters</Link></div>}
    </>
  );
}
