-- Backfill fertigation → irrigation links.
--
-- fertigation_records.irrigation_record_id was added 2026-06-23, so all older
-- rows (and rows created via paths that don't set the link, e.g. the receipt
-- screen and the delegated-log RPC) are unlinked even when the fertilizer was
-- applied with an irrigation. Link a fertigation row only when there is
-- EXACTLY ONE irrigation record on the same farm and date — ambiguous days
-- (multiple irrigations) are left untouched rather than guessed.
update public.fertigation_records f
set irrigation_record_id = s.irrigation_id
from (
  select f2.id as fertigation_id, min(i.id) as irrigation_id
  from public.fertigation_records f2
  join public.irrigation_records i
    on i.farm_id = f2.farm_id
   and i.date = f2.date
  where f2.irrigation_record_id is null
  group by f2.id
  having count(*) = 1
) s
where f.id = s.fertigation_id;
