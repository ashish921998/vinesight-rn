-- MANUAL ROLLBACK SCRIPT (do not place in supabase/migrations)
-- Reverts the data changes introduced by:
--   supabase/migrations/20260707120000_fertilizer_catalog_dedup.sql
--
-- WARNING:
-- - This is destructive and re-activates collapsed/corrupt product rows.
-- - It does NOT auto-reverse the reference re-points (warehouse_items,
--   chemical_mix_components, chemical_phi_rules, fertilizer_plan_items, and the
--   spray_records/fertigation_records JSONB arrays). Those rows now correctly
--   point at the surviving generic; re-pointing them back to the branded rows
--   would re-introduce the duplicate-identity bug the dedup fixed. Decide
--   reference reversal case-by-case after reviewing staging.
-- - The merged compositions/aliases on the survivors are left in place (harmless
--   duplicates); remove manually only if a clean survivor is required.
-- - Apply only if you are rolling back the corresponding app release as well.
-- - Review on staging first.

begin;

-- ============================================================
-- Re-activate the collapsed branded + mis-typed rows
-- ============================================================
-- These were deactivated (is_active=false) by the dedup migration. Re-activating
-- restores them as pickable products — note this re-introduces the
-- composition-set duplication the dedup removed. Matched by name (ids are
-- environment-specific), within the seed state (MH).
update public.chemical_products
set is_active = true
where state_code = 'MH'
  and is_active = false
  and lower(name) in (
    'mahadhan 19:19:19',
    'mahadhan 12:61:00',
    'yaratera krista map 12:61:00',
    '00:52:34',
    '0:52:34',
    'mahadhan 00:52:34',
    'yaratera krista mkp 00:52:34',
    'mahadhan dap',
    'yaratera krista k plus 13:00:45',
    'yaratera calcinit',
    'vanita aditya 20:20:20',
    'vanita aditya 00:00:50 (sop)',
    'sop',
    'sulpher'
  );

-- NOTE: the seeder's convergence step will RE-deactivate these on its next
-- --write run, because they are no longer in the seed set. To keep them active
-- you must also revert scripts/seed-data/fertilizer-catalog-seed.ts (restore the
-- branded rows) and the seeder before running it again.

commit;
