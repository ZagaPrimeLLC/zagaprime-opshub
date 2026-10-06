'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Wordmark } from '@/components/logo';

const I = {
  overview: <path d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z" />,
  projects: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  accounts: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S13.9 16 14.5 19M16 4.6a3.2 3.2 0 0 1 0 6.8M17.5 14.7c1.7.6 2.7 1.9 3 4.3" /></>,
  databases: <><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v13c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8v-13M4.5 12c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8" /></>,
  domains: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" /></>,
  news: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" />,
  channel: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M10 9.5l5 2.5-5 2.5z" /></>,
};

function Icon({ name }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {I[name]}
    </svg>
  );
}

const GROUPS = [
  { label: null, links: [{ href: '/', label: 'Overview', icon: 'overview' }] },
  {
    label: 'Inventory',
    links: [
      { href: '/projects', label: 'Projects', icon: 'projects' },
      { href: '/accounts', label: 'Accounts', icon: 'accounts' },
      { href: '/databases', label: 'Databases', icon: 'databases' },
      { href: '/domains', label: 'Domains', icon: 'domains' },
    ],
  },
  {
    label: 'Intelligence',
    links: [
      { href: '/news', label: 'Stack updates', icon: 'news' },
      { href: '/channel', label: 'Channel', icon: 'channel' },
    ],
  },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === '/login') return null;

  function toggleTheme() {
    const r = document.documentElement;
    const current = r.dataset.theme || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    r.dataset.theme = next;
    try { localStorage.setItem('opshub-theme', next); } catch {}
  }

  async function logout() {
    await fetch('/api/login', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <aside className="sidebar">
      <Link className="side-brand" href="/" aria-label="ZagaPrime Ops Hub home">
        <Wordmark size={26} id="zp-nav" />
      </Link>
      {GROUPS.map((g, gi) => (
        <nav key={gi} aria-label={g.label || 'Main'} style={{ display: 'contents' }}>
          {g.label && <div className="side-label">{g.label}</div>}
          {g.links.map((l) => {
            const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
            return (
              <Link key={l.href} className="side-link" href={l.href} aria-current={active ? 'page' : undefined}>
                <Icon name={l.icon} />
                {l.label}
              </Link>
            );
          })}
        </nav>
      ))}
      <div className="side-foot">
        <button className="iconbtn" onClick={toggleTheme} aria-label="Toggle light or dark theme">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" /></svg>
        </button>
        <button className="textbtn" onClick={logout}>Sign out</button>
      </div>
    </aside>
  );
}
