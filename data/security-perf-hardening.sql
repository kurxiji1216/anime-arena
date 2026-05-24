-- ─── Security + performance hardening ────────────────────────────────────────
-- Applied via Supabase MCP migration `security_and_perf_hardening`.
-- Kept here as historical record of what ran. Idempotent — safe to re-run.

-- ─── 1. Fix handle_new_user mutable search_path ───────────────────────────────
-- All references inside the function are already fully qualified (public.profiles),
-- so locking search_path to empty is safe.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, username, gems)
  values (new.id, new.raw_user_meta_data->>'full_name', 30);
  return new;
end;
$$;

-- ─── 2. Revoke public EXECUTE on SECURITY DEFINER functions ───────────────────
-- These are trigger/event functions, never meant to be called directly via PostgREST.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.rls_auto_enable()  from anon, authenticated, public;

-- ─── 3. Add missing foreign-key index on user_characters.character_id ─────────
create index if not exists user_characters_character_id_idx
  on public.user_characters (character_id);

-- ─── 4. Optimize RLS policies — wrap auth.uid() in a subquery ─────────────────
-- Without the subquery, Postgres re-evaluates auth.uid() once per row.
-- With (select auth.uid()) it evaluates once per query — much faster on large tables.

alter policy "Users can insert own campaign progress" on public.campaign_progress
  with check ((select auth.uid()) = user_id);

alter policy "Users can view own campaign progress" on public.campaign_progress
  using ((select auth.uid()) = user_id);

alter policy "Users can update own profile" on public.profiles
  using ((select auth.uid()) = user_id);

alter policy "Users can view own profile" on public.profiles
  using ((select auth.uid()) = user_id);

alter policy "Users can insert own characters" on public.user_characters
  with check ((select auth.uid()) = user_id);

alter policy "Users can update own characters" on public.user_characters
  using ((select auth.uid()) = user_id);

alter policy "Users can view own characters" on public.user_characters
  using ((select auth.uid()) = user_id);
