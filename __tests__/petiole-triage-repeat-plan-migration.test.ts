import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    __dirname,
    '../supabase/migrations/20260713170000_allow_repeat_fertilizer_plan_reviews.sql',
  ),
  'utf8',
);

describe('repeat fertilizer plan review migration', () => {
  it('limits uniqueness to active reviews', () => {
    expect(migration).toContain("status in ('pending', 'in_review')");
    expect(migration).not.toContain("status in ('reviewed'");
  });

  it('removes the legacy all-status unique index', () => {
    expect(migration).toContain('drop index if exists public.idx_petiole_triage_unique_test_org');
  });
});
