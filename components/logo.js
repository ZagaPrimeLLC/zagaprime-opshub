// ZagaPrime "ZP" mark, recreated as a crisp vector from the brand logo.
export function ZpMark({ size = 28, id = 'zpg' }) {
  return (
    <svg width={size} height={size} viewBox="220 210 840 840" aria-hidden="true" style={{ flex: 'none' }}>
      <defs>
        <linearGradient id={id} x1="240" y1="0" x2="1040" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#14d4ff" />
          <stop offset="0.45" stopColor="#5f63ff" />
          <stop offset="0.72" stopColor="#a52cff" />
          <stop offset="1" stopColor="#ff00c8" />
        </linearGradient>
      </defs>
      <path
        d="M270 268 H820 L420 492 H825 A174 174 0 0 1 825 840 H727 V892 A106 106 0 0 1 515 892 V630"
        fill="none" stroke={`url(#${id})`} strokeWidth="60" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ size = 28, sub = 'Ops Hub', id }) {
  return (
    <span className="wordmark">
      <ZpMark size={size} id={id} />
      <span className="wm-text">
        <span className="wm-name">zagaprime</span>
        <span className="wm-sub">{sub}</span>
      </span>
    </span>
  );
}
