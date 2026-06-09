-- Compare-and-swap for the manual water-level sheet.
--
-- Problem (see docs/multi-device-write-safety.html): the manual water sheet set
-- farms.remaining_water with a client-side absolute write. The ETo mode reads the
-- displayed level, subtracts evapotranspiration, and writes the result; the manual mode
-- writes a typed value. Either way, an irrigation logged (or another device's update)
-- between opening the sheet and saving is silently clobbered — the same lost-update
-- hazard log_irrigation already closed for the logging path.
--
-- Fix: a compare-and-swap. The caller passes the level it computed from
-- (p_expected_level). Under a row lock, if the stored value has since drifted beyond a
-- float epsilon, refuse (errcode 40001) so the client re-reads and recomputes against the
-- fresh value instead of overwriting it. A null expected level forces the set (no prior
-- basis to guard against). The new level is clamped to [0, capacity], mirroring the old
-- client guards. Returns the updated farm row so the client can refresh its cache.

create or replace function public.set_water_level(
  p_farm_id bigint,
  p_new_level numeric,
  p_expected_level numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farm public.farms;
  v_current numeric;
  v_target numeric;
begin
  -- Ownership + lock: only the owner may set the level, and the row is serialized
  -- against concurrent irrigations / other sheet saves for the compare below.
  select * into v_farm
  from public.farms
  where id = p_farm_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Farm % not found or not owned by current user', p_farm_id
      using errcode = '42501';
  end if;

  v_current := coalesce(v_farm.remaining_water, 0);

  -- Compare-and-swap: bail if the row drifted since the caller read it.
  if p_expected_level is not null and abs(v_current - p_expected_level) > 0.0001 then
    raise exception 'Water level changed since read (expected %, found %)',
      p_expected_level, v_current
      using errcode = '40001';
  end if;

  -- Clamp to [0, capacity], mirroring the old client clamp.
  v_target := greatest(0, coalesce(p_new_level, 0));
  if v_farm.total_tank_capacity is not null and v_farm.total_tank_capacity > 0 then
    v_target := least(v_farm.total_tank_capacity, v_target);
  end if;

  update public.farms
  set remaining_water = v_target,
      water_calculation_updated_at = now()
  where id = p_farm_id
  returning * into v_farm;

  return to_jsonb(v_farm);
end;
$$;

grant execute on function public.set_water_level(bigint, numeric, numeric) to authenticated;
