alter table public.irrigation_records
  add column if not exists applied_water_delta numeric;

create or replace function public.apply_irrigation_water_delta()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  farm_capacity numeric;
  farm_discharge numeric;
  current_water numeric;
  baseline_water numeric;
  water_delta numeric;
begin
  if tg_op = 'INSERT' then
    if new.client_uuid is null then
      return new;
    end if;

    select
      total_tank_capacity,
      system_discharge,
      coalesce(remaining_water, 0)
    into farm_capacity, farm_discharge, current_water
    from public.farms
    where id = new.farm_id
    for update;

    if not found then
      return new;
    end if;

    if farm_capacity is null
      or farm_capacity <= 0
      or farm_discharge is null
      or farm_discharge <= 0
      or new.system_discharge is null
      or new.system_discharge <= 0
      or new.duration is null
      or new.duration <= 0 then
      update public.irrigation_records
      set applied_water_delta = 0
      where id = new.id;
      return new;
    end if;

    water_delta := least(farm_capacity, current_water + (new.duration * new.system_discharge)) - current_water;

    update public.farms
    set remaining_water = current_water + water_delta
    where id = new.farm_id;

    update public.irrigation_records
    set applied_water_delta = water_delta
    where id = new.id;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.client_uuid is null
      or (new.duration is not distinct from old.duration
          and new.system_discharge is not distinct from old.system_discharge) then
      return new;
    end if;

    select
      total_tank_capacity,
      system_discharge,
      coalesce(remaining_water, 0)
    into farm_capacity, farm_discharge, current_water
    from public.farms
    where id = new.farm_id
    for update;

    if not found then
      return new;
    end if;

    baseline_water := greatest(0, current_water - coalesce(old.applied_water_delta, 0));

    if farm_capacity is null
      or farm_capacity <= 0
      or farm_discharge is null
      or farm_discharge <= 0
      or new.system_discharge is null
      or new.system_discharge <= 0
      or new.duration is null
      or new.duration <= 0 then
      water_delta := 0;
    else
      water_delta := least(farm_capacity, baseline_water + (new.duration * new.system_discharge)) - baseline_water;
    end if;

    update public.farms
    set remaining_water = baseline_water + water_delta
    where id = new.farm_id;

    update public.irrigation_records
    set applied_water_delta = water_delta
    where id = new.id;

    return new;
  end if;

  if old.client_uuid is null then
    return old;
  end if;

  update public.farms
  set remaining_water = greatest(0, coalesce(remaining_water, 0) - coalesce(old.applied_water_delta, 0))
  where id = old.farm_id;

  return old;
end;
$$;

drop trigger if exists trg_apply_irrigation_water_delta on public.irrigation_records;

create trigger trg_apply_irrigation_water_delta
after insert or update of duration, system_discharge or delete
on public.irrigation_records
for each row
execute function public.apply_irrigation_water_delta();
