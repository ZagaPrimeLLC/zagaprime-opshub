// Tiny markdown -> HTML renderer for agent-written briefs. Escapes everything first, then
// applies a small whitelist of transforms, so arbitrary HTML in a brief never reaches the page.

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function mdToHtml(md) {
  const lines = esc(String(md || '')).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let list = null; // 'ul' | 'ol'
  let para = [];

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    const ul = line.match(/^[-*]\s+(.*)/);
    const ol = line.match(/^\d+[.)]\s+(.*)/);

    if (!line.trim()) { flushPara(); closeList(); continue; }
    if (h) {
      flushPara(); closeList();
      const level = Math.min(h[1].length + 2, 5); // # -> h3 so the page keeps one h1
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
    } else if (ul || ol) {
      flushPara();
      const kind = ul ? 'ul' : 'ol';
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
    } else if (/^---+$/.test(line.trim())) {
      flushPara(); closeList(); out.push('<hr />');
    } else {
      closeList();
      para.push(line.trim());
    }
  }
  flushPara(); closeList();
  return out.join('\n');
}
