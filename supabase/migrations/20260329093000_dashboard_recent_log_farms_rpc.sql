create or replace function public.get_recent_log_farm_ids(
  p_farm_ids bigint[],
  p_since date
)
returns table (farm_id bigint)
language sql
security definer
set search_path = public
as $$
  with accessible_farms as (
    select f.id
    from public.farms f
    where f.user_id = auth.uid()
      and f.id = any(p_farm_ids)
  ),
  recent_logs as (
    select ir.farm_id
    from public.irrigation_records ir
    join accessible_farms af on af.id = ir.farm_id
    where ir.date >= p_since

    union all

    select sr.farm_id
    from public.spray_records sr
    join accessible_farms af on af.id = sr.farm_id
    where sr.date >= p_since

    union all

    select fr.farm_id
    from public.fertigation_records fr
    join accessible_farms af on af.id = fr.farm_id
    where fr.date >= p_since

    union all

    select hr.farm_id
    from public.harvest_records hr
    join accessible_farms af on af.id = hr.farm_id
    where hr.date >= p_since

    union all

    select er.farm_id
    from public.expense_records er
    join accessible_farms af on af.id = er.farm_id
    where er.date >= p_since

    union all

    select dn.farm_id
    from public.daily_notes dn
    join accessible_farms af on af.id = dn.farm_id
    where dn.date >= p_since
  )
  select distinct recent_logs.farm_id
  from recent_logs;
$$;

grant execute on function public.get_recent_log_farm_ids(bigint[], date) to authenticated;
