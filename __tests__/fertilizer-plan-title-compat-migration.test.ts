import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../supabase/migrations/20260713160000_restore_optional_fertilizer_plan_title_compat.sql',
);
const migration = readFileSync(migrationPath, 'utf8');
const approvedDatabaseName = 'vinesight_migration_test';
const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

function runSql(sql: string): string {
  return execFileSync('psql', [databaseUrl!, '-v', 'ON_ERROR_STOP=1', '-Atqc', sql], {
    encoding: 'utf8',
  }).trim();
}

function runMigration(): void {
  execFileSync('psql', [databaseUrl!, '-v', 'ON_ERROR_STOP=1', '-f', migrationPath], {
    encoding: 'utf8',
  });
}

function assertDisposableMigrationDatabase(): void {
  const configuredDatabaseName = decodeURIComponent(new URL(databaseUrl!).pathname.slice(1));
  if (configuredDatabaseName !== approvedDatabaseName) {
    throw new Error(
      `Refusing destructive migration test against database "${configuredDatabaseName}"; expected "${approvedDatabaseName}".`,
    );
  }

  const connectedDatabaseName = runSql('select current_database()');
  if (connectedDatabaseName !== approvedDatabaseName) {
    throw new Error(
      `Refusing destructive migration test against connected database "${connectedDatabaseName}"; expected "${approvedDatabaseName}".`,
    );
  }
}

describe('fertilizer plan title compatibility migration signature', () => {
  it('keeps the optional title as the final function parameter', () => {
    expect(migration).toMatch(
      /create function public\.send_fertilizer_plan\(\s*p_review_id uuid,\s*p_notes text,\s*p_items jsonb,\s*p_title text default null\s*\)/,
    );
  });
});

describeWithDatabase('fertilizer plan title compatibility migration runtime', () => {
  beforeAll(() => {
    assertDisposableMigrationDatabase();
    runSql(`
      drop schema if exists auth cascade;
      drop schema public cascade;
      create schema public;
      create schema auth;
      grant all on schema public to public;

      do $$
      begin
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then
          create role authenticated;
        end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then
          create role service_role;
        end if;
      end
      $$;

      create function auth.uid() returns uuid
      language sql stable
      as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;

      create table public.petiole_triage (
        id uuid primary key,
        organization_id uuid not null,
        farm_id bigint not null,
        client_user_id uuid not null,
        status text not null,
        recommendation text,
        reviewed_by uuid,
        reviewed_at timestamptz
      );

      create table public.fertilizer_plans (
        id uuid primary key default gen_random_uuid(),
        farm_id bigint not null,
        created_by uuid not null,
        organization_id uuid not null,
        notes text,
        petiole_triage_id uuid unique references public.petiole_triage(id)
      );

      create function public.can_access_org_client(uuid, uuid) returns boolean
      language sql as $$ select true $$;
      create function public.validate_fertilizer_plan_items(jsonb) returns void
      language sql as $$ select $$;
      create function public.insert_fertilizer_plan_items(uuid, jsonb) returns void
      language sql as $$ select $$;

      create function public.send_fertilizer_plan(uuid, text, jsonb) returns uuid
      language sql as $$ select null::uuid $$;
    `);
    runMigration();
  });

  it('keeps title nullable and removes the three-argument overload', () => {
    expect(
      runSql(`
        select is_nullable
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'fertilizer_plans'
          and column_name = 'title';
      `),
    ).toBe('YES');
    expect(
      runSql("select to_regprocedure('public.send_fertilizer_plan(uuid,text,jsonb)') is null"),
    ).toBe('t');
  });

  it('persists omitted, null, and explicit title values', () => {
    const omittedReview = '10000000-0000-0000-0000-000000000001';
    const nullReview = '10000000-0000-0000-0000-000000000002';
    const titledReview = '10000000-0000-0000-0000-000000000003';

    runSql(`
      insert into public.petiole_triage
        (id, organization_id, farm_id, client_user_id, status)
      values
        ('${omittedReview}', '20000000-0000-0000-0000-000000000001', 1, '30000000-0000-0000-0000-000000000001', 'pending'),
        ('${nullReview}', '20000000-0000-0000-0000-000000000001', 1, '30000000-0000-0000-0000-000000000001', 'pending'),
        ('${titledReview}', '20000000-0000-0000-0000-000000000001', 1, '30000000-0000-0000-0000-000000000001', 'pending');

      select public.send_fertilizer_plan('${omittedReview}', 'notes', '[]'::jsonb);
      select public.send_fertilizer_plan('${nullReview}', 'notes', '[]'::jsonb, null);
      select public.send_fertilizer_plan('${titledReview}', 'notes', '[]'::jsonb, 'Detailed plan');
    `);

    expect(
      runSql(`
        select coalesce(title, '<null>')
        from public.fertilizer_plans
        order by petiole_triage_id;
      `).split('\n'),
    ).toEqual(['<null>', '<null>', 'Detailed plan']);
  });

  it('grants execution only to authenticated and service_role', () => {
    const signature = 'public.send_fertilizer_plan(uuid,text,jsonb,text)';

    expect(
      runSql(`
        select
          has_function_privilege('authenticated', '${signature}', 'execute'),
          has_function_privilege('service_role', '${signature}', 'execute'),
          has_function_privilege('public', '${signature}', 'execute');
      `),
    ).toBe('t|t|f');
  });
});
