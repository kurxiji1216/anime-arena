# Project: Anime Arena
A web-based anime card-collection auto-battler with a companion Discord bot.

## Stack
- Next.js 15 App Router on Vercel (server components by default)
- TypeScript strict mode, no `any`
- Supabase (Postgres + Auth + Storage + Realtime + Edge Functions)
- Tailwind + shadcn/ui
- Discord bot: Cloudflare Workers + HTTP Interactions (NOT discord.js gateway)
- pnpm

## Do NOT use
- Prisma (use Supabase generated types via `supabase gen types typescript`)
- Redux or Zustand globally (use React state + Supabase queries)
- discord.js (we use HTTP interactions with the `discord-interactions` npm package)
- Default exports
- Raw SQL in components (always go through Edge Functions or RPC)

## Project structure
- app/ — Next.js routes
- components/ — UI components (PascalCase)
- lib/supabase/ — server + browser clients, generated types
- supabase/migrations/ — SQL migrations (source of truth for schema)
- supabase/functions/ — Edge Functions
- bot/ — Cloudflare Worker (Discord bot)

## Commands
- pnpm dev — Next.js dev server
- pnpm typecheck — tsc --noEmit
- supabase db reset — DESTRUCTIVE, only on local dev
- supabase gen types typescript --linked > lib/supabase/types.ts — regen types after schema changes
- wrangler deploy bot/ — deploy Discord bot Worker

## Conventions
- All gacha pulls go through a Postgres RPC called do_pull(user_id) — never client-side
- RLS on every table; service role key only in Edge Functions and the Cloudflare Worker
- Card art lives in Supabase Storage under the cards/ bucket, served via CDN render endpoint
- Discord bot slash commands call the same do_pull RPC the web app uses
- Character data is fully generic (name, source_anime, rarity, image_url, stats) — never hard-coded

## Important
- Never commit .env.local or supabase/.env
- Anon key is public-safe; service role key is server-only, never in the browser
- After every schema change: regenerate types AND run migration on dev before touching prod
- Rate limit all gacha pulls server-side — never trust the client
