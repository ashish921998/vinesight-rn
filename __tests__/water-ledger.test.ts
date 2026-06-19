import {
  logIrrigation,
  revertIrrigation,
  setWaterLevel,
  WaterLevelConflictError,
} from '@/hooks/water-ledger';

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

  describe('setWaterLevel', () => {
    it('maps the payload to set_water_level args and returns the farm row', async () => {
      const { client, calls } = makeRpcClient({
        data: { id: 3, remaining_water: 42, total_tank_capacity: 100 },
        error: null,
      });
      const result = await setWaterLevel(
        { farmId: 3, newLevel: 42, expectedLevel: 50 },
        { client: client as never },
      );
      expect(calls[0].fn).toBe('set_water_level');
      expect(calls[0].args).toEqual({ p_farm_id: 3, p_new_level: 42, p_expected_level: 50 });
      expect(result).toMatchObject({ id: 3, remaining_water: 42 });
    });

    it('defaults expectedLevel to null when omitted (force set)', async () => {
      const { client, calls } = makeRpcClient({ data: { id: 1 }, error: null });
      await setWaterLevel({ farmId: 1, newLevel: 10 }, { client: client as never });
      expect(calls[0].args.p_expected_level).toBeNull();
    });

    it('throws WaterLevelConflictError when the RPC reports a 40001 conflict', async () => {
      const { client } = makeRpcClient({
        data: null,
        error: { code: '40001', message: 'Water level changed since read' },
      });
      await expect(
        setWaterLevel({ farmId: 1, newLevel: 10, expectedLevel: 5 }, { client: client as never }),
      ).rejects.toBeInstanceOf(WaterLevelConflictError);
    });

    it('rethrows a non-conflict RPC error unchanged', async () => {
      const { client } = makeRpcClient({
        data: null,
        error: Object.assign(new Error('set boom'), { code: '42501' }),
      });
      await expect(
        setWaterLevel({ farmId: 1, newLevel: 10 }, { client: client as never }),
      ).rejects.toThrow('set boom');
    });
  });
});
