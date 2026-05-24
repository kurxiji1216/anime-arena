-- ─── Tutorial / Hunter's Path tracking ───────────────────────────────────────
-- Applied via Supabase MCP migration `add_tutorial_tracking`.
-- Kept here as historical record. Idempotent — safe to re-run.

alter table public.profiles
  add column if not exists tutorial_claimed text[] not null default '{}';
