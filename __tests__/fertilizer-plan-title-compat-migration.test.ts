import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    __dirname,
    '../supabase/migrations/20260713160000_restore_optional_fertilizer_plan_title_compat.sql',
  ),
  'utf8',
);

describe('fertilizer plan title compatibility migration', () => {
  it('restores the nullable legacy title column', () => {
    expect(migration).toContain('add column if not exists title text null');
  });

  it('keeps the optional title as the final function parameter', () => {
    expect(migration).toMatch(
      /create function public\.send_fertilizer_plan\(\s*p_review_id uuid,\s*p_notes text,\s*p_items jsonb,\s*p_title text default null\s*\)/,
    );
  });

  it('grants the four-argument function signature', () => {
    const signature = 'public.send_fertilizer_plan(uuid, text, jsonb, text)';

    expect(migration).toContain(`revoke all on function ${signature} from public`);
    expect(migration).toContain(`grant execute on function ${signature} to authenticated`);
    expect(migration).toContain(`grant execute on function ${signature} to service_role`);
  });
});
