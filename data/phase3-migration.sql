-- Phase 3: Add level and stars to user_characters
-- Run this in Supabase SQL Editor before using the upgrade system

alter table public.user_characters
  add column if not exists level integer not null default 1,
  add column if not exists stars integer not null default 1;
