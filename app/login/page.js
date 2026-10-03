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
    <div className="loginwrap">
      <form className="loginbox" onSubmit={submit}>
        <img src="/brand/zagaprime-logo.jpg" alt="ZagaPrime Technologies" />
        <p>Ops Hub · private command center. Enter your password to continue.</p>
        <input id="opshub-password" type="password" autoFocus placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p style={{ color: '#ff6b85' }}>{err}</p>}
        <button className="btn primary" disabled={busy || !pw} type="submit" style={{ justifyContent: 'center', padding: '9px 12px' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
