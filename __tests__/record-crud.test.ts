import {
  listFarmRecords,
  listFarmRecordsByFarms,
  createFarmRecord,
  updateFarmRecord,
  deleteFarmRecord,
} from '@/hooks/record-crud';

type Result = { data?: unknown; error?: unknown };

/** Minimal chainable Supabase fake: records the call chain, resolves a fixed result. */
function makeClient(result: Result) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'insert', 'update', 'delete']) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return builder;
    };
  }
  builder.single = () => Promise.resolve(result);
  builder.then = (onFulfilled: (r: Result) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return builder;
    },
  };
  return { client, calls };
}

const methods = (calls: Array<{ method: string; args: unknown[] }>) => calls.map((c) => c.method);
const callFor = (calls: Array<{ method: string; args: unknown[] }>, method: string) =>
  calls.find((c) => c.method === method);

describe('record-crud', () => {
  describe('listFarmRecords', () => {
    it('queries a farm newest-first and returns rows', async () => {
      const { client, calls } = makeClient({ data: [{ id: 1 }], error: null });
      const rows = await listFarmRecords('irrigation_records', 42, undefined, {
        client: client as never,
      });
      expect(rows).toEqual([{ id: 1 }]);
      expect(callFor(calls, 'from')?.args).toEqual(['irrigation_records']);
      expect(callFor(calls, 'eq')?.args).toEqual(['farm_id', 42]);
      expect(callFor(calls, 'order')?.args).toEqual(['date', { ascending: false }]);
      // No season filter when seasonId is undefined
      expect(calls.filter((c) => c.method === 'eq')).toHaveLength(1);
    });

    it('adds a season filter when seasonId is provided', async () => {
      const { client, calls } = makeClient({ data: [], error: null });
      await listFarmRecords('spray_records', 1, 7, { client: client as never });
      const eqs = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqs).toEqual([
        ['farm_id', 1],
        ['season_id', 7],
      ]);
    });

    it('returns [] when data is null', async () => {
      const { client } = makeClient({ data: null, error: null });
      expect(
        await listFarmRecords('spray_records', 1, undefined, { client: client as never }),
      ).toEqual([]);
    });

    it('throws on error', async () => {
      const { client } = makeClient({ data: null, error: new Error('boom') });
      await expect(
        listFarmRecords('spray_records', 1, undefined, { client: client as never }),
      ).rejects.toThrow('boom');
    });
  });

  describe('listFarmRecordsByFarms', () => {
    it('short-circuits to [] for no farms without hitting the client', async () => {
      const { client, calls } = makeClient({ data: [{ id: 9 }], error: null });
      expect(
        await listFarmRecordsByFarms('harvest_records', [], { client: client as never }),
      ).toEqual([]);
      expect(calls).toHaveLength(0);
    });

    it('uses an IN filter across farm ids', async () => {
      const { client, calls } = makeClient({ data: [{ id: 9 }], error: null });
      const rows = await listFarmRecordsByFarms('harvest_records', [1, 2], {
        client: client as never,
      });
      expect(rows).toEqual([{ id: 9 }]);
      expect(callFor(calls, 'in')?.args).toEqual(['farm_id', [1, 2]]);
    });
  });

  describe('createFarmRecord', () => {
    it('resolves the season from farm+date when none is supplied, then inserts', async () => {
      const { client, calls } = makeClient({ data: { id: 5 }, error: null });
      const resolveSeasonId = jest.fn().mockResolvedValue(7);
      const created = await createFarmRecord(
        'irrigation_records',
        { farm_id: 3, date: '2026-01-15' },
        { client: client as never, resolveSeasonId: resolveSeasonId as never },
      );
      expect(created).toEqual({ id: 5 });
      expect(resolveSeasonId).toHaveBeenCalledWith({ farmId: 3, date: '2026-01-15' });
      expect(callFor(calls, 'insert')?.args).toEqual([
        { farm_id: 3, date: '2026-01-15', season_id: 7 },
      ]);
      expect(methods(calls)).toEqual(['from', 'insert', 'select']);
    });

    it('honors an explicit season_id and skips resolution', async () => {
      const { client, calls } = makeClient({ data: { id: 6 }, error: null });
      const resolveSeasonId = jest.fn().mockResolvedValue(99);
      await createFarmRecord(
        'spray_records',
        { farm_id: 3, date: '2026-01-15', season_id: 2 },
        { client: client as never, resolveSeasonId: resolveSeasonId as never },
      );
      expect(resolveSeasonId).not.toHaveBeenCalled();
      expect(callFor(calls, 'insert')?.args).toEqual([
        { farm_id: 3, date: '2026-01-15', season_id: 2 },
      ]);
    });

    it('throws on insert error', async () => {
      const { client } = makeClient({ data: null, error: new Error('insert failed') });
      await expect(
        createFarmRecord(
          'spray_records',
          { farm_id: 1, date: '2026-01-01' },
          { client: client as never, resolveSeasonId: (async () => null) as never },
        ),
      ).rejects.toThrow('insert failed');
    });
  });

  describe('updateFarmRecord', () => {
    it('updates by id and returns the row', async () => {
      const { client, calls } = makeClient({ data: { id: 8, duration: 2 }, error: null });
      const updated = await updateFarmRecord(
        'irrigation_records',
        8,
        { duration: 2 },
        { client: client as never },
      );
      expect(updated).toEqual({ id: 8, duration: 2 });
      expect(callFor(calls, 'update')?.args).toEqual([{ duration: 2 }]);
      expect(callFor(calls, 'eq')?.args).toEqual(['id', 8]);
    });
  });

  describe('deleteFarmRecord', () => {
    it('deletes by id', async () => {
      const { client, calls } = makeClient({ error: null });
      await deleteFarmRecord('expense_records', 11, { client: client as never });
      expect(methods(calls)).toEqual(['from', 'delete', 'eq']);
      expect(callFor(calls, 'eq')?.args).toEqual(['id', 11]);
    });

    it('throws on delete error', async () => {
      const { client } = makeClient({ error: new Error('nope') });
      await expect(
        deleteFarmRecord('expense_records', 11, { client: client as never }),
      ).rejects.toThrow('nope');
    });
  });
});
