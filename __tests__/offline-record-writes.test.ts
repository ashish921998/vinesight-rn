import { supabase } from '@/data-access';
import { isClientUuid } from '@/features/offline/client-id';
import {
  CrossFarmClientUuidError,
  idempotentCreate,
  targetedUpdate,
  targetedDelete,
} from '@/features/offline/record-writes';
import { makeChain } from '../jest-setup/data-access-chain-mock';

jest.mock('@/data-access', () => {
  const dataAccess = { from: jest.fn() };
  return { getDataAccess: jest.fn(() => dataAccess), supabase: dataAccess };
});

const mockedFrom = supabase.from as jest.Mock;

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

  it('reads the canonical row back by client_uuid AND farm_id when the insert was skipped (replay)', async () => {
    const insertChain = makeChain({ data: null, error: null }); // conflict → no row
    const readChain = makeChain({ data: { id: 99, client_uuid: 'u1' }, error: null });
    mockedFrom.mockReturnValueOnce(insertChain.chain).mockReturnValueOnce(readChain.chain);

    const out = await idempotentCreate('harvest_records', { farm_id: 7, client_uuid: 'u1' });

    expect(out).toEqual({ id: 99, client_uuid: 'u1' });
    expect(readChain.calls.eqCalls).toContainEqual(['client_uuid', 'u1']);
    expect(readChain.calls.eqCalls).toContainEqual(['farm_id', 7]);
  });

  it('throws instead of returning another farm’s row when the conflicting uuid is outside this farm', async () => {
    const insertChain = makeChain({ data: null, error: null }); // conflict → no row
    const readChain = makeChain({ data: null, error: null }); // farm-scoped read finds nothing
    mockedFrom.mockReturnValueOnce(insertChain.chain).mockReturnValueOnce(readChain.chain);

    await expect(
      idempotentCreate('harvest_records', { farm_id: 7, client_uuid: 'u1' }),
    ).rejects.toThrow(/not readable in farm_id=7/);
  });

  it('uses a typed error when a conflicting UUID is outside the payload farm', async () => {
    const insertChain = makeChain({ data: null, error: null });
    const { chain: readChain, calls: readCalls } = makeChain({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(insertChain.chain).mockReturnValueOnce(readChain);

    await expect(
      idempotentCreate('harvest_records', { farm_id: 7, client_uuid: 'u1' }),
    ).rejects.toBeInstanceOf(CrossFarmClientUuidError);
    expect(readCalls.eqCalls).toEqual([
      ['client_uuid', 'u1'],
      ['farm_id', 7],
    ]);
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

  it('falls back to client_uuid scoped by farm_id when no id', async () => {
    const { chain, calls } = makeChain({ data: { client_uuid: 'u2' }, error: null });
    mockedFrom.mockReturnValue(chain);

    await targetedUpdate('spray_records', { clientUuid: 'u2', farmId: 7 }, { notes: 'x' });

    expect(calls.eqCalls).toContainEqual(['client_uuid', 'u2']);
    expect(calls.eqCalls).toContainEqual(['farm_id', 7]);
  });

  it('refuses a client_uuid ref without a farm scope (cross-farm write guard)', async () => {
    mockedFrom.mockReturnValue(makeChain().chain);
    await expect(
      targetedUpdate('spray_records', { clientUuid: 'u2' }, { notes: 'x' }),
    ).rejects.toThrow(/needs an id, or a client_uuid \+ farmId/);
  });

  it('throws when the ref has neither id nor client_uuid', async () => {
    mockedFrom.mockReturnValue(makeChain().chain);
    await expect(targetedUpdate('spray_records', {}, { notes: 'x' })).rejects.toThrow(
      /needs an id, or a client_uuid \+ farmId/,
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

  it('falls back to client_uuid scoped by farm_id when no id', async () => {
    const { chain, calls } = makeChain({ error: null });
    mockedFrom.mockReturnValue(chain);

    await targetedDelete('irrigation_records', { clientUuid: 'u3', farmId: 7 });

    expect(calls.eqCalls).toContainEqual(['client_uuid', 'u3']);
    expect(calls.eqCalls).toContainEqual(['farm_id', 7]);
  });

  it('refuses a client_uuid ref without a farm scope (cross-farm delete guard)', async () => {
    mockedFrom.mockReturnValue(makeChain().chain);
    await expect(targetedDelete('irrigation_records', { clientUuid: 'u3' })).rejects.toThrow(
      /needs an id, or a client_uuid \+ farmId/,
    );
  });

  it('throws when the ref is empty', async () => {
    mockedFrom.mockReturnValue(makeChain().chain);
    await expect(targetedDelete('irrigation_records', {})).rejects.toThrow(
      /needs an id, or a client_uuid \+ farmId/,
    );
  });

  it('throws on a supabase error', async () => {
    const { chain } = makeChain({ error: new Error('delete failed') });
    mockedFrom.mockReturnValue(chain);
    await expect(targetedDelete('irrigation_records', { id: 8 })).rejects.toThrow('delete failed');
  });
});
