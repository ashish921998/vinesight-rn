-- Consultants may send a new fertilizer plan from the same petiole test after
-- an earlier review has been completed. Keep uniqueness only for active review
-- rows so retries and concurrent taps cannot create duplicate pending work.

drop index concurrently if exists public.idx_petiole_triage_unique_test_org;
