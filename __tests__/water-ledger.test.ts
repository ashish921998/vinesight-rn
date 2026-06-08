import { logIrrigation, revertIrrigation } from '@/hooks/water-ledger';

type Result = { data?: unknown; error?: unknown };

function makeRpcClient(result: Result) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return Promise.resolve(result);
    },
  };
  return { client, calls };
}

describe('water-ledger', () => {
  describe('logIrrigation', () => {
    it('resolves the season when none is supplied and maps the RPC payload', async () => {
      const { client, calls } = makeRpcClient({
        data: { record: { id: 12 }, water_delta: 250 },
        error: null,
      });
      const resolveSeasonId = jest.fn().mockResolvedValue(4);
      const result = await logIrrigation(
        {
          farm_id: 3,
          date: '2026-02-01',
          duration: 1,
          area: 2,
          growth_stage: '',
          moisture_status: '',
          system_discharge: 250,
        },
        { client: client as never, resolveSeasonId: resolveSeasonId as never },
      );
      expect(result).toEqual({ id: 12, waterDelta: 250 });
      expect(resolveSeasonId).toHaveBeenCalledWith({ farmId: 3, date: '2026-02-01' });
      expect(calls[0].fn).toBe('log_irrigation');
      expect(calls[0].args).toMatchObject({
        p_farm_id: 3,
        p_date: '2026-02-01',
        p_duration: 1,
        p_system_discharge: 250,
        p_season_id: 4,
      });
    });

    it('uses an explicit season_id and skips resolution', async () => {
      const { client, calls } = makeRpcClient({
        data: { record: { id: 1 }, water_delta: 0 },
        error: null,
      });
      const resolveSeasonId = jest.fn();
      await logIrrigation(
        {
          farm_id: 1,
          date: '2026-02-01',
          duration: 1,
          area: 1,
          growth_stage: '',
          moisture_status: '',
          system_discharge: 0,
          season_id: 9,
        },
        { client: client as never, resolveSeasonId: resolveSeasonId as never },
      );
      expect(resolveSeasonId).not.toHaveBeenCalled();
      expect(calls[0].args.p_season_id).toBe(9);
    });

    it('defaults waterDelta to 0 and id to null when the RPC omits them', async () => {
      const { client } = makeRpcClient({ data: { record: null }, error: null });
      const result = await logIrrigation(
        {
          farm_id: 1,
          date: '2026-02-01',
          duration: 1,
          area: 1,
          growth_stage: '',
          moisture_status: '',
          system_discharge: 0,
        },
        { client: client as never, resolveSeasonId: (async () => null) as never },
      );
      expect(result).toEqual({ id: null, waterDelta: 0 });
    });

    it('throws on RPC error', async () => {
      const { client } = makeRpcClient({ data: null, error: new Error('rpc boom') });
      await expect(
        logIrrigation(
          {
            farm_id: 1,
            date: '2026-02-01',
            duration: 1,
            area: 1,
            growth_stage: '',
            moisture_status: '',
            system_discharge: 0,
          },
          { client: client as never, resolveSeasonId: (async () => null) as never },
        ),
      ).rejects.toThrow('rpc boom');
    });
  });

  describe('revertIrrigation', () => {
    it('calls revert_irrigation with the record id and exact delta', async () => {
      const { client, calls } = makeRpcClient({ data: null, error: null });
      await revertIrrigation({ recordId: 12, waterDelta: 250 }, { client: client as never });
      expect(calls[0].fn).toBe('revert_irrigation');
      expect(calls[0].args).toEqual({ p_record_id: 12, p_water_delta: 250 });
    });

    it('throws on RPC error', async () => {
      const { client } = makeRpcClient({ data: null, error: new Error('revert boom') });
      await expect(
        revertIrrigation({ recordId: 1, waterDelta: 0 }, { client: client as never }),
      ).rejects.toThrow('revert boom');
    });
  });
});
