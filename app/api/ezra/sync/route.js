import { NextResponse } from 'next/server';
import { syncEzraPrs } from '@/lib/ezra-sync';

export const dynamic = 'force-dynamic';

// POST: check every pr-open Ezra job against GitHub now (the "Sync with GitHub" button).
export async function POST() {
  try {
    return NextResponse.json({ ok: true, ...(await syncEzraPrs({ force: true })) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.code === 'NO_DB_URL' ? 503 : 500 });
  }
}
