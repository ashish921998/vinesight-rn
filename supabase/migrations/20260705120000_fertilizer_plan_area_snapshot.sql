-- Snapshot the farm's area (canonical acres) onto fertilizer plans at creation.
--
-- Why: compliance deltas read total-basis prescriptions ("10 kg") per acre.
-- Without an area snapshot the only denominator is the farm's CURRENT area,
-- so editing the farm after a plan was written silently shifts the prescribed
-- rate while applied rates stay pinned to each record's logged area — an
-- exactly-followed plan can then read as over/under-applied. Stamping the
-- area the plan was written against removes that drift.
--
-- `farms.area` is stored as the raw number the owner typed under their
-- area-unit preference (`profiles.area_unit_preference`), NOT canonical
-- acres — the trigger resolves the preference and converts, mirroring the
-- app's convertAreaToAcres (0.404686 acres/ha, see src/utils/preferences.ts).
--
-- A BEFORE INSERT trigger (rather than a change to the web-owned
-- `send_fertilizer_plan` RPC) covers every write path — web app, RPC, or
-- direct insert — and only fills the column when the writer left it null, so
-- a future explicit stamp from either app wins. Existing plans keep a null
-- snapshot; readers fall back to the current farm area for them.

alter table public.fertilizer_plans
  add column if not exists farm_area_acres numeric;

comment on column public.fertilizer_plans.farm_area_acres is
  'Farm area in canonical acres, snapshotted when the plan was created. Null for plans predating the snapshot (readers fall back to the current farm area).';

create or replace function public.stamp_fertilizer_plan_farm_area()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.farm_area_acres is not null then
    return new;
  end if;

  -- Positive guard: accept ONLY a finite, positive area; null everything else.
  -- numeric supports 'NaN' and ±'Infinity', and `NaN <= 0` / a bare `<= 0`
  -- check would let both leak through (NaN <= 0 is NULL, Infinity <= 0 is
  -- false). Requiring `> 0 and < Infinity` rejects NaN (NaN > 0 is NULL),
  -- ±Infinity, zero, and negatives at once — matching the app's
  -- normalizeAreaToAcres, which drops any "missing/zero/non-finite" area.
  select case
      when f.area > 0 and f.area < 'Infinity'::numeric then
        case
          when coalesce(p.area_unit_preference, 'acres') = 'hectares' then f.area / 0.404686
          else f.area
        end
      else null
    end
    into new.farm_area_acres
    from public.farms f
    left join public.profiles p on p.id = f.user_id
    where f.id = new.farm_id;

  return new;
exception
  -- The snapshot is best-effort context: never fail plan creation over it.
  when others then
    new.farm_area_acres := null;
    return new;
end;
$$;

drop trigger if exists trg_stamp_fertilizer_plan_farm_area on public.fertilizer_plans;
create trigger trg_stamp_fertilizer_plan_farm_area
  before insert on public.fertilizer_plans
  for each row
  execute function public.stamp_fertilizer_plan_farm_area();
