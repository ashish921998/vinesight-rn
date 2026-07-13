-- Keep active review creation idempotent without blocking writes while the
-- replacement partial unique index is built.

create unique index concurrently idx_petiole_triage_unique_active_test_org
  on public.petiole_triage (petiole_test_id, organization_id)
  where petiole_test_id is not null
    and status in ('pending', 'in_review');
