'use client';
import { useState } from 'react';

export async function api(entity, method, body, id) {
  const url = `/api/data/${entity}` + (method === 'DELETE' ? `?id=${encodeURIComponent(id)}` : '');
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${method} ${entity} failed`);
  return data;
}

/**
 * Generic inline editor.
 * fields: [{ name, label, type?: 'text'|'select'|'textarea', options?: [{v,l}], placeholder? }]
 */
export function EntityForm({ entity, row, fields, pk, isNew, onSaved, onCancel, onDeleted }) {
  const [vals, setVals] = useState(() => {
    const v = {};
    for (const f of fields) v[f.name] = row?.[f.name] ?? '';
    return v;
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  function set(name, value) { setVals((p) => ({ ...p, [name]: value })); }

  async function save() {
    setBusy(true); setErr('');
    try {
      const data = isNew
        ? await api(entity, 'POST', vals)
        : await api(entity, 'PATCH', { ...vals, __id: row[pk] });
      onSaved(data.row);
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  async function del() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setBusy(true); setErr('');
    try { await api(entity, 'DELETE', null, row[pk]); onDeleted(row); }
    catch (e) { setErr(e.message); setBusy(false); setConfirmDel(false); }
  }

  return (
    <div className="editgrid">
      {fields.map((f) => (
        <label key={f.name} className={f.type === 'textarea' || f.wide ? 'full' : ''}>
          {f.label}
          {f.type === 'select' ? (
            <select value={vals[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}>
              <option value="">—</option>
              {f.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea rows={2} value={vals[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
          ) : (
            <input value={vals[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
          )}
        </label>
      ))}
      <div className="formactions">
        {err && <span className="err">{err}</span>}
        {!isNew && onDeleted && (
          <button className="btn sm danger" onClick={del} disabled={busy}>
            {confirmDel ? 'Really delete?' : 'Delete'}
          </button>
        )}
        <button className="btn sm" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn sm primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

export const ENV_OPTIONS = ['prod', 'staging', 'preview', 'dev'].map((v) => ({ v, l: v }));
export const KIND_OPTIONS = [
  'Supabase project', 'Vercel project', 'CF worker', 'CF zone', 'Neon project', 'Base44 app',
  'Repo', 'Automation', 'Payments', 'Email', 'Storage', 'Other',
].map((v) => ({ v, l: v }));
