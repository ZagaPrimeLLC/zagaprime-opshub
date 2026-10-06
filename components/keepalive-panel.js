'use client';
import Link from 'next/link';
import { useState } from 'react';

function ago(iso) {
  if (!iso) return 'never';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export default function KeepalivePanel({ initial, accounts, projects }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const accBy = Object.fromEntries(accounts.map((a) => [a.slug, a]));
  const projBy = Object.fromEntries(projects.map((p) => [p.slug, p]));

  async function pingNow() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/keepalive', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Ping failed');
      const byId = Object.fromEntries(j.results.map((r) => [r.id, r]));
      setRows((rs) => rs.map((r) => byId[r.id]
        ? { ...r, last_ping_ok: byId[r.id].ok, last_ping_note: byId[r.id].note, last_ping_ms: byId[r.id].ms, last_ping_at: j.at }
        : r));
      setMsg(`${j.healthy}/${j.pinged} databases answered.`);
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  const ok = rows.filter((r) => r.last_ping_ok).length;

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="addbar" style={{ margin: 0, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>
          Pinged every day at about 7am ET so free Supabase projects never pause. <b style={{ color: 'var(--fg)' }}>{ok}/{rows.length}</b> confirmed awake. {msg}
        </span>
        <button className="btn primary sm" onClick={pingNow} disabled={busy}>{busy ? 'Pinging…' : 'Ping all now'}</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="srctable">
          <thead><tr><th>Database</th><th>Account</th><th>Project</th><th>Status</th><th>Last ping</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <b style={{ fontWeight: 600 }}>{r.name}</b>
                  <div className="mono faint" style={{ fontSize: 10.5 }}>{r.external_ref || 'project ref missing'}</div>
                </td>
                <td style={{ fontSize: 12.5 }}>{accBy[r.account_slug] ? <Link href={`/accounts?focus=${r.account_slug}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{accBy[r.account_slug].login_hint || accBy[r.account_slug].label}</Link> : '—'}</td>
                <td style={{ fontSize: 12.5 }}>{projBy[r.project_slug] ? <Link href={`/projects?focus=${r.project_slug}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{projBy[r.project_slug].name}</Link> : '—'}</td>
                <td style={{ fontSize: 12.5 }}>
                  <span className="okdot" style={{ background: r.last_ping_ok ? 'var(--ok)' : r.last_ping_at ? 'var(--flag)' : 'var(--warn)' }} />
                  {r.last_ping_ok ? `Awake${r.last_ping_ms ? ` · ${r.last_ping_ms}ms` : ''}` : (r.last_ping_note || 'Not pinged yet')}
                </td>
                <td className="mono" style={{ fontSize: 11.5, color: 'var(--faint)' }}>{ago(r.last_ping_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
