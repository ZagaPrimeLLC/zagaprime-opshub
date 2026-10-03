import { NextResponse } from 'next/server';

const PUBLIC = ['/login', '/api/login', '/api/health'];

async function expectedToken(secret) {
  const data = new TextEncoder().encode('opshub:' + secret);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
