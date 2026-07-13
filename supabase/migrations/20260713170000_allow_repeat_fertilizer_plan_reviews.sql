-- Consultants may send a new fertilizer plan from the same petiole test after
-- an earlier review has been completed. Keep uniqueness only for active review
-- rows so retries and concurrent taps cannot create duplicate pending work.

drop index concurrently if exists public.idx_petiole_triage_unique_test_org;

create unique index concurrently idx_petiole_triage_unique_active_test_org
  on public.petiole_triage (petiole_test_id, organization_id)
  where petiole_test_id is not null
    and status in ('pending', 'in_review');
