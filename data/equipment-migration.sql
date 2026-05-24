-- ─── Equipment system schema ─────────────────────────────────────────────────
-- Applied via Supabase MCP migration `add_equipment_system`.
-- Kept here as historical record. Idempotent — safe to re-run.

-- Sparks currency on profiles (separate from gems; earned via salvaging equipment)
alter table public.profiles
  add column if not exists sparks integer not null default 0;

-- Equipment inventory: one row per equipment instance.
-- equipment_key references catalog in lib/game/equipment.ts (e.g. 'naruto_kunai').
create table if not exists public.user_equipment (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  equipment_key              text not null,
  equipped_on_character_id   uuid references public.characters(id) on delete set null,
  acquired_at                timestamptz not null default now()
);

-- Indexes for common lookups (per-user inventory + per-character equipped items)
create index if not exists user_equipment_user_idx
  on public.user_equipment (user_id);

create index if not exists user_equipment_equipped_idx
  on public.user_equipment (equipped_on_character_id)
  where equipped_on_character_id is not null;

-- RLS — users only see/modify their own equipment
alter table public.user_equipment enable row level security;

create policy "Users can view own equipment" on public.user_equipment
  for select using ((select auth.uid()) = user_id);

create policy "Users can insert own equipment" on public.user_equipment
  for insert with check ((select auth.uid()) = user_id);

create policy "Users can update own equipment" on public.user_equipment
  for update using ((select auth.uid()) = user_id);

create policy "Users can delete own equipment" on public.user_equipment
  for delete using ((select auth.uid()) = user_id);
