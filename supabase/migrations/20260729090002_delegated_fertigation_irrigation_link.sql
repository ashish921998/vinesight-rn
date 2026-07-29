-- Let delegated (consultant-created) fertigation records link to the irrigation
-- record they were applied with, matching the farmer save path. The insert list
-- previously had no irrigation_record_id at all, so every consultant-logged
-- fertigation was permanently unlinked. The id comes from the payload and is
-- validated against p_farm_id — the function is SECURITY DEFINER, so an
-- arbitrary id must not be trusted to point inside the caller's farm.

create or replace function public.create_delegated_log(
  p_organization_id uuid,
  p_client_user_id uuid,
  p_farm_id bigint,
  p_record_type text,
  p_date date,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  creator_name text;
  organization_name text;
  resolved_season_id bigint;
  farm_date_of_pruning date;
  linked_irrigation_id bigint;
begin
  if auth.uid() is null or not public.can_create_delegated_log(p_organization_id, p_client_user_id, p_farm_id) then
    raise exception 'Delegated log access denied' using errcode = '42501';
  end if;
  if p_record_type not in ('irrigation', 'spray', 'fertigation', 'harvest', 'note') then
    raise exception 'Unsupported delegated log type' using errcode = '22023';
  end if;

  select p.full_name into creator_name
  from public.profiles p
  where p.id = auth.uid();
  select o.name into organization_name
  from public.organizations o
  where o.id = p_organization_id;

  select fs.id into resolved_season_id
  from public.farm_seasons fs
  where fs.farm_id = p_farm_id
    and fs.start_date <= p_date
    and (fs.end_date is null or fs.end_date >= p_date)
  order by fs.start_date desc
  limit 1;

  select f.date_of_pruning into farm_date_of_pruning
  from public.farms f
  where f.id = p_farm_id;

  case p_record_type
    when 'irrigation' then
      if coalesce((p_payload->>'duration')::numeric, 0) <= 0 then raise exception 'Duration must be positive' using errcode = '22023'; end if;
      insert into public.irrigation_records
        (farm_id, season_id, date, duration, area, growth_stage, moisture_status, system_discharge, date_of_pruning, notes, professional_creator_id, acting_organization_id, professional_creator_name, acting_organization_name)
      select p_farm_id, resolved_season_id, p_date, (p_payload->>'duration')::numeric, f.area,
        coalesce(p_payload->>'growth_stage', ''), coalesce(p_payload->>'moisture_status', ''),
        coalesce(f.system_discharge, 0), farm_date_of_pruning, p_payload->>'notes', auth.uid(), p_organization_id, creator_name, organization_name
      from public.farms f where f.id = p_farm_id returning to_jsonb(irrigation_records.*) into result;
    when 'spray' then
      if nullif(trim(p_payload->>'chemical'), '') is null or coalesce((p_payload->>'area')::numeric, 0) <= 0 then raise exception 'Chemical and positive area are required' using errcode = '22023'; end if;
      insert into public.spray_records
        (farm_id, season_id, date, catalog_mix_id, chemical, chemical_items, dose, governing_phi_days, safe_harvest_date, phi_calc_version, phi_blocking_component, phi_status, nutrient_totals_elemental, nutrient_totals_elemental_per_acre, nutrient_calc_coverage, area, weather, operator, date_of_pruning, notes, professional_creator_id, acting_organization_id, professional_creator_name, acting_organization_name)
      values (p_farm_id, resolved_season_id, p_date, nullif(p_payload->>'catalog_mix_id','')::bigint,
        trim(p_payload->>'chemical'), coalesce(p_payload->'chemical_items', '[]'::jsonb), coalesce(p_payload->>'dose',''), nullif(p_payload->>'governing_phi_days','')::integer,
        nullif(p_payload->>'safe_harvest_date','')::date, case when p_payload->>'safe_harvest_date' is not null then 'v1' else null end,
        p_payload->>'phi_blocking_component', coalesce(p_payload->>'phi_status','unknown'),
        p_payload->'nutrient_totals_elemental', p_payload->'nutrient_totals_elemental_per_acre', nullif(p_payload->>'nutrient_calc_coverage','')::numeric,
        (p_payload->>'area')::numeric,
        coalesce(p_payload->>'weather',''), coalesce(p_payload->>'operator',''), farm_date_of_pruning, p_payload->>'notes', auth.uid(), p_organization_id, creator_name, organization_name)
      returning to_jsonb(spray_records.*) into result;
    when 'fertigation' then
      if coalesce((p_payload->>'area')::numeric, 0) <= 0 then raise exception 'Area must be positive' using errcode = '22023'; end if;
      linked_irrigation_id := nullif(p_payload->>'irrigation_record_id','')::bigint;
      if linked_irrigation_id is not null and not exists (
        select 1 from public.irrigation_records ir
        where ir.id = linked_irrigation_id and ir.farm_id = p_farm_id
      ) then
        raise exception 'Linked irrigation record does not belong to this farm' using errcode = '23503';
      end if;
      insert into public.fertigation_records
        (farm_id, season_id, date, fertilizers, water_volume, nutrient_totals_elemental, nutrient_totals_elemental_per_acre, nutrient_calc_coverage, area, date_of_pruning, notes, irrigation_record_id, professional_creator_id, acting_organization_id, professional_creator_name, acting_organization_name)
      values (p_farm_id, resolved_season_id, p_date, coalesce(p_payload->'fertilizers','[]'::jsonb), nullif(p_payload->>'water_volume','')::numeric,
        p_payload->'nutrient_totals_elemental', p_payload->'nutrient_totals_elemental_per_acre', nullif(p_payload->>'nutrient_calc_coverage','')::numeric,
        (p_payload->>'area')::numeric, farm_date_of_pruning, p_payload->>'notes', linked_irrigation_id, auth.uid(), p_organization_id, creator_name, organization_name)
      returning to_jsonb(fertigation_records.*) into result;
    when 'harvest' then
      if coalesce((p_payload->>'quantity')::numeric, 0) <= 0 then raise exception 'Quantity must be positive' using errcode = '22023'; end if;
      insert into public.harvest_records
        (farm_id, season_id, date, quantity, grade, price, buyer, date_of_pruning, notes, professional_creator_id, acting_organization_id, professional_creator_name, acting_organization_name)
      values (p_farm_id, resolved_season_id, p_date, (p_payload->>'quantity')::numeric, coalesce(p_payload->>'grade',''), nullif(p_payload->>'price','')::numeric,
        p_payload->>'buyer', farm_date_of_pruning, p_payload->>'notes', auth.uid(), p_organization_id, creator_name, organization_name)
      returning to_jsonb(harvest_records.*) into result;
    when 'note' then
      if nullif(trim(p_payload->>'notes'), '') is null then raise exception 'Note is required' using errcode = '22023'; end if;
      if exists (select 1 from public.daily_notes where farm_id = p_farm_id and date = p_date) then
        raise exception 'A daily note already exists for this farm and date' using errcode = '23505';
      end if;
      insert into public.daily_notes
        (farm_id, season_id, date, notes, professional_creator_id, acting_organization_id, professional_creator_name, acting_organization_name)
      values (p_farm_id, resolved_season_id, p_date, trim(p_payload->>'notes'), auth.uid(), p_organization_id, creator_name, organization_name)
      returning to_jsonb(daily_notes.*) into result;
  end case;
  if result is null then
    raise exception 'Delegated log insert produced no row' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.create_delegated_log(uuid,uuid,bigint,text,date,jsonb) from public;
grant execute on function public.create_delegated_log(uuid,uuid,bigint,text,date,jsonb) to authenticated;
