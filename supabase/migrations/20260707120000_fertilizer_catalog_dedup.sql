-- Catalog hygiene: collapse branded fertilizer rows into generic grades, and
-- fold mis-typed fertilizer rows (input_type='spray') into their generic
-- counterparts (issue #234).
--
-- Design stance: for fertilizers, product identity is the DECLARED COMPOSITION
-- SET — brand is not identity. A branded bag whose guaranteed analysis matches a
-- generic grade (Mahadhan 19:19:19, YaraTera Krista MAP, Vanita Aditya …) is the
-- same product; the generic survives and the brand string lives on as a search
-- alias. The same logic collapses live grade rows that were mis-typed as sprays
-- (MKP `00:52:34`/`0:52:34`, `SOP`) into their fertilizer counterparts.
--
-- Consequence this fixes: a consultant plans generic MAP (product A) while a
-- farmer logs the branded bag (product B) → identity match failed → the same
-- chemical was reported as unplanned/approximate-miss. After collapse there is
-- one row, so id AND name matching both resolve.
--
-- Resolves rows by NAME (not hardcoded id) — ids are environment-specific.
-- Everything is idempotent and guarded: a re-run on already-converged state is a
-- no-op. Collapsed rows are DEACTIVATED (is_active=false), never deleted —
-- historical FKs are ON DELETE SET NULL / CASCADE and identity should not be
-- erased from old records (issue #234 note 2). References are re-pointed to the
-- survivor BEFORE deactivation so no row is ever left pointing at a stale
-- (still-active-but-about-to-die) product.
--
-- Companion: scripts/seed-data/fertilizer-catalog-seed.ts now seeds one row per
-- composition set with brand strings as `aliases`; scripts/seed-fertilizer-
-- catalog.ts deactivates seed-owned rows that fell out of the seed on re-run.
-- This migration handles the LIVE state that the seed has already produced.

-- ============================================================
-- Block A — build the survivor map (collapsed_name → survivor_id)
-- ============================================================
-- Pairs of (collapsed_id, survivor_id) for every branded/mis-typed row that
-- folds into a generic. Both rows must exist in chemical_products; the survivor
-- must be a fertilizer, the collapsed may be 'fertilizer' or the mis-typed
-- 'spray'. Names are matched case-insensitively within the seed state (MH).
create temp table if not exists collapsed_to_survivor (
  collapsed_id bigint primary key,
  survivor_id bigint not null,
  collapsed_name text not null,
  survivor_name text not null
);

do $$
begin
  if to_regclass('public.chemical_products') is null then
    raise notice 'chemical_products missing — catalog dedup is a no-op';
    return;
  end if;

  -- The collapse mapping, by lower(name). survivor_name ← the generic grade row
  -- the seed now keeps; collapsed_name ← the branded/mis-typed row being folded.
  insert into collapsed_to_survivor (collapsed_id, survivor_id, collapsed_name, survivor_name)
  select c.id, s.id, c.name, s.name
  from (values
    ('mahadhan 19:19:19'::text,             'npk 19:19:19'),
    ('mahadhan 12:61:00',                    'npk 12:61:00 (map)'),
    ('yaratera krista map 12:61:00',         'npk 12:61:00 (map)'),
    ('00:52:34',                             'npk 00:52:34 (mkp)'),  -- mis-typed live row #17
    ('0:52:34',                              'npk 00:52:34 (mkp)'),  -- mis-typed live row #18 (dupe spelling)
    ('mahadhan 00:52:34',                    'npk 00:52:34 (mkp)'),
    ('yaratera krista mkp 00:52:34',         'npk 00:52:34 (mkp)'),
    ('mahadhan dap',                         'dap (di-ammonium phosphate)'),
    ('yaratera krista k plus 13:00:45',      'npk 13:00:45 (kno3)'),
    ('yaratera calcinit',                    'calcium nitrate'),
    ('vanita aditya 20:20:20',               'npk 20:20:20'),
    ('vanita aditya 00:00:50 (sop)',         'npk 00:00:50 (sop)'),
    ('sop',                                  'npk 00:00:50 (sop)')   -- mis-typed live row #116
  ) as v(collapsed_name, survivor_name)
  join public.chemical_products c
    on lower(c.name) = v.collapsed_name and c.state_code = 'MH'
  join public.chemical_products s
    on lower(s.name) = v.survivor_name and s.state_code = 'MH'
  where s.input_type = 'fertilizer'
    and s.is_active                                              -- survivor must be live
    and coalesce(c.id, 0) <> coalesce(s.id, 0)                   -- never map a row to itself
  on conflict (collapsed_id) do nothing;

  raise notice 'catalog dedup: % collapse pair(s) resolved', (select count(*) from collapsed_to_survivor);
end $$;

-- ============================================================
-- Block B — re-point id-based references to the survivor
-- ============================================================
-- Each reference is moved collapsed_id → survivor_id BEFORE any row is
-- deactivated, so nothing ever dangles. Only rows currently pointing at a
-- collapsed id are touched. chemical_mix_components.product_id is ON DELETE
-- RESTRICT — safe here because we never delete, only re-point + deactivate.

-- warehouse_items.catalog_product_id (FK ON DELETE SET NULL)
do $$
declare n int := 0;
begin
  if to_regclass('public.warehouse_items') is null then return; end if;
  with updated as (
    update public.warehouse_items wi
    set catalog_product_id = cts.survivor_id,
        catalog_mapping_status = 'mapped_provisional'
    from collapsed_to_survivor cts
    where wi.catalog_product_id = cts.collapsed_id
    returning 1
  )
  select count(*) into n from updated;
  raise notice 'catalog dedup: warehouse_items re-pointed % row(s)', n;
end $$;

-- chemical_mix_components.product_id (FK ON DELETE RESTRICT)
do $$
declare n int := 0;
begin
  if to_regclass('public.chemical_mix_components') is null then return; end if;
  with updated as (
    update public.chemical_mix_components mc
    set product_id = cts.survivor_id
    from collapsed_to_survivor cts
    where mc.product_id = cts.collapsed_id
    returning 1
  )
  select count(*) into n from updated;
  raise notice 'catalog dedup: chemical_mix_components re-pointed % row(s)', n;
end $$;

-- chemical_phi_rules.product_id (FK ON DELETE CASCADE)
do $$
declare n int := 0;
begin
  if to_regclass('public.chemical_phi_rules') is null then return; end if;
  with updated as (
    update public.chemical_phi_rules pr
    set product_id = cts.survivor_id
    from collapsed_to_survivor cts
    where pr.product_id = cts.collapsed_id
    returning 1
  )
  select count(*) into n from updated;
  raise notice 'catalog dedup: chemical_phi_rules re-pointed % row(s)', n;
end $$;

-- fertilizer_plan_items.product_id (table owned by the web app; identity link)
do $$
declare n int := 0;
begin
  if to_regclass('public.fertilizer_plan_items') is null then return; end if;
  with updated as (
    update public.fertilizer_plan_items pi
    set product_id = cts.survivor_id
    from collapsed_to_survivor cts
    where pi.product_id = cts.collapsed_id
    returning 1
  )
  select count(*) into n from updated;
  raise notice 'catalog dedup: fertilizer_plan_items re-pointed % row(s)', n;
end $$;

-- ============================================================
-- Block C — re-point JSONB array elements
-- ============================================================
-- spray_records.chemical_items[] and fertigation_records.fertilizers[] embed
-- catalog_product_id inside a JSONB array (no FK protects it). Each array is
-- rebuilt with matching elements re-pointed. A row is touched only if it
-- contains a collapsed id. jsonb_set is used per element to preserve every
-- other field on the JSON object (quantity, name, snapshots, …).

-- spray_records.chemical_items[].catalog_product_id
do $$
declare
  rec record;
  touched int := 0;
begin
  if to_regclass('public.spray_records') is null then return; end if;
  for rec in
    select sr.id
    from public.spray_records sr
    where exists (
      select 1 from jsonb_array_elements(sr.chemical_items) e
      where (e->>'catalog_product_id')::bigint in (select collapsed_id from collapsed_to_survivor)
    )
  loop
    -- Rebuild the whole array in one statement per affected row.
    update public.spray_records
    set chemical_items = (
      select jsonb_agg(
        case
          when cts.collapsed_id is not null
            then jsonb_set(elem, '{catalog_product_id}', to_jsonb(cts.survivor_id))
          else elem
        end
      )
      from jsonb_array_elements(chemical_items) with ordinality as t(elem, idx)
      left join collapsed_to_survivor cts
        on (t.elem->>'catalog_product_id')::bigint = cts.collapsed_id
    )
    where id = rec.id;
    touched := touched + 1;
  end loop;
  raise notice 'catalog dedup: spray_records JSONB re-pointed in % row(s)', touched;
end $$;

-- fertigation_records.fertilizers[].catalog_product_id
do $$
declare
  rec record;
  touched int := 0;
begin
  if to_regclass('public.fertigation_records') is null then return; end if;
  for rec in
    select fr.id
    from public.fertigation_records fr
    where exists (
      select 1 from jsonb_array_elements(fr.fertilizers) e
      where (e->>'catalog_product_id')::bigint in (select collapsed_id from collapsed_to_survivor)
    )
  loop
    update public.fertigation_records
    set fertilizers = (
      select jsonb_agg(
        case
          when cts.collapsed_id is not null
            then jsonb_set(elem, '{catalog_product_id}', to_jsonb(cts.survivor_id))
          else elem
        end
      )
      from jsonb_array_elements(fertilizers) with ordinality as t(elem, idx)
      left join collapsed_to_survivor cts
        on (t.elem->>'catalog_product_id')::bigint = cts.collapsed_id
    )
    where id = rec.id;
    touched := touched + 1;
  end loop;
  raise notice 'catalog dedup: fertigation_records JSONB re-pointed in % row(s)', touched;
end $$;

-- ============================================================
-- Block D — merge compositions & aliases onto the survivor
-- ============================================================
-- So the survivor carries the merged nutrient/alias set, copy the collapsed
-- rows' declared compositions and trade aliases onto it (idempotent — the
-- survivor usually already has the matching composition; aliases are skipped if
-- already present via the unique index expression).

do $$
begin
  if to_regclass('public.chemical_product_compositions') is null then return; end if;
  -- Insert any composition the survivor is missing (skips same-(product, code,
  -- basis) duplicates). Keeps verified/source_note on the survivor's own rows.
  insert into public.chemical_product_compositions (
    product_id, component_code, component_type, percent, basis, verified, source_note
  )
  select
    cts.survivor_id, c.component_code, c.component_type, c.percent, c.basis, false, c.source_note
  from collapsed_to_survivor cts
  join public.chemical_product_compositions c on c.product_id = cts.collapsed_id
  where c.basis = 'declared'
    and not exists (
      select 1 from public.chemical_product_compositions ex
      where ex.product_id = cts.survivor_id
        and lower(ex.component_code) = lower(c.component_code)
        and ex.basis = 'declared'
    )
  on conflict do nothing;
  raise notice 'catalog dedup: compositions merged onto survivor(s)';
end $$;

do $$
begin
  if to_regclass('public.chemical_product_aliases') is null then return; end if;
  -- Re-point the collapsed rows' existing aliases at the survivor, and add the
  -- brand-name alias for each collapsed row (so typing the brand finds the
  -- generic). Skips duplicates via chemical_product_aliases_unique.
  insert into public.chemical_product_aliases (product_id, alias, locale, alias_kind, source)
  select survivor_id, lower(alias), 'en', 'trade', 'fertilizer-catalog-dedup:234'
  from (
    -- existing aliases on the collapsed row
    select cts.survivor_id, a.alias as alias
    from collapsed_to_survivor cts
    join public.chemical_product_aliases a on a.product_id = cts.collapsed_id
    union
    -- the collapsed product's own name becomes a trade alias on the survivor
    select cts.survivor_id, cts.collapsed_name as alias
    from collapsed_to_survivor cts
  ) as merged
  on conflict do nothing;
  raise notice 'catalog dedup: aliases merged onto survivor(s)';
end $$;

-- ============================================================
-- Block E — deactivate collapsed rows
-- ============================================================
-- Deactivate (never delete) the collapsed product rows. Also catches the
-- corrupt `sulpher` row whose active_ingredient is the Excel artifact `#REF!`
-- (no composition to match a survivor → just retired). Idempotent: only rows
-- currently active are updated.

do $$
begin
  if to_regclass('public.chemical_products') is null then return; end if;

  -- Collapsed-branded and mis-typed rows that mapped onto a survivor.
  update public.chemical_products
  set is_active = false
  where id in (select collapsed_id from collapsed_to_survivor)
    and is_active;

  -- The corrupt `sulpher` (#REF!) row — deactivate by active_ingredient match.
  -- Identified in issue #234 (id 118); matched here without hardcoding the id.
  update public.chemical_products
  set is_active = false
  where lower(coalesce(active_ingredient, '')) = '#ref!'
    and state_code = 'MH'
    and is_active;

  raise notice 'catalog dedup: collapsed/corrupt rows deactivated';
end $$;

-- NOTE on the `calcium` row (id 43): left UNTOUCHED. The issue flags it for
-- review — foliar calcium sprays legitimately exist, and without a declared
-- composition there is no survivor to collapse it into. A separate micronutrient
-- catalog tier (follow-up issue) will resolve it.

-- ============================================================
-- Block F — cleanup
-- ============================================================
-- The survivor map is a temp table scoped to this migration's session; drop it
-- explicitly so a re-run inside the same psql connection does not hit the
-- `already exists` guard with stale rows. (Supabase applies each migration in a
-- fresh session, so this is belt-and-braces.)
drop table if exists collapsed_to_survivor;
