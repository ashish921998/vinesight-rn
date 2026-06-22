-- Professional delegated logging. Mirrored from the shared vinesight-web schema history.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'irrigation_records', 'spray_records', 'fertigation_records',
    'harvest_records', 'daily_notes'
  ] loop
    execute format(
      'alter table public.%I add column if not exists professional_creator_id uuid references auth.users(id) on delete restrict, add column if not exists acting_organization_id uuid references public.organizations(id) on delete restrict, add column if not exists professional_creator_name text, add column if not exists acting_organization_name text',
      table_name
    );
    execute format(
      'create index if not exists %I on public.%I(professional_creator_id, acting_organization_id) where professional_creator_id is not null',
      'idx_' || table_name || '_delegated_attribution', table_name
    );
    if not exists (
      select 1 from pg_constraint
      where conname = table_name || '_delegated_attribution_complete'
        and conrelid = ('public.' || table_name)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check ((professional_creator_id is null) = (acting_organization_id is null))',
        table_name, table_name || '_delegated_attribution_complete'
      );
    end if;
  end loop;
end $$;

create or replace function public.can_create_delegated_log(
  target_organization_id uuid,
  target_client_user_id uuid,
  target_farm_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.organization_clients oc
      on oc.organization_id = om.organization_id
     and oc.client_user_id = target_client_user_id
     and oc.status = 'active'
    join public.farms f
      on f.id = target_farm_id
     and f.user_id = target_client_user_id
    where om.organization_id = target_organization_id
      and om.user_id = (select auth.uid())
      and (
        om.role in ('owner', 'admin')
        or om.is_owner = true
        or (om.role = 'agronomist' and oc.assigned_to = (select auth.uid()))
      )
  );
$$;

revoke all on function public.can_create_delegated_log(uuid, uuid, bigint) from public;
grant execute on function public.can_create_delegated_log(uuid, uuid, bigint) to authenticated;

create or replace function public.get_professional_workspace()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'organization_id', o.id,
      'organization_name', o.name,
      'role', case when om.is_owner then 'owner' else om.role end,
      'clients', coalesce((
        select jsonb_agg(jsonb_build_object(
          'user_id', p.id,
          'full_name', coalesce(p.full_name, ''),
          'phone', p.phone,
          'farms', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', f.id, 'name', f.name, 'region', f.region,
              'area', f.area, 'crop', f.crop, 'crop_variety', f.crop_variety
            ) order by f.name)
            from public.farms f where f.user_id = oc.client_user_id
          ), '[]'::jsonb)
        ) order by p.full_name)
        from public.organization_clients oc
        join public.profiles p on p.id = oc.client_user_id
        where oc.organization_id = om.organization_id
          and oc.status = 'active'
          and (om.role in ('owner', 'admin') or om.is_owner or oc.assigned_to = auth.uid())
      ), '[]'::jsonb)
    )
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.user_id = auth.uid()
    order by om.joined_at
    limit 1
  ), 'null'::jsonb);
$$;

revoke all on function public.get_professional_workspace() from public;
grant execute on function public.get_professional_workspace() to authenticated;

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

  case p_record_type
    when 'irrigation' then
      if coalesce((p_payload->>'duration')::numeric, 0) <= 0 then raise exception 'Duration must be positive' using errcode = '22023'; end if;
      insert into public.irrigation_records
        (farm_id, season_id, date, duration, area, growth_stage, moisture_status, system_discharge, notes, professional_creator_id, acting_organization_id, professional_creator_name, acting_organization_name)
      select p_farm_id, resolved_season_id, p_date, (p_payload->>'duration')::numeric, f.area,
        coalesce(p_payload->>'growth_stage', ''), coalesce(p_payload->>'moisture_status', ''),
        coalesce(f.system_discharge, 0), p_payload->>'notes', auth.uid(), p_organization_id, creator_name, organization_name
      from public.farms f where f.id = p_farm_id returning to_jsonb(irrigation_records.*) into result;
    when 'spray' then
      if nullif(trim(p_payload->>'chemical'), '') is null or coalesce((p_payload->>'area')::numeric, 0) <= 0 then raise exception 'Chemical and positive area are required' using errcode = '22023'; end if;
      insert into public.spray_records
        (farm_id, season_id, date, catalog_mix_id, chemical, dose, governing_phi_days, safe_harvest_date, phi_calc_version, phi_blocking_component, phi_status, area, weather, operator, notes, professional_creator_id, acting_organization_id, professional_creator_name, acting_organization_name)
      values (p_farm_id, resolved_season_id, p_date, nullif(p_payload->>'catalog_mix_id','')::bigint,
        trim(p_payload->>'chemical'), coalesce(p_payload->>'dose',''), nullif(p_payload->>'governing_phi_days','')::integer,
        nullif(p_payload->>'safe_harvest_date','')::date, case when p_payload->>'safe_harvest_date' is not null then 'v1' else null end,
        p_payload->>'phi_blocking_component', coalesce(p_payload->>'phi_status','unknown'), (p_payload->>'area')::numeric,
        coalesce(p_payload->>'weather',''), coalesce(p_payload->>'operator',''), p_payload->>'notes', auth.uid(), p_organization_id, creator_name, organization_name)
      returning to_jsonb(spray_records.*) into result;
    when 'fertigation' then
      if coalesce((p_payload->>'area')::numeric, 0) <= 0 then raise exception 'Area must be positive' using errcode = '22023'; end if;
      insert into public.fertigation_records
        (farm_id, season_id, date, fertilizers, water_volume, area, notes, professional_creator_id, acting_organization_id, professional_creator_name, acting_organization_name)
      values (p_farm_id, resolved_season_id, p_date, coalesce(p_payload->'fertilizers','[]'::jsonb), nullif(p_payload->>'water_volume','')::numeric,
        (p_payload->>'area')::numeric, p_payload->>'notes', auth.uid(), p_organization_id, creator_name, organization_name)
      returning to_jsonb(fertigation_records.*) into result;
    when 'harvest' then
      if coalesce((p_payload->>'quantity')::numeric, 0) <= 0 then raise exception 'Quantity must be positive' using errcode = '22023'; end if;
      insert into public.harvest_records
        (farm_id, season_id, date, quantity, grade, price, buyer, notes, professional_creator_id, acting_organization_id, professional_creator_name, acting_organization_name)
      values (p_farm_id, resolved_season_id, p_date, (p_payload->>'quantity')::numeric, coalesce(p_payload->>'grade',''), nullif(p_payload->>'price','')::numeric,
        p_payload->>'buyer', p_payload->>'notes', auth.uid(), p_organization_id, creator_name, organization_name)
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

