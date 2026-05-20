do $$
begin
  if to_regclass('public.season_inference_audit') is not null then
    alter table public.season_inference_audit enable row level security;

    -- Audit rows are written by trusted server-side paths using service_role or triggers.
    -- Client roles only need owner-scoped read access.
    drop policy if exists "season inference audit select own farm"
      on public.season_inference_audit;

    create policy "season inference audit select own farm"
      on public.season_inference_audit
      for select
      using (
        exists (
          select 1
          from public.farms
          where farms.id = season_inference_audit.farm_id
            and farms.user_id = auth.uid()
        )
      );
  end if;
end $$;
