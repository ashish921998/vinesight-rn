do $$
begin
  if to_regclass('public.farms') is not null then
    alter table public.farms
      add column if not exists display_order integer;

    with ordered as (
      select
        id,
        row_number() over (
          partition by user_id
          order by created_at desc nulls last, id desc
        ) - 1 as next_display_order
      from public.farms
      where display_order is null
    )
    update public.farms as farms
    set display_order = ordered.next_display_order
    from ordered
    where farms.id = ordered.id;

    create index if not exists farms_user_display_order_idx
      on public.farms (user_id, display_order, created_at desc);
  end if;
end $$;
