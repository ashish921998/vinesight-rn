do $$
begin
  if to_regclass('public.farms') is not null then
    with ordered as (
      select
        id,
        row_number() over (
          partition by user_id
          order by display_order asc nulls last, created_at desc nulls last, id desc
        ) - 1 as next_display_order
      from public.farms
    )
    update public.farms as farms
    set display_order = ordered.next_display_order
    from ordered
    where farms.id = ordered.id
      and farms.display_order is distinct from ordered.next_display_order;

    create unique index if not exists farms_user_display_order_unique
      on public.farms (user_id, display_order)
      where display_order is not null;
  end if;
end $$;
