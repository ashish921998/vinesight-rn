SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.end_farm_season(p_farm_id bigint, p_end_date date)
 RETURNS farm_seasons
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO pg_catalog, public, extensions, pg_temp
AS $function$
declare
  v_active public.farm_seasons;
  v_updated public.farm_seasons;
begin

  -- A SECURITY DEFINER RPC must authorize the requested farm before touching it.
  -- Keep trusted maintenance sessions and service-role jobs working.
  if coalesce(auth.role(), '') <> 'service_role'
     and not (
       auth.uid() is null
       and session_user in ('postgres', 'supabase_admin')
       and current_setting('role', true) in ('none', 'postgres', 'supabase_admin')
     ) then
    if not exists (
      select 1 from public.farms f
      where f.id = p_farm_id and f.user_id = auth.uid()
    ) then
      raise exception 'Farm access denied' using errcode = '42501';
    end if;
  end if;
  if p_end_date is null then
    raise exception 'end_date is required' using errcode = '22004';
  end if;

  select *
    into v_active
  from public.farm_seasons fs
  where fs.farm_id = p_farm_id
    and fs.end_date is null
  order by fs.start_date desc, fs.id desc
  limit 1
  for update;

  if v_active.id is null then
    raise exception 'No active season found for this farm.' using errcode = 'P0001';
  end if;

  if p_end_date < v_active.start_date then
    raise exception 'Season end date must be on or after start date.' using errcode = '22007';
  end if;

  if exists (
    select 1
    from public.farm_seasons fs
    where fs.farm_id = p_farm_id
      and fs.id <> v_active.id
      and daterange(fs.start_date, coalesce(fs.end_date + 1, 'infinity'::date), '[)')
          && daterange(v_active.start_date, p_end_date + 1, '[)')
  ) then
    raise exception 'Season end date overlaps an existing season.' using errcode = 'P0001';
  end if;

  update public.farm_seasons
     set end_date = p_end_date
   where id = v_active.id
   returning * into v_updated;

  perform public.recompute_farm_season_assignments(p_farm_id);

  return v_updated;
end;
$function$;

CREATE OR REPLACE FUNCTION public.recompute_farm_season_assignments(p_farm_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO pg_catalog, public, extensions, pg_temp
AS $function$
begin

  -- A SECURITY DEFINER RPC must authorize the requested farm before touching it.
  -- Keep trusted maintenance sessions and service-role jobs working.
  if coalesce(auth.role(), '') <> 'service_role'
     and not (
       auth.uid() is null
       and session_user in ('postgres', 'supabase_admin')
       and current_setting('role', true) in ('none', 'postgres', 'supabase_admin')
     ) then
    if not exists (
      select 1 from public.farms f
      where f.id = p_farm_id and f.user_id = auth.uid()
    ) then
      raise exception 'Farm access denied' using errcode = '42501';
    end if;
  end if;
  if to_regclass('public.irrigation_records') is not null then
    update public.irrigation_records r
      set season_id = public.find_farm_season_for_date(r.farm_id, r.date::date)
    where r.farm_id = p_farm_id;
  end if;

  if to_regclass('public.spray_records') is not null then
    update public.spray_records r
      set season_id = public.find_farm_season_for_date(r.farm_id, r.date::date)
    where r.farm_id = p_farm_id;
  end if;

  if to_regclass('public.fertigation_records') is not null then
    update public.fertigation_records r
      set season_id = public.find_farm_season_for_date(r.farm_id, r.date::date)
    where r.farm_id = p_farm_id;
  end if;

  if to_regclass('public.harvest_records') is not null then
    update public.harvest_records r
      set season_id = public.find_farm_season_for_date(r.farm_id, r.date::date)
    where r.farm_id = p_farm_id;
  end if;

  if to_regclass('public.expense_records') is not null then
    update public.expense_records r
      set season_id = public.find_farm_season_for_date(r.farm_id, r.date::date)
    where r.farm_id = p_farm_id;
  end if;

  if to_regclass('public.daily_notes') is not null then
    update public.daily_notes r
      set season_id = public.find_farm_season_for_date(r.farm_id, r.date::date)
    where r.farm_id = p_farm_id;
  end if;

  if to_regclass('public.task_reminders') is not null then
    update public.task_reminders r
      set season_id = public.find_farm_season_for_date(
        r.farm_id,
        coalesce(r.due_date::date, r.created_at::date, current_date)
      )
    where r.farm_id = p_farm_id;
  end if;

  if to_regclass('public.soil_test_records') is not null then
    update public.soil_test_records r
      set season_id = public.find_farm_season_for_date(r.farm_id, r.date::date)
    where r.farm_id = p_farm_id;
  end if;

  if to_regclass('public.petiole_test_records') is not null then
    update public.petiole_test_records r
      set season_id = public.find_farm_season_for_date(r.farm_id, r.date::date)
    where r.farm_id = p_farm_id;
  end if;

  if to_regclass('public.soil_profiles') is not null then
    update public.soil_profiles r
      set season_id = public.find_farm_season_for_date(
        r.farm_id,
        coalesce(r.created_at::date, current_date)
      )
    where r.farm_id = p_farm_id;
  end if;

  if to_regclass('public.temporary_worker_entries') is not null then
    update public.temporary_worker_entries r
      set season_id = public.find_farm_season_for_date(r.farm_id, r.date::date)
    where r.farm_id = p_farm_id;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_farm_season(p_farm_id bigint, p_start_date date, p_template_key text DEFAULT NULL::text, p_config_json jsonb DEFAULT NULL::jsonb, p_season_name text DEFAULT NULL::text, p_crop_type_snapshot text DEFAULT NULL::text, p_template_version integer DEFAULT NULL::integer)
 RETURNS farm_seasons
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO pg_catalog, public, extensions, pg_temp
AS $function$
declare
  v_active_exists boolean;
  v_inserted public.farm_seasons;
begin

  -- A SECURITY DEFINER RPC must authorize the requested farm before touching it.
  -- Keep trusted maintenance sessions and service-role jobs working.
  if coalesce(auth.role(), '') <> 'service_role'
     and not (
       auth.uid() is null
       and session_user in ('postgres', 'supabase_admin')
       and current_setting('role', true) in ('none', 'postgres', 'supabase_admin')
     ) then
    if not exists (
      select 1 from public.farms f
      where f.id = p_farm_id and f.user_id = auth.uid()
    ) then
      raise exception 'Farm access denied' using errcode = '42501';
    end if;
  end if;
  if p_start_date is null then
    raise exception 'start_date is required' using errcode = '22004';
  end if;

  select exists (
    select 1
    from public.farm_seasons fs
    where fs.farm_id = p_farm_id
      and fs.end_date is null
  ) into v_active_exists;

  if v_active_exists then
    raise exception 'An active season exists. End the current season before starting a new one.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.farm_seasons fs
    where fs.farm_id = p_farm_id
      and fs.start_date <= p_start_date
      and (fs.end_date is null or fs.end_date >= p_start_date)
  ) then
    raise exception 'Season start date overlaps an existing season window.'
      using errcode = 'P0001';
  end if;

  insert into public.farm_seasons (
    farm_id,
    start_date,
    end_date,
    season_name,
    crop_type_snapshot,
    template_key,
    template_version,
    config_json
  )
  values (
    p_farm_id,
    p_start_date,
    null,
    p_season_name,
    p_crop_type_snapshot,
    p_template_key,
    p_template_version,
    coalesce(p_config_json, '{}'::jsonb)
  )
  returning * into v_inserted;

  return v_inserted;
end;
$function$;
