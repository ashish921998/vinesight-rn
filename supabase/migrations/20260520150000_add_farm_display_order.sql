do $$
begin
  if to_regclass('public.farms') is not null then
    alter table public.farms
      add column if not exists display_order integer;

    with current_max as (
      select
        user_id,
        max(display_order) as max_display_order
      from public.farms
      where display_order is not null
      group by user_id
    ),
    ordered as (
      select
        farms.id,
        coalesce(current_max.max_display_order, -1)
          + row_number() over (
              partition by farms.user_id
              order by farms.created_at desc nulls last, farms.id desc
            ) as next_display_order
      from public.farms
      left join current_max
        on current_max.user_id = farms.user_id
      where farms.display_order is null
    )
    update public.farms as farms
    set display_order = ordered.next_display_order
    from ordered
    where farms.id = ordered.id;

  end if;
end $$;

create or replace function public.reorder_farms(p_ordered_farm_ids integer[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_requested_count integer;
  v_owned_count integer;
  v_total_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_ordered_farm_ids is null then
    return;
  end if;

  if array_length(p_ordered_farm_ids, 1) is null then
    raise exception 'ordered_farm_ids cannot be empty' using errcode = '22000';
  end if;

  select count(*)
  into v_requested_count
  from unnest(p_ordered_farm_ids) as requested(id);

  if v_requested_count <> (
    select count(distinct requested.id)
    from unnest(p_ordered_farm_ids) as requested(id)
  ) then
    raise exception 'Duplicate farm ids are not allowed' using errcode = '22000';
  end if;

  select count(*)
  into v_owned_count
  from public.farms
  where user_id = v_user_id
    and id = any(p_ordered_farm_ids);

  if v_owned_count <> v_requested_count then
    raise exception 'Cannot reorder farms outside the current user account' using errcode = '42501';
  end if;

  select count(*)
  into v_total_count
  from public.farms
  where user_id = v_user_id;

  if v_total_count <> v_requested_count then
    raise exception 'Farm order must include every farm for the current user' using errcode = '22000';
  end if;

  update public.farms
  set display_order = null
  where user_id = v_user_id
    and id = any(p_ordered_farm_ids);

  with ordered as (
    select
      requested.id,
      requested.ordinality::integer - 1 as display_order
    from unnest(p_ordered_farm_ids) with ordinality as requested(id, ordinality)
  )
  update public.farms
  set display_order = ordered.display_order
  from ordered
  where farms.id = ordered.id
    and farms.user_id = v_user_id;
end;
$$;

grant execute on function public.reorder_farms(integer[]) to authenticated;
