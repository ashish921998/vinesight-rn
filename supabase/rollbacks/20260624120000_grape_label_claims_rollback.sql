-- MANUAL ROLLBACK SCRIPT (do not place in supabase/migrations)
-- Reverts schema changes introduced by:
--   supabase/migrations/20260624120000_grape_label_claims.sql
--
-- WARNING:
-- - This is destructive and may delete label-claim data written after the migration.
-- - Apply only if you are rolling back the corresponding app release as well.
-- - Review on staging first.

begin;

-- ============================================================
-- Drop indexes added to existing tables (safe if columns still exist)
-- ============================================================
drop index if exists public.spray_records_compliance_status_idx;
drop index if exists public.chemical_mix_components_label_claim_idx;
drop index if exists public.chemical_mixes_crop_name_target_problem_unique;

-- ============================================================
-- Restore previous mix uniqueness
-- ============================================================
create unique index if not exists chemical_mixes_crop_name_unique
  on public.chemical_mixes (lower(crop), lower(name));

-- ============================================================
-- Drop constraints added to existing tables
-- ============================================================
alter table if exists public.spray_records
  drop constraint if exists spray_records_compliance_status_check;

alter table if exists public.chemical_mix_components
  drop constraint if exists chemical_mix_components_label_claim_fk;

-- ============================================================
-- Revert existing table extensions
-- ============================================================
alter table if exists public.spray_records
  drop column if exists compliance_snapshot,
  drop column if exists compliance_status;

alter table if exists public.chemical_mix_components
  drop column if exists label_claim_id;

-- ============================================================
-- Drop catalog RLS policies and triggers explicitly (clarity/idempotency)
-- ============================================================
drop policy if exists "Allow authenticated read access" on public.chemical_label_claim_mrls;
drop policy if exists "Allow authenticated read access" on public.chemical_label_claims;
drop policy if exists "Allow authenticated read access" on public.chemical_label_sources;

drop trigger if exists handle_chemical_label_claims_updated_at on public.chemical_label_claims;
drop trigger if exists handle_chemical_label_sources_updated_at on public.chemical_label_sources;

-- ============================================================
-- Drop label-claim tables (dependencies handled by order/cascade)
-- ============================================================
drop table if exists public.chemical_label_claim_mrls cascade;
drop table if exists public.chemical_label_claims cascade;
drop table if exists public.chemical_label_sources cascade;

commit;
