-- Supabase RLS patch v1.1
-- Purpose: resolve Security Advisor "RLS Disabled in Public" errors for
-- public-schema tables added after the original RLS baseline.
--
-- Apply in the Supabase SQL editor against production Postgres.
-- Safe to rerun.

alter table if exists public."CommissionRequest" enable row level security;
alter table if exists public."short_links" enable row level security;
