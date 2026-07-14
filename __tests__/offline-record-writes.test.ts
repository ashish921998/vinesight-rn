import { supabase } from '@/lib/supabase';
import { isClientUuid } from '@/features/offline/client-id';
import { idempotentCreate, targetedUpdate, targetedDelete } from '@/features/offline/record-writes';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockedFrom = supabase.from as jest.Mock;

type Result = { data?: unknown; error?: unknown };

/**
 * Chainable Supabase mock. Records upsert args / patch / eq calls, resolves
 * `single`/`maybeSingle` (and the chain itself, for delete) to `result`.
 */
function makeChain(result: Result = { data: null, error: null }) {
  const calls = {
    upsertArgs: undefined as undefined | [unknown, unknown],
    updatePatch: undefined as unknown,
    eqCalls: [] as Array<[string, unknown]>,
  };
  const chain: Record<string, unknown> = {};
  chain.upsert = jest.fn((payload: unknown, opts: unknown) => {
    calls.upsertArgs = [payload, opts];
    return chain;
  });
  chain.update = jest.fn((patch: unknown) => {
    calls.updatePatch = patch;
    return chain;
  });
  chain.delete = jest.fn(() => chain);
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn((col: string, val: unknown) => {
    calls.eqCalls.push([col, val]);
    return chain;
  });
  chain.single = jest.fn(() => Promise.resolve(result));
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  // Thenable so `await chain` (delete path) resolves to result.
  chain.then = (onF: ((v: Result) => unknown) | null, onR?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onF, onR);
  return { chain, calls };
}

beforeEach(() => mockedFrom.mockReset());

describe('idempotentCreate', () => {
  it('generates a client_uuid when none is supplied and upserts DO NOTHING on it', async () => {
    const row = { id: 1, farm_id: 7 };
    const { chain, calls } = makeChain({ data: row, error: null });
    mockedFrom.mockReturnValue(chain);

    const out = await idempotentCreate('irrigation_records', { farm_id: 7, date: '2026-06-01' });

    expect(out).toBe(row);
    const [payload, opts] = calls.upsertArgs!;
    expect(isClientUuid((payload as { client_uuid: string }).client_uuid)).toBe(true);
    expect(opts).toEqual({ onConflict: 'client_uuid', ignoreDuplicates: true });
  });

  it('preserves a caller-supplied client_uuid', async () => {
    const { chain, calls } = makeChain({ data: { id: 1 }, error: null });
    mockedFrom.mockReturnValue(chain);

    await idempotentCreate('spray_records', { farm_id: 7, client_uuid: 'fixed-uuid' });

    expect((calls.upsertArgs![0] as { client_uuid: string }).client_uuid).toBe('fixed-uuid');
  });

  it('reads the canonical row back by client_uuid when the insert was skipped (replay)', async () => {
    const insertChain = makeChain({ data: null, error: null }); // conflict → no row
    const readChain = makeChain({ data: { id: 99, client_uuid: 'u1' }, error: null });
    mockedFrom.mockReturnValueOnce(insertChain.chain).mockReturnValueOnce(readChain.chain);

    const out = await idempotentCreate('harvest_records', { farm_id: 7, client_uuid: 'u1' });

    expect(out).toEqual({ id: 99, client_uuid: 'u1' });
    expect(readChain.calls.eqCalls).toContainEqual(['client_uuid', 'u1']);
  });

  it('throws a clear error when a skipped insert cannot read the canonical row', async () => {
    const insertChain = makeChain({ data: null, error: null });
    const readChain = makeChain({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(insertChain.chain).mockReturnValueOnce(readChain.chain);

    await expect(
      idempotentCreate('harvest_records', { farm_id: 7, client_uuid: 'u1' }),
    ).rejects.toThrow(/conflicting harvest_records row .* was not readable/);
  });

  it('throws when the upsert errors', async () => {
    const { chain } = makeChain({ data: null, error: new Error('insert failed') });
    mockedFrom.mockReturnValue(chain);

    await expect(idempotentCreate('expense_records', { farm_id: 7 })).rejects.toThrow(
      'insert failed',
    );
  });
});

describe('targetedUpdate', () => {
  it('targets by id when present', async () => {
    const { chain, calls } = makeChain({ data: { id: 5 }, error: null });
    mockedFrom.mockReturnValue(chain);

    await targetedUpdate('spray_records', { id: 5 }, { notes: 'x' });

    expect(calls.eqCalls).toContainEqual(['id', 5]);
    expect(calls.eqCalls).not.toContainEqual(['client_uuid', expect.anything()]);
  });

  it('falls back to client_uuid when no id', async () => {
    const { chain, calls } = makeChain({ data: { client_uuid: 'u2' }, error: null });
    mockedFrom.mockReturnValue(chain);

    await targetedUpdate('spray_records', { clientUuid: 'u2' }, { notes: 'x' });

    expect(calls.eqCalls).toContainEqual(['client_uuid', 'u2']);
  });

  it('throws when the ref has neither id nor client_uuid', async () => {
    mockedFrom.mockReturnValue(makeChain().chain);
    await expect(targetedUpdate('spray_records', {}, { notes: 'x' })).rejects.toThrow(
      /needs an id or client_uuid/,
    );
  });

  it('throws on a supabase error', async () => {
    const { chain } = makeChain({ data: null, error: new Error('update failed') });
    mockedFrom.mockReturnValue(chain);
    await expect(targetedUpdate('spray_records', { id: 5 }, {})).rejects.toThrow('update failed');
  });
});

describe('targetedDelete', () => {
  it('targets by id when present', async () => {
    const { chain, calls } = makeChain({ error: null });
    mockedFrom.mockReturnValue(chain);

    await targetedDelete('irrigation_records', { id: 8 });

    expect(calls.eqCalls).toContainEqual(['id', 8]);
  });

  it('falls back to client_uuid when no id', async () => {
    const { chain, calls } = makeChain({ error: null });
    mockedFrom.mockReturnValue(chain);

    await targetedDelete('irrigation_records', { clientUuid: 'u3' });

    expect(calls.eqCalls).toContainEqual(['client_uuid', 'u3']);
  });

  it('throws when the ref is empty', async () => {
    mockedFrom.mockReturnValue(makeChain().chain);
    await expect(targetedDelete('irrigation_records', {})).rejects.toThrow(
      /needs an id or client_uuid/,
    );
  });

  it('throws on a supabase error', async () => {
    const { chain } = makeChain({ error: new Error('delete failed') });
    mockedFrom.mockReturnValue(chain);
    await expect(targetedDelete('irrigation_records', { id: 8 })).rejects.toThrow('delete failed');
  });
});
