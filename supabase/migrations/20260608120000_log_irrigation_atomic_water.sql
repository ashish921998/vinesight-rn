-- Atomic irrigation logging + water-balance ledger.
--
-- Problem (see docs/multi-device-write-safety.html): irrigation logging used a
-- client-side read-modify-write of farms.remaining_water — read a stale snapshot,
-- add a delta, write the absolute result. Two devices logging concurrently each
-- overwrite the other, silently losing an irrigation and drifting the tank balance.
--
-- Fix: do the insert AND the water update in one transaction, server-side, computing
-- the new level from the row's OWN current value. Returns the inserted record plus the
-- EXACT amount added to remaining_water (clamped to tank capacity) so the client can
-- undo precisely on rollback (see revert_irrigation).

create or replace function public.log_irrigation(
  p_farm_id bigint,
  p_date date,
  p_duration numeric,
  p_area numeric,
  p_growth_stage text default '',
  p_moisture_status text default '',
  p_system_discharge numeric default 0,
  p_date_of_pruning date default null,
  p_season_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farm public.farms;
  v_record public.irrigation_records;
  v_before numeric;
  v_after numeric;
  v_delta numeric := 0;
begin
  -- Ownership: only the farm owner may log against it. Lock the row so the
  -- read-modify-write below is serialized against concurrent irrigations.
  select * into v_farm
  from public.farms
  where id = p_farm_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Farm % not found or not owned by current user', p_farm_id
      using errcode = '42501';
  end if;

  insert into public.irrigation_records (
    farm_id, season_id, date, duration, area,
    growth_stage, moisture_status, system_discharge, date_of_pruning
  ) values (
    p_farm_id, p_season_id, p_date, p_duration, p_area,
    coalesce(p_growth_stage, ''), coalesce(p_moisture_status, ''),
    coalesce(p_system_discharge, 0), p_date_of_pruning
  )
  returning * into v_record;

  -- Apply the water delta only on tank-capacity-configured farms, mirroring the
  -- old client clamp: new = min(capacity, current + duration * discharge).
  if v_farm.total_tank_capacity is not null
     and v_farm.total_tank_capacity > 0
     and coalesce(p_system_discharge, 0) > 0
     and coalesce(p_duration, 0) > 0 then
    v_before := coalesce(v_farm.remaining_water, 0);
    v_after := least(v_farm.total_tank_capacity, v_before + p_duration * p_system_discharge);
    v_delta := v_after - v_before;

    update public.farms
    set remaining_water = v_after,
        water_calculation_updated_at = now()
    where id = p_farm_id;
  end if;

  return jsonb_build_object('record', to_jsonb(v_record), 'water_delta', v_delta);
end;
$$;

grant execute on function public.log_irrigation(
  bigint, date, numeric, numeric, text, text, numeric, date, bigint
) to authenticated;

-- Concurrency-safe rollback of an irrigation logged in a multi-log "Activity stack"
-- save that later failed. Deletes the record AND subtracts the EXACT delta that
-- log_irrigation applied (floored at 0) — from the row's current value, never a stale
-- client snapshot.
create or replace function public.revert_irrigation(
  p_record_id bigint,
  p_water_delta numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farm_id bigint;
begin
  select ir.farm_id into v_farm_id
  from public.irrigation_records ir
  join public.farms f on f.id = ir.farm_id
  where ir.id = p_record_id and f.user_id = auth.uid();

  if not found then
    raise exception 'Irrigation record % not found or not owned by current user', p_record_id
      using errcode = '42501';
  end if;

  delete from public.irrigation_records where id = p_record_id;

  if coalesce(p_water_delta, 0) <> 0 then
    update public.farms
    set remaining_water = greatest(0, coalesce(remaining_water, 0) - p_water_delta),
        water_calculation_updated_at = now()
    where id = v_farm_id;
  end if;
end;
$$;

grant execute on function public.revert_irrigation(bigint, numeric) to authenticated;
