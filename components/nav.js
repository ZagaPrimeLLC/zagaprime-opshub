'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Wordmark } from '@/components/logo';
import Ticker from '@/components/ticker';

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/projects', label: 'Projects' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/databases', label: 'Databases' },
  { href: '/domains', label: 'Domains' },
  { href: '/news', label: 'Stack updates' },
  { href: '/channel', label: 'Channel' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === '/login') return null;

  function toggleTheme() {
    const r = document.documentElement;
    const current = r.dataset.theme || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    r.dataset.theme = next;
    try { localStorage.setItem('opshub-theme', next); } catch {}
  }

  async function logout() {
    await fetch('/api/login', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="toprow">
          <Link className="brand" href="/" aria-label="ZagaPrime Ops Hub home">
            <Wordmark size={32} id="zp-nav" />
          </Link>
          <div className="topactions">
            <button className="iconbtn" onClick={toggleTheme} aria-label="Toggle light or dark theme">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" /></svg>
            </button>
            <button className="textbtn" onClick={logout}>Sign out</button>
          </div>
        </div>
        <nav className="tabs">
          {LINKS.map((l) => {
            const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
            return (
              <Link key={l.href} className="tab" href={l.href} aria-current={active ? 'page' : undefined}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <Ticker />
      </div>
    </div>
  );
}
