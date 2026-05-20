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

    create index if not exists farms_user_display_order_idx
      on public.farms (user_id, display_order, created_at desc);
  end if;
end $$;