create or replace function public.get_delegated_farm_activity(
  p_organization_id uuid,
  p_client_user_id uuid,
  p_farm_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.can_create_delegated_log(p_organization_id, p_client_user_id, p_farm_id) then
    raise exception 'Delegated log access denied' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'record_type', activity.record_type,
    'record_data', activity.record_data
  ) order by activity.record_date desc, activity.created_at desc), '[]'::jsonb)
  into result
  from (
    select 'irrigation'::text record_type, r.date record_date, r.created_at, to_jsonb(r.*) record_data from public.irrigation_records r where r.farm_id = p_farm_id and (r.acting_organization_id is null or r.acting_organization_id = p_organization_id)
    union all
    select 'spray', r.date, r.created_at, to_jsonb(r.*) from public.spray_records r where r.farm_id = p_farm_id and (r.acting_organization_id is null or r.acting_organization_id = p_organization_id)
    union all
    select 'fertigation', r.date, r.created_at, to_jsonb(r.*) from public.fertigation_records r where r.farm_id = p_farm_id and (r.acting_organization_id is null or r.acting_organization_id = p_organization_id)
    union all
    select 'harvest', r.date, r.created_at, to_jsonb(r.*) from public.harvest_records r where r.farm_id = p_farm_id and (r.acting_organization_id is null or r.acting_organization_id = p_organization_id)
    union all
    select 'note', r.date, r.created_at, to_jsonb(r.*) from public.daily_notes r where r.farm_id = p_farm_id and (r.acting_organization_id is null or r.acting_organization_id = p_organization_id)
  ) activity;

  return result;
end;
$$;

create or replace function public.update_delegated_log(p_record_type text, p_record_id bigint, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb; org_id uuid; client_id uuid; farm_id bigint;
begin
  if p_record_type not in ('irrigation','spray','fertigation','harvest','note') then raise exception 'Unsupported delegated log type' using errcode='22023'; end if;
  execute format('select acting_organization_id, f.user_id, r.farm_id from public.%I r join public.farms f on f.id=r.farm_id where r.id=$1 and r.professional_creator_id=$2',
    case p_record_type when 'irrigation' then 'irrigation_records' when 'spray' then 'spray_records' when 'fertigation' then 'fertigation_records' when 'harvest' then 'harvest_records' else 'daily_notes' end)
    into org_id, client_id, farm_id using p_record_id, auth.uid();
  if org_id is null or not public.can_create_delegated_log(org_id, client_id, farm_id) then raise exception 'Delegated log access denied' using errcode='42501'; end if;
  execute format('update public.%I set notes=coalesce($1->>''notes'', notes) where id=$2 returning to_jsonb(%I.*)',
    case p_record_type when 'irrigation' then 'irrigation_records' when 'spray' then 'spray_records' when 'fertigation' then 'fertigation_records' when 'harvest' then 'harvest_records' else 'daily_notes' end,
    case p_record_type when 'irrigation' then 'irrigation_records' when 'spray' then 'spray_records' when 'fertigation' then 'fertigation_records' when 'harvest' then 'harvest_records' else 'daily_notes' end)
    into result using p_payload, p_record_id;
  return result;
end $$;

create or replace function public.delete_delegated_log(p_record_type text, p_record_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare org_id uuid; client_id uuid; farm_id bigint; table_name text;
begin
  table_name := case p_record_type when 'irrigation' then 'irrigation_records' when 'spray' then 'spray_records' when 'fertigation' then 'fertigation_records' when 'harvest' then 'harvest_records' when 'note' then 'daily_notes' else null end;
  if table_name is null then raise exception 'Unsupported delegated log type' using errcode='22023'; end if;
  execute format('select acting_organization_id, f.user_id, r.farm_id from public.%I r join public.farms f on f.id=r.farm_id where r.id=$1 and r.professional_creator_id=$2', table_name)
    into org_id, client_id, farm_id using p_record_id, auth.uid();
  if org_id is null or not public.can_create_delegated_log(org_id, client_id, farm_id) then raise exception 'Delegated log access denied' using errcode='42501'; end if;
  execute format('delete from public.%I where id=$1 and professional_creator_id=$2', table_name) using p_record_id, auth.uid();
end $$;

revoke all on function public.create_delegated_log(uuid,uuid,bigint,text,date,jsonb) from public;
revoke all on function public.get_delegated_farm_activity(uuid,uuid,bigint) from public;
revoke all on function public.update_delegated_log(text,bigint,jsonb) from public;
revoke all on function public.delete_delegated_log(text,bigint) from public;
grant execute on function public.create_delegated_log(uuid,uuid,bigint,text,date,jsonb) to authenticated;
grant execute on function public.get_delegated_farm_activity(uuid,uuid,bigint) to authenticated;
grant execute on function public.update_delegated_log(text,bigint,jsonb) to authenticated;
grant execute on function public.delete_delegated_log(text,bigint) to authenticated;
