import { NextResponse } from 'next/server';
import { buildContext } from '@/lib/context';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

function systemPrompt(context) {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' });
  return `You are ZP, the assistant inside the ZagaPrime Ops Hub (dashboard.zagaprime.com), Kelvin Zee's private command center for ZagaPrime Technologies. It is ${now} (New York).

How to answer:
- Answer from the live snapshot below. If something is not in it, say so plainly and suggest where to add it.
- Be direct and confident. Lead with the answer. Keep it short; use bullets for lists.
- Link to dashboard pages with relative markdown links so Kzee can click straight through:
  /projects?focus=<project-slug>, /projects?show=unassigned, /accounts?focus=<account-slug>, /domains?focus=<domain>, /news?crit=<critical|high|medium|low>, /channel, /channel?tab=<ai|tech|dev|video|podcast>.
- For news questions, cite the headline source and link the article URL.
- Never invent credentials or secrets. Credentials live in Bitwarden; you only know login hints.
- When asked what needs attention, prioritise: critical/high stack updates, flags, low domain scores, unmapped resources.

LIVE SNAPSHOT
${context}`;
}

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'The assistant needs an Anthropic API key. Add ANTHROPIC_API_KEY in Vercel → zagaprime-opshub → Settings → Environment Variables, then redeploy.' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Send a question.' }, { status: 400 });
  }

  let context;
  try { context = await buildContext(); }
  catch (e) { context = `(Live registry unavailable: ${e.message})`; }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      stream: true,
      system: [{ type: 'text', text: systemPrompt(context), cache_control: { type: 'ephemeral' } }],
      messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    let msg = `Anthropic API error ${upstream.status}.`;
    try { msg += ' ' + (JSON.parse(detail).error?.message || ''); } catch {}
    return NextResponse.json({ error: msg.trim() }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buf = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const json = line.slice(5).trim();
              if (!json) continue;
              try {
                const ev = JSON.parse(json);
                if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') controller.enqueue(encoder.encode(ev.delta.text));
                if (ev.type === 'error') controller.enqueue(encoder.encode(`\n\n⚠️ ${ev.error?.message || 'Stream error'}`));
              } catch {}
            }
          }
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n⚠️ Connection interrupted: ${e.message}`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
