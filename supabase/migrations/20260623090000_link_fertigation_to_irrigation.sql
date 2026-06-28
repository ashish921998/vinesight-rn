-- Optionally link a fertigation record to the irrigation record it was applied with.
--
-- Fertilizers are mostly delivered through irrigation (fertigation), so the entry form
-- now lets a user attach fertilizers to an irrigation log in a single flow. The two are
-- still stored as independent rows (so standalone irrigation and standalone fertigation
-- entries stay clean), but when they are logged together we record the relationship via
-- this nullable foreign key. ON DELETE SET NULL keeps the fertigation row intact if the
-- irrigation record is later removed.

alter table public.fertigation_records
  add column if not exists irrigation_record_id bigint
    references public.irrigation_records (id) on delete set null;

create index if not exists idx_fertigation_records_irrigation_record_id
  on public.fertigation_records (irrigation_record_id);
