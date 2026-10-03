'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/projects', label: 'Projects' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/domains', label: 'Domains' },
  { href: '/news', label: 'News' },
];

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="0" y="0" width="28" height="28" rx="7" fill="#2563eb" />
      <path d="M8 9h12l-8.5 7H20v3H8l8.5-7H8z" fill="#fff" />
    </svg>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === '/login') return null;

  function toggleTheme() {
    const r = document.documentElement;
    const next = r.dataset.theme === 'dark' ? 'light' : 'dark';
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
          <Link className="brand" href="/">
            <Logo />
            <span className="logotype">Zaga<b>Prime</b></span>
            <small>Ops Hub</small>
          </Link>
          <div className="topactions">
            <button className="iconbtn" onClick={toggleTheme} aria-label="Toggle theme">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" /></svg>
            </button>
            <button className="textbtn" onClick={logout}>Sign out</button>
          </div>
        </div>
        <nav className="tabs">
          {LINKS.map((l) => (
            <Link key={l.href} className="tab" href={l.href} aria-current={pathname === l.href ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
