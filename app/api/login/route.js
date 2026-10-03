import { NextResponse } from 'next/server';
import { checkPassword, sessionToken, configured } from '@/lib/auth';

export async function POST(req) {
  if (!configured()) {
    return NextResponse.json(
      { error: 'Server not configured yet: set OPSHUB_PASSWORD and SESSION_SECRET environment variables.' },
      { status: 500 }
    );
  }
  const body = await req.json().catch(() => ({}));
  if (!checkPassword(body.password)) {
    return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('opshub_session', sessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('opshub_session', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
