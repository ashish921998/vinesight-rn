do $$
declare
  v_farms_id_sequence text;
begin
  if to_regclass('public.farms') is not null then
    alter table public.farms
      alter column vine_spacing drop not null,
      alter column row_spacing drop not null;

    v_farms_id_sequence := pg_get_serial_sequence('public.farms', 'id');
    if v_farms_id_sequence is not null then
      execute format(
        'select setval(%L::regclass, greatest(coalesce((select max(id) from public.farms), 0), 1), coalesce((select max(id) from public.farms), 0) > 0)',
        v_farms_id_sequence
      );
    end if;
  end if;
end $$;
