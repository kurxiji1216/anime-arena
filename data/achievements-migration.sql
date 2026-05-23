-- Achievements + Hard Pity + Pull History Migration
-- Adds five new columns to profiles to support the achievement system,
-- hard pity counter, pull history feed, and total wins/pulls counters.
-- Run once in the Supabase SQL editor.

alter table public.profiles
  add column if not exists achievements   text[]  not null default '{}',
  add column if not exists pity_counter   integer not null default 0,
  add column if not exists pull_history   jsonb   not null default '[]'::jsonb,
  add column if not exists total_pulls    integer not null default 0,
  add column if not exists total_wins     integer not null default 0;
