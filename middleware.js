import { NextResponse } from 'next/server';

const PUBLIC = ['/login', '/api/login', '/api/health', '/api/feed-health'];

async function expectedToken(secret) {
  const data = new TextEncoder().encode('opshub:' + secret);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();

  // The daily stack-news agent posts here with its own token; it can only add news items.
  if (pathname === '/api/ingest/news') {
    const token = process.env.NEWS_INGEST_TOKEN;
    if (token && req.headers.get('authorization') === `Bearer ${token}`) return NextResponse.next();
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  // Vercel's daily cron for the database keep-alive. With CRON_SECRET set, Vercel sends it as a
  // bearer token; without it, accept Vercel's cron user agent (the job only pings public endpoints).
  if (pathname === '/api/keepalive' && req.method === 'GET') {
    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.get('authorization');
    if (cronSecret ? auth === `Bearer ${cronSecret}` : /vercel-cron/i.test(req.headers.get('user-agent') || '')) {
      return NextResponse.next();
    }
  }

  const secret = process.env.SESSION_SECRET;
  const cookie = req.cookies.get('opshub_session')?.value;
  if (secret && cookie && cookie === (await expectedToken(secret))) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|brand/|robots.txt).*)'],
};
