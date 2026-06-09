import { settleWorker, summarizeSettlementLedger } from '@/services/worker-service';
import type { WorkerSettlementInsert } from '@/types';

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

const baseSettlement: WorkerSettlementInsert = {
  worker_id: 7,
  farm_id: null,
  period_start: '2026-06-01',
  period_end: '2026-06-07',
  days_worked: 5,
  gross_amount: 2500,
  advance_deducted: 500,
  net_payment: 2000,
  status: 'confirmed',
  notes: null,
};

describe('settleWorker', () => {
  it('maps the settlement to settle_worker RPC args and returns the row', async () => {
    const { client, calls } = makeRpcClient({ data: { id: 12, ...baseSettlement }, error: null });
    const result = await settleWorker(baseSettlement, { client: client as never });
    expect(calls[0].fn).toBe('settle_worker');
    expect(calls[0].args).toEqual({
      p_worker_id: 7,
      p_farm_id: null,
      p_period_start: '2026-06-01',
      p_period_end: '2026-06-07',
      p_days_worked: 5,
      p_gross_amount: 2500,
      p_advance_deducted: 500,
      p_net_payment: 2000,
      p_status: 'confirmed',
      p_notes: null,
    });
    expect(result).toMatchObject({ id: 12, worker_id: 7 });
  });

  it('defaults farm_id/notes to null and status to confirmed when omitted', async () => {
    const { client, calls } = makeRpcClient({ data: {}, error: null });
    await settleWorker(
      {
        worker_id: 1,
        period_start: '2026-06-01',
        period_end: '2026-06-07',
        days_worked: 1,
        gross_amount: 100,
        advance_deducted: 0,
        net_payment: 100,
      } as WorkerSettlementInsert,
      { client: client as never },
    );
    expect(calls[0].args.p_farm_id).toBeNull();
    expect(calls[0].args.p_notes).toBeNull();
    expect(calls[0].args.p_status).toBe('confirmed');
  });

  it('passes an explicit draft status through', async () => {
    const { client, calls } = makeRpcClient({ data: {}, error: null });
    await settleWorker({ ...baseSettlement, status: 'draft' }, { client: client as never });
    expect(calls[0].args.p_status).toBe('draft');
  });

  it('throws on RPC error', async () => {
    const { client } = makeRpcClient({ data: null, error: new Error('settle boom') });
    await expect(settleWorker(baseSettlement, { client: client as never })).rejects.toThrow(
      'settle boom',
    );
  });
});

describe('summarizeSettlementLedger', () => {
  const det = (work_status: 'full_day' | 'half_day', rate: number, earnings: number) => ({
    work_status,
    rate,
    earnings,
  });

  it('rolls up full/half counts, summed earnings, and the uniform rate per band', () => {
    expect(
      summarizeSettlementLedger([det('full_day', 500, 500), det('full_day', 500, 500), det('half_day', 500, 250)]),
    ).toEqual({
      fullDays: 2,
      halfDays: 1,
      fullRate: 500,
      halfRate: 500,
      fullEarnings: 1000,
      halfEarnings: 250,
    });
  });

  it('reports a null rate for a band whose days have differing rates', () => {
    const s = summarizeSettlementLedger([det('full_day', 500, 500), det('full_day', 600, 600)]);
    expect(s.fullRate).toBeNull();
    expect(s.fullEarnings).toBe(1100);
    expect(s.halfDays).toBe(0);
    expect(s.halfRate).toBeNull(); // empty band -> no uniform rate
  });

  it('handles an empty detail list', () => {
    expect(summarizeSettlementLedger([])).toEqual({
      fullDays: 0,
      halfDays: 0,
      fullRate: null,
      halfRate: null,
      fullEarnings: 0,
      halfEarnings: 0,
    });
  });
});
