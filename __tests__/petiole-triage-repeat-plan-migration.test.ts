import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dropMigration = readFileSync(
  resolve(
    __dirname,
    '../supabase/migrations/20260713170000_allow_repeat_fertilizer_plan_reviews.sql',
  ),
  'utf8',
);
const createMigration = readFileSync(
  resolve(
    __dirname,
    '../supabase/migrations/20260713170001_create_active_fertilizer_plan_review_index.sql',
  ),
  'utf8',
);

describe('repeat fertilizer plan review migration', () => {
  it('limits uniqueness to active reviews', () => {
    expect(createMigration).toContain("status in ('pending', 'in_review')");
    expect(createMigration).not.toContain("status in ('reviewed'");
  });

  it('runs concurrent index changes in separate migrations', () => {
    expect(dropMigration).toContain(
      'drop index concurrently if exists public.idx_petiole_triage_unique_test_org',
    );
    expect(dropMigration).not.toContain('create unique index concurrently');
    expect(createMigration).toContain(
      'create unique index concurrently idx_petiole_triage_unique_active_test_org',
    );
    expect(createMigration).not.toContain('drop index concurrently');
  });
});
