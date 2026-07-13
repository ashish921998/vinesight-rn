import { execFileSync } from 'node:child_process';
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
const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const schemaName = 'fertilizer_plan_index_test';

function runSql(sql: string): string {
  return execFileSync('psql', [databaseUrl!, '-v', 'ON_ERROR_STOP=1', '-Atqc', sql], {
    encoding: 'utf8',
  }).trim();
}

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

describeWithDatabase('repeat fertilizer plan review migration runtime', () => {
  beforeAll(() => {
    runSql(`
      drop schema if exists ${schemaName} cascade;
      create schema ${schemaName};
      create table ${schemaName}.petiole_triage (
        petiole_test_id uuid,
        organization_id uuid not null,
        status text not null
      );
      create unique index idx_petiole_triage_unique_test_org
        on ${schemaName}.petiole_triage (petiole_test_id, organization_id);
    `);
    runSql(dropMigration.replaceAll('public.', `${schemaName}.`));
    runSql(createMigration.replaceAll('public.', `${schemaName}.`));
  });

  afterEach(() => {
    runSql(`delete from ${schemaName}.petiole_triage`);
  });

  afterAll(() => {
    runSql(`drop schema ${schemaName} cascade`);
  });

  it('allows duplicate reviewed rows', () => {
    expect(() =>
      runSql(`
        insert into ${schemaName}.petiole_triage values
          ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'reviewed'),
          ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'reviewed');
      `),
    ).not.toThrow();
  });

  it.each(['pending', 'in_review'])('rejects duplicate %s rows', (status) => {
    expect(() =>
      runSql(`
        insert into ${schemaName}.petiole_triage values
          ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '${status}'),
          ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '${status}');
      `),
    ).toThrow(/duplicate key value violates unique constraint/);
  });
});
