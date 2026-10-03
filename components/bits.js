import { pcolor } from '@/lib/providers';

export function Pchip({ slug, name, big }) {
  const { c, fg } = pcolor(slug);
  const label = name || slug || '?';
  return (
    <span
      className="pchip"
      title={label}
      style={{ background: c, color: fg, ...(big ? { width: 26, height: 26, borderRadius: 8, fontSize: 12 } : {}) }}
    >
      {label[0]?.toUpperCase() || '?'}
    </span>
  );
}

export function Pill({ kind, children }) {
  return <span className={`pill ${kind || 'ghost'}`}>{children ?? kind}</span>;
}

export function Ext() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

export function BarList({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bars">
      {items.map((i) => (
        <div className="bar" key={i.label}>
          <span className="bl">{i.label}</span>
          <span className="bt"><span className="bf" style={{ width: `${Math.round((i.value / max) * 100)}%`, background: i.color || 'var(--accent)' }} /></span>
          <span className="bv">{i.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ parts, size = 120 }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = 44;
  const C = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="donutwrap">
      <svg width={size} height={size} viewBox="0 0 110 110" role="img" aria-label="Distribution">
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--panel2)" strokeWidth="14" />
        {parts.filter((p) => p.value > 0).map((p) => {
          const len = (p.value / total) * C;
          const el = (
            <circle key={p.label} cx="55" cy="55" r={r} fill="none" stroke={p.color} strokeWidth="14"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 55 55)" />
          );
          off += len;
          return el;
        })}
        <text x="55" y="53" textAnchor="middle" fill="var(--fg)" fontSize="19" fontWeight="700" fontFamily="var(--display)">{total}</text>
        <text x="55" y="68" textAnchor="middle" fill="var(--faint)" fontSize="8.5">total</text>
      </svg>
      <div className="legend">
        {parts.map((p) => (
          <span key={p.label}><span className="sw" style={{ background: p.color }} />{p.label} <b>{p.value}</b></span>
        ))}
      </div>
    </div>
  );
}
