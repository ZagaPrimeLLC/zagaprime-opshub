import { NextResponse } from 'next/server';
import { buildContext } from '@/lib/context';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const OPEN_STATUSES = ['queued', 'picked-up', 'in-progress', 'pr-open'];

function systemPrompt(context) {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' });
  return `You are Ezra, ZagaPrime's stack superagent, speaking inside the Ops Hub (dashboard.zagaprime.com), Kelvin Zee's private command center for ZagaPrime Technologies. It is ${now} (New York).

Who you are:
- You know the whole stack: every project, account, resource, domain, and open stack update in the snapshot below.
- You can act, not just answer. When Kzee asks you to fix, patch, or handle a stack update, use the queue_ezra_fix tool. A worker picks up queued jobs within the hour, applies the fix on a branch per affected repo, and opens pull requests for his review. Nothing merges without him.
- You can see images Kzee attaches (screenshots, error pages, dashboards, build logs, designs). Read them carefully: quote exact error text, name the service or project it belongs to from the snapshot, and say what to do next. If a screenshot shows a problem you can queue a fix for, offer to queue it.
- Use cancel_ezra_job when he asks to cancel a queued job. You cannot merge PRs, change infrastructure, or rotate secrets from here; say so and point to the PR instead.

How to answer:
- Answer from the live snapshot below. If something is not in it, say so plainly and suggest where to add it.
- Be direct and confident. Lead with the answer. Keep it short; use bullets for lists.
- When queueing a fix for a stack update, pass its id from the snapshot as news_id so the worker can map affected projects to repos. Only queue when Kzee clearly asks for a fix; confirm what you queued in one line. Do not queue duplicates: the Ezra queue section shows what is already open.
- Link to dashboard pages with relative markdown links so Kzee can click straight through:
  /projects?focus=<project-slug>, /projects?show=unassigned, /accounts?focus=<account-slug>, /domains?focus=<domain>, /news?crit=<critical|high|medium|low>, /brief, /channel, /channel?tab=<ai|tech|dev|video|podcast>.
- For news questions, cite the headline source and link the article URL.
- Never invent credentials or secrets. Credentials live in Bitwarden; you only know login hints.
- When asked what needs attention, prioritise: critical/high stack updates, flags, low domain scores, unmapped resources.

LIVE SNAPSHOT
${context}`;
}

const TOOLS = [
  {
    name: 'queue_ezra_fix',
    description: 'Queue a fix job for the Ezra worker. It maps the stack update to the affected repos, applies the fix on a branch, and opens PRs for Kzee to review. Use when Kzee asks to fix, patch, or handle a stack update or project issue.',
    input_schema: {
      type: 'object',
      properties: {
        news_id: { type: 'integer', description: 'The id of the stack update from the snapshot, when the job is about one. Omit for ad-hoc work.' },
        title: { type: 'string', description: 'Short job title, usually the stack update title or a one-line description of the fix.' },
        instruction: { type: 'string', description: 'Any extra direction Kzee gave (scope, specific projects, constraints).' },
      },
      required: ['title'],
    },
  },
  {
    name: 'cancel_ezra_job',
    description: 'Cancel an open Ezra queue job by its id (shown in the Ezra queue section of the snapshot).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'integer', description: 'The queue job id to cancel.' } },
      required: ['id'],
    },
  },
];

// Images attached in the chat panel: base64 only, a few common formats, at most 4 per message.
// The panel downscales before upload; the size cap here is the API's 5 MB per-image limit.
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MAX_IMAGES = 4;
const MAX_IMAGE_B64 = Math.floor((5 * 1024 * 1024 * 4) / 3);

function cleanImages(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((im) => IMAGE_TYPES.has(im?.media_type) && typeof im?.data === 'string'
      && im.data.length > 0 && im.data.length <= MAX_IMAGE_B64 && /^[A-Za-z0-9+/]+={0,2}$/.test(im.data))
    .slice(0, MAX_IMAGES)
    .map((im) => ({ media_type: im.media_type, data: im.data }));
}

