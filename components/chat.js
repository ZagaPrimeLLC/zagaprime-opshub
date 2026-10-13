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

// Attached images are downscaled in the browser (long edge 1568px, the size the model reads at full
// detail) and re-encoded as JPEG, which keeps a request with several screenshots well under Vercel's
// 4.5 MB body limit.
const MAX_IMAGES = 4;
const MAX_EDGE = 1568;
const MAX_TOTAL_B64 = 3_500_000;

async function shrinkImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent PNGs would otherwise turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const url = canvas.toDataURL('image/jpeg', 0.9);
  return { media_type: 'image/jpeg', data: url.slice(url.indexOf(',') + 1), url, name: file.name || 'pasted image' };
}

// Only the latest message with images re-sends them; older ones become a text note so long chats
// don't re-upload every screenshot on each turn.
function toPayload(history) {
  let last = -1;
  history.forEach((m, i) => { if (m.images?.length) last = i; });
  return history.map((m, i) => {
    const out = { role: m.role, content: m.content || '' };
    if (i === last) out.images = m.images.map(({ media_type, data }) => ({ media_type, data }));
    else if (m.images?.length || m.imgCount) {
      const n = m.images?.length || m.imgCount;
      out.content = `${out.content}\n[${n} image${n > 1 ? 's' : ''} attached earlier]`.trim();
    }
    return out;
  });
}

// sessionStorage keeps the conversation across page loads but not the image bytes (they would
// blow the storage quota), just how many there were.
function forStorage(msgs) {
  return msgs.slice(-30).map(({ images, ...m }) => (images?.length ? { ...m, imgCount: images.length } : m));
}

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
  const [pending, setPending] = useState([]);
  const [attachErr, setAttachErr] = useState('');
  const listRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    try { const saved = sessionStorage.getItem('zp-chat'); if (saved) setMsgs(JSON.parse(saved)); } catch {}
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem('zp-chat', JSON.stringify(forStorage(msgs))); } catch {}
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs]);

  if (pathname === '/login') return null;

  async function addFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    setAttachErr('');
    const room = MAX_IMAGES - pending.length;
    if (room <= 0) { setAttachErr(`Up to ${MAX_IMAGES} images per message.`); return; }
    if (files.length > room) setAttachErr(`Up to ${MAX_IMAGES} images per message; extra ones were skipped.`);
    const added = [];
    for (const f of files.slice(0, room)) {
      try { added.push(await shrinkImage(f)); }
      catch { setAttachErr(`Couldn't read ${f.name || 'that image'}.`); }
    }
    const next = [...pending, ...added].slice(0, MAX_IMAGES);
    if (next.reduce((n, im) => n + im.data.length, 0) > MAX_TOTAL_B64) {
      setAttachErr('Those images are too large together; send fewer at a time.');
      return;
    }
    setPending(next);
  }

  async function send(text) {
    const q = (text ?? input).trim();
    const images = text == null ? pending : [];
    if ((!q && !images.length) || busy) return;
    setInput('');
    setPending([]);
    setAttachErr('');
    const userMsg = { role: 'user', content: q };
    if (images.length) userMsg.images = images;
    const history = [...msgs.filter((m) => !m.error && (m.content || m.images?.length || m.imgCount)), userMsg];
    setMsgs([...history, { role: 'assistant', content: '' }]);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: toPayload(history) }),
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
        <div className="zp-chat" role="dialog" aria-label="Ezra"
          onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }}
          onDrop={(e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } }}>
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
                repos on a branch, and open PRs for your review. Attach a screenshot (📎, paste, or drop) and I&apos;ll read
                and analyze it. Links in my answers open the right page.
              </div>
            )}
            {msgs.map((m, i) => (
              m.role === 'user'
                ? <div key={i} className="zp-msg user">
                    {m.images?.length > 0 && (
                      <div className="zp-msg-imgs">
                        {m.images.map((im, j) => <img key={j} src={im.url} alt={im.name || 'attached image'} />)}
                      </div>
                    )}
                    {!m.images?.length && m.imgCount > 0 && (
                      <div className="zp-msg-imgnote">📎 {m.imgCount} image{m.imgCount > 1 ? 's' : ''} attached</div>
                    )}
                    {m.content}
                  </div>
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
          {(pending.length > 0 || attachErr) && (
            <div className="zp-attachments">
              {pending.map((im, i) => (
                <div key={i} className="zp-thumb">
                  <img src={im.url} alt={im.name} />
                  <button type="button" aria-label={`Remove ${im.name}`} onClick={() => setPending((p) => p.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              {attachErr && <span className="zp-attach-err">{attachErr}</span>}
            </div>
          )}
          <form className="zp-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              hidden
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
            <button
              type="button"
              className="zp-attach"
              onClick={() => fileRef.current?.click()}
              disabled={busy || pending.length >= MAX_IMAGES}
              aria-label="Attach images"
              title="Attach images (or paste / drop them here)"
            >📎</button>
            <textarea
              id="zp-chat-input"
              value={input}
              placeholder={pending.length ? 'Ask about the image, or just send it…' : 'Ask anything, or tell Ezra what to fix…'}
              onChange={(e) => setInput(e.target.value)}
              onPaste={(e) => { if (e.clipboardData?.files?.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button className="btn primary" type="submit" disabled={busy || (!input.trim() && !pending.length)}>{busy ? '…' : 'Send'}</button>
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
