-- RLS/perf cleanup on irrigation_records + fertigation_records, flagged by
-- Supabase advisors:
--   * auth_rls_initplan — bare auth.uid() re-evaluated per row; wrap in a
--     scalar subquery so it's evaluated once per statement.
--   * multiple_permissive_policies — "Users can access …" duplicates
--     "Users can view …" for SELECT; drop the duplicate.
--   * unindexed_foreign_keys — acting_organization_id FKs had no index.
-- Semantics unchanged: same owner-only farm check on every command.

-- ---------------------------------------------------------------------------
-- irrigation_records
-- ---------------------------------------------------------------------------
drop policy if exists "Users can access irrigation records for their farms" on public.irrigation_records;
drop policy if exists "Users can view their farm irrigation records" on public.irrigation_records;
drop policy if exists "Users can insert irrigation records for their farms" on public.irrigation_records;
drop policy if exists "Users can update irrigation records for their farms" on public.irrigation_records;
drop policy if exists "Users can delete irrigation records for their farms" on public.irrigation_records;

create policy "Users can view their farm irrigation records"
  on public.irrigation_records for select
  using (exists (
    select 1 from public.farms
    where farms.id = irrigation_records.farm_id
      and farms.user_id = (select auth.uid())
  ));

create policy "Users can insert irrigation records for their farms"
  on public.irrigation_records for insert
  with check (exists (
    select 1 from public.farms
    where farms.id = irrigation_records.farm_id
      and farms.user_id = (select auth.uid())
  ));

create policy "Users can update irrigation records for their farms"
  on public.irrigation_records for update
  using (exists (
    select 1 from public.farms
    where farms.id = irrigation_records.farm_id
      and farms.user_id = (select auth.uid())
  ));

create policy "Users can delete irrigation records for their farms"
  on public.irrigation_records for delete
  using (exists (
    select 1 from public.farms
    where farms.id = irrigation_records.farm_id
      and farms.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- fertigation_records
-- ---------------------------------------------------------------------------
drop policy if exists "Users can access fertigation records for their farms" on public.fertigation_records;
drop policy if exists "Users can view their farm fertigation records" on public.fertigation_records;
drop policy if exists "Users can insert fertigation records for their farms" on public.fertigation_records;
drop policy if exists "Users can update fertigation records for their farms" on public.fertigation_records;
drop policy if exists "Users can delete fertigation records for their farms" on public.fertigation_records;

create policy "Users can view their farm fertigation records"
  on public.fertigation_records for select
  using (exists (
    select 1 from public.farms
    where farms.id = fertigation_records.farm_id
      and farms.user_id = (select auth.uid())
  ));

create policy "Users can insert fertigation records for their farms"
  on public.fertigation_records for insert
  with check (exists (
    select 1 from public.farms
    where farms.id = fertigation_records.farm_id
      and farms.user_id = (select auth.uid())
  ));

create policy "Users can update fertigation records for their farms"
  on public.fertigation_records for update
  using (exists (
    select 1 from public.farms
    where farms.id = fertigation_records.farm_id
      and farms.user_id = (select auth.uid())
  ));

create policy "Users can delete fertigation records for their farms"
  on public.fertigation_records for delete
  using (exists (
    select 1 from public.farms
    where farms.id = fertigation_records.farm_id
      and farms.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- FK indexes (advisor: unindexed_foreign_keys)
-- ---------------------------------------------------------------------------
create index if not exists idx_irrigation_records_acting_organization_id
  on public.irrigation_records (acting_organization_id);
create index if not exists idx_fertigation_records_acting_organization_id
  on public.fertigation_records (acting_organization_id);
