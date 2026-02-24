-- MANUAL ROLLBACK SCRIPT (do not place in supabase/migrations)
-- Reverts schema changes introduced by:
--   supabase/migrations/20260221010000_phi_catalog.sql
--
-- WARNING:
-- - This is destructive and may delete catalog/PHI data written after the migration.
-- - Apply only if you are rolling back the corresponding app release as well.
-- - Review on staging first.

begin;

-- ============================================================
-- Drop indexes added to existing tables (safe if columns still exist)
-- ============================================================
drop index if exists public.warehouse_items_mapping_status_idx;
drop index if exists public.warehouse_items_catalog_product_idx;
drop index if exists public.spray_records_phi_lookup_idx;
drop index if exists public.farm_seasons_farm_end_idx;

-- ============================================================
-- Drop constraints added to existing tables
-- ============================================================
alter table if exists public.warehouse_items
  drop constraint if exists warehouse_items_catalog_mapping_source_check,
  drop constraint if exists warehouse_items_catalog_mapping_status_check;

alter table if exists public.spray_records
  drop constraint if exists spray_records_phi_status_check;

-- ============================================================
-- Revert existing table extensions (columns added by PHI/catalog migration)
-- ============================================================
alter table if exists public.warehouse_items
  drop column if exists catalog_mapped_at,
  drop column if exists catalog_mapping_source,
  drop column if exists catalog_mapping_status,
  drop column if exists catalog_product_id;

alter table if exists public.spray_records
  drop column if exists phi_status,
  drop column if exists phi_blocking_component,
  drop column if exists phi_calc_version,
  drop column if exists safe_harvest_date,
  drop column if exists governing_phi_days,
  drop column if exists catalog_mix_id;

alter table if exists public.farm_seasons
  drop column if exists target_harvest_date;

-- ============================================================
-- Drop PHI/catalog tables (dependencies handled by order/cascade)
-- ============================================================
drop table if exists public.chemical_phi_rules cascade;
drop table if exists public.chemical_mix_components cascade;
drop table if exists public.chemical_mixes cascade;
drop table if exists public.chemical_product_compositions cascade;
drop table if exists public.chemical_product_aliases cascade;
drop table if exists public.chemical_products cascade;

commit;
