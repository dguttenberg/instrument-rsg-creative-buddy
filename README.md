# RSG Copywriting Companion

A working prototype of a conversational copywriting tool for the Rivers Casino & Resorts (RSG) creative team. Covers two properties: **Pittsburgh** and **Des Plaines**. Philadelphia, Schenectady, and Portsmouth are visible in the UI but disabled — those will come in a later pass.

The encoded voice layer lives in [`SYSTEM_PROMPT.md`](./SYSTEM_PROMPT.md) (verbatim) and [`lib/system-prompt.ts`](./lib/system-prompt.ts) (loaded at runtime). The transcripts the prompt was distilled from are in [`transcript_pittsburgh.md`](./transcript_pittsburgh.md) and [`transcript_des_plaines.md`](./transcript_des_plaines.md). Full project spec is in [`HANDOVER.md`](./HANDOVER.md).

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- `@anthropic-ai/sdk` calling `claude-sonnet-4-6`
- System prompt cached via Anthropic's prompt caching (5-minute TTL); the active property is injected into the first user turn so the cached prefix stays byte-identical across requests
- Streaming response from API route to client via `ReadableStream`
- No persistence. No auth. Each session is fresh.

## Run locally

```bash
# 1. Install deps
npm install

# 2. Set the API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

# 3. Start the dev server
npm run dev
```

Visit http://localhost:3000.

## Deploy to Vercel

```bash
# Install once if needed
npm i -g vercel

# Deploy
vercel
```

After the first deploy, set `ANTHROPIC_API_KEY` in the Vercel project's Environment Variables (Production + Preview + Development), then redeploy. No other config is needed.

## How it works

- **Property selector** in the header. Switching properties mid-conversation prompts a confirm and resets the chat.
- **Chat** is a single endpoint — `POST /api/chat` — that takes `{ property, messages }` and streams plain text back. The server prepends `Active property: <Pittsburgh|Des Plaines>` to the first user message so the system prompt itself can stay byte-identical (and cache-eligible) across properties and across conversations.
- **No memory across sessions** by design. Closing the browser starts fresh.

## Test briefs

A handful of representative briefs are documented in PART 3 of [`HANDOVER.md`](./HANDOVER.md). Try one of:

- `PGH, March Mystery Gift Card, postcard 9x6 + kiosk tile + digital 1280x720`
- `DP, May Cinco de Mayo Slot Play, postcard front + back`
- `Pittsburgh — looking for a take on the NFL Draft. April 22-25, Pittsburgh hosts.`
- `Des Plaines, Hugo's Frog Bar dining offer DM for Mother's Day. Self-mailer.`
