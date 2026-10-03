'use client';
import { useState } from 'react';

export default function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) { window.location.href = '/'; return; }
    const body = await res.json().catch(() => ({}));
    setErr(body.error || 'Sign-in failed.');
    setBusy(false);
  }

  return (
    <form className="loginbox" onSubmit={submit}>
      <h1>ZagaPrime Ops Hub</h1>
      <p>Private dashboard. Enter the Ops Hub password to continue.</p>
      <input type="password" autoFocus placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <p style={{ color: 'var(--flag)' }}>{err}</p>}
      <button className="btn primary" disabled={busy || !pw} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
