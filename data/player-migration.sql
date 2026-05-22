-- Player Account Leveling Migration
-- Adds player_level and player_xp to profiles so the account itself can level up.
-- Run once in the Supabase SQL editor.

alter table public.profiles
  add column if not exists player_level integer not null default 1,
  add column if not exists player_xp    integer not null default 0;