async function runTool(name, input) {
  try {
    if (name === 'queue_ezra_fix') {
      const newsId = Number.isInteger(input?.news_id) ? input.news_id : null;
      const title = String(input?.title || '').slice(0, 300);
      if (!title) return { error: 'title is required' };
      if (newsId != null) {
        const dup = await q(
          `select id, status from proj_opsdash.ezra_queue where news_id = $1 and status = any($2) limit 1`,
          [newsId, OPEN_STATUSES]
        );
        if (dup.rows.length) return { already_queued: true, job: dup.rows[0] };
      }
      const r = await q(
        `insert into proj_opsdash.ezra_queue (news_id, title, instruction) values ($1,$2,$3) returning id, status, requested_at`,
        [newsId, title, input?.instruction ? String(input.instruction).slice(0, 4000) : null]
      );
      return { queued: true, job: r.rows[0], note: 'The hourly Ezra worker will pick this up and open PRs for review.' };
    }
    if (name === 'cancel_ezra_job') {
      const id = Number(input?.id);
      if (!Number.isInteger(id)) return { error: 'id is required' };
      const r = await q(
        `update proj_opsdash.ezra_queue set status = 'cancelled', updated_at = now() where id = $1 and status = any($2) returning id, status`,
        [id, OPEN_STATUSES]
      );
      return r.rows.length ? { cancelled: true, job: r.rows[0] } : { error: 'No open job with that id.' };
    }
    return { error: `Unknown tool ${name}` };
  } catch (e) {
    return { error: e.message };
  }
}

// Streams one Anthropic request, piping text deltas to the controller and
// collecting any tool_use blocks. Returns { stopReason, text, toolUses }.
async function streamOnce(key, system, messages, controller, encoder, final = false) {
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1500, stream: true, system, messages, tools: TOOLS,
      // The last round must answer in text: tools stay defined (earlier rounds used them) but can't be called.
      ...(final ? { tool_choice: { type: 'none' } } : {}),
    }),
  });
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    let msg = `Anthropic API error ${upstream.status}.`;
    try { msg += ' ' + (JSON.parse(detail).error?.message || ''); } catch {}
    throw new Error(msg.trim());
  }

  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  let buf = '';
  let text = '';
  let stopReason = null;
  const toolUses = [];
  const partial = {}; // index -> { id, name, json }

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
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            text += ev.delta.text;
            controller.enqueue(encoder.encode(ev.delta.text));
          } else if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
            partial[ev.index] = { id: ev.content_block.id, name: ev.content_block.name, json: '' };
          } else if (ev.type === 'content_block_delta' && ev.delta?.type === 'input_json_delta') {
            if (partial[ev.index]) partial[ev.index].json += ev.delta.partial_json;
          } else if (ev.type === 'content_block_stop' && partial[ev.index]) {
            const p = partial[ev.index];
            let input = {};
            try { input = p.json ? JSON.parse(p.json) : {}; } catch {}
            toolUses.push({ id: p.id, name: p.name, input });
            delete partial[ev.index];
          } else if (ev.type === 'message_delta' && ev.delta?.stop_reason) {
            stopReason = ev.delta.stop_reason;
          } else if (ev.type === 'error') {
            controller.enqueue(encoder.encode(`\n\n⚠️ ${ev.error?.message || 'Stream error'}`));
          }
        } catch {}
      }
    }
  }
  return { stopReason, text, toolUses };
}

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Ezra needs an Anthropic API key. Add ANTHROPIC_API_KEY in Vercel → zagaprime-opshub → Settings → Environment Variables, then redeploy.' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .map((m) => ({
      role: m?.role,
      text: typeof m?.content === 'string' ? m.content.slice(0, 8000) : '',
      images: m?.role === 'user' ? cleanImages(m.images) : [],
    }))
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && (m.text.trim() || m.images.length))
    .slice(-20)
    .map(({ role, text, images }) => {
      if (!images.length) return { role, content: text };
      const blocks = images.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } }));
      blocks.push({ type: 'text', text: text.trim() || 'Analyze this image.' });
      return { role, content: blocks };
    });
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Send a question.' }, { status: 400 });
  }

  let context;
  try { context = await buildContext(); }
  catch (e) { context = `(Live registry unavailable: ${e.message})`; }
  const system = [{ type: 'text', text: systemPrompt(context), cache_control: { type: 'ephemeral' } }];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const conv = [...messages];
        // At most two tool rounds, then a final text-only pass.
        for (let round = 0; ; round++) {
          const { stopReason, text, toolUses } = await streamOnce(key, system, conv, controller, encoder, round >= 2);
          if (stopReason !== 'tool_use' || !toolUses.length || round >= 2) break;
          const assistantContent = [];
          if (text) assistantContent.push({ type: 'text', text });
          for (const t of toolUses) assistantContent.push({ type: 'tool_use', id: t.id, name: t.name, input: t.input });
          const results = [];
          for (const t of toolUses) {
            const out = await runTool(t.name, t.input);
            results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(out) });
          }
          conv.push({ role: 'assistant', content: assistantContent });
          conv.push({ role: 'user', content: results });
          if (text) controller.enqueue(encoder.encode('\n\n'));
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n⚠️ ${e.message}`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
