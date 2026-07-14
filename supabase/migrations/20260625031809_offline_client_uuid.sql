-- Offline-first support (Phase 1): stable client-generated identity for activity logs.
--
-- Adds a nullable `client_uuid` to the five surrogate-keyed event tables so an
-- offline-created record owns a durable handle at capture time. The offline
-- write queue then makes creates idempotent with:
--     insert ... on conflict (client_uuid) do nothing
-- and targets offline edits/deletes by client_uuid when the server `id` is not
-- yet known.
--
-- `daily_notes` is intentionally EXCLUDED: it already has UNIQUE(farm_id, date),
-- a natural business key that is inherently offline-safe and idempotent.
--
-- The unique index is FULL, not partial. supabase-js `upsert({ onConflict:
-- 'client_uuid' })` passes only the column name (no predicate), so it cannot
-- target a partial `... where client_uuid is not null` index. A plain unique
-- index works because Postgres treats NULLs as distinct, so the many existing
-- rows with client_uuid IS NULL are unaffected and unconstrained.
--
-- Additive and backward compatible: the current app keeps writing without
-- client_uuid; only the new offline path populates it.

do $$
declare
  t text;
begin
  foreach t in array array[
    'irrigation_records',
    'spray_records',
    'fertigation_records',
    'harvest_records',
    'expense_records'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'alter table public.%I add column if not exists client_uuid uuid',
        t
      );
      -- Full unique index (multiple NULLs allowed) so ON CONFLICT (client_uuid)
      -- can target it from supabase-js upsert.
      execute format(
        'create unique index if not exists %I on public.%I (client_uuid)',
        t || '_client_uuid_key',
        t
      );
    end if;
  end loop;
end $$;
