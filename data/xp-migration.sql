-- XP Leveling System Migration
-- Adds the `xp` column to user_characters so battle wins can fill an XP bar.
-- Run this once in the Supabase SQL editor.

alter table public.user_characters
  add column if not exists xp integer not null default 0;
