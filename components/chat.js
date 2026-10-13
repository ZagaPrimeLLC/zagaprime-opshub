'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ZpMark } from '@/components/logo';

const SUGGESTIONS = [
  'What needs my attention today?',
  'Fix the most urgent stack update',
  'What are you working on right now?',
  'Which accounts and resources run Lebarty?',
  'Which domains have the weakest security scores?',
];

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      if (u.startsWith('/')) return `<a href="${u}" data-internal="1">${t}</a>`;
      if (/^https?:\/\//.test(u)) return `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`;
      return t;
    });
}
function md(src) {
  const out = [];
  let list = null;
  const flush = () => { if (list) { out.push(`<${list.t}>${list.items.join('')}</${list.t}>`); list = null; } };
  for (const raw of src.split('\n')) {
    const line = raw.trimEnd();
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const t = ul ? 'ul' : 'ol';
      if (!list || list.t !== t) { flush(); list = { t, items: [] }; }
      list.items.push(`<li>${inline((ul || ol)[1])}</li>`);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = line.match(/^#{1,6}\s+(.*)$/);
    out.push(`<p>${h ? `<b>${inline(h[1])}</b>` : inline(line)}</p>`);
  }
  flush();
  return out.join('');
}

export default function Chat() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    try { const saved = sessionStorage.getItem('zp-chat'); if (saved) setMsgs(JSON.parse(saved)); } catch {}
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem('zp-chat', JSON.stringify(msgs.slice(-30))); } catch {}
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs]);

  if (pathname === '/login') return null;

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    const history = [...msgs.filter((m) => !m.error && m.content), { role: 'user', content: q }];
    setMsgs([...history, { role: 'assistant', content: '' }]);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'The assistant is unavailable right now.');
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: acc }; return c; });
      }
    } catch (e) {
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: e.message, error: true }; return c; });
    }
    setBusy(false);
  }

  function onClickMsg(e) {
    const a = e.target.closest('a[data-internal]');
    if (a) { e.preventDefault(); router.push(a.getAttribute('href')); }
  }

  return (
    <>
      {open && (
        <div className="zp-chat" role="dialog" aria-label="Ezra">
          <div className="zp-chat-head">
            <ZpMark size={26} id="zp-chat" />
            <div>
              <div className="t">Ezra</div>
              <div className="s">Your stack superagent: knows every project and queues fixes for your review</div>
            </div>
            <div className="x">
              {msgs.length > 0 && <button onClick={() => setMsgs([])}>Clear</button>}
              <button onClick={() => setOpen(false)} aria-label="Close assistant">✕</button>
            </div>
          </div>
          <div className="zp-msgs" ref={listRef} onClick={onClickMsg}>
            {msgs.length === 0 && (
              <div className="zp-intro">
                I&apos;m <b>Ezra</b>. Ask me anything about the ZagaPrime stack: which account hosts what, project status,
                domain health, or today&apos;s news. Tell me to fix a stack update and I&apos;ll queue it, patch the affected
                repos on a branch, and open PRs for your review. Links in my answers open the right page.
              </div>
            )}
            {msgs.map((m, i) => (
              m.role === 'user'
                ? <div key={i} className="zp-msg user">{m.content}</div>
                : <div key={i} className={`zp-msg assistant${m.error ? ' err' : ''}`}>
                    {m.content
                      ? <div dangerouslySetInnerHTML={{ __html: m.error ? esc('⚠️ ' + m.content) : md(m.content) }} />
                      : <span className="zp-typing"><i /><i /><i /></span>}
                  </div>
            ))}
          </div>
          {msgs.length === 0 && (
            <div className="zp-sugg">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
            </div>
          )}
          <form className="zp-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea
              id="zp-chat-input"
              value={input}
              placeholder="Ask anything, or tell Ezra what to fix…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button className="btn primary" type="submit" disabled={busy || !input.trim()}>{busy ? '…' : 'Send'}</button>
          </form>
        </div>
      )}
      <button className="zp-fab" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Talk to Ezra">
        <span className="orb"><ZpMark size={18} id="zp-fab" /></span>
        <span className="lbl">{open ? 'Close' : 'Ezra'}</span>
      </button>
    </>
  );
}
