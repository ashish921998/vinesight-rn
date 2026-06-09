import { supabase } from '@/lib/supabase';
import { calculateWorkerSettlement } from '@/services/worker-service';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockedFrom = supabase.from as jest.Mock;

/** Build a chainable query mock where terminal methods resolve to the given result.
 *  Non-terminal methods are also thenable so awaiting any point in the chain resolves to terminalResult. */
function mockChain(terminalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> & { then?: typeof Promise.prototype.then } = {};
  const self = () => chain;

  // Make the chain itself thenable so `await chain.insert(...)` resolves correctly
  chain.then = function (
    onFulfilled?: ((v: unknown) => unknown) | null,
    onRejected?: ((r: unknown) => unknown) | null,
  ) {
    return Promise.resolve(terminalResult).then(onFulfilled, onRejected);
  } as typeof Promise.prototype.then;

  chain.select = jest.fn(self);
  chain.insert = jest.fn(self);
  chain.update = jest.fn(self);
  chain.delete = jest.fn(self);
  chain.eq = jest.fn(self);
  chain.neq = jest.fn(self);
  chain.gte = jest.fn(self);
  chain.lte = jest.fn(self);
  chain.contains = jest.fn(self);
  chain.order = jest.fn(self);
  chain.single = jest.fn().mockResolvedValue(terminalResult);

  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('calculateWorkerSettlement', () => {
  function setupMocks(
    workerResult: { data: unknown; error: unknown },
    attendanceResult: { data: unknown; error: unknown },
  ) {
    const workerChain = mockChain(workerResult);
    const attendanceChain = mockChain(attendanceResult);

    mockedFrom.mockImplementation((table: string) => {
      if (table === 'workers') return workerChain;
      if (table === 'worker_attendance') return attendanceChain;
      return mockChain({ data: null, error: null });
    });

    return { workerChain, attendanceChain };
  }

  it('calculates gross amount for full_day attendance', async () => {
    setupMocks(
      { data: { id: 1, daily_rate: 500 }, error: null },
      {
        data: [
          {
            date: '2024-06-01',
            work_status: 'full_day',
            work_type: 'pruning',
            daily_rate_override: null,
          },
          {
            date: '2024-06-02',
            work_status: 'full_day',
            work_type: 'pruning',
            daily_rate_override: null,
          },
        ],
        error: null,
      },
    );

    const result = await calculateWorkerSettlement(1, null, '2024-06-01', '2024-06-30');

    expect(result.days_worked).toBe(2);
    expect(result.gross_amount).toBe(1000);
    expect(result.attendance_details).toHaveLength(2);
    expect(result.attendance_details[0].earnings).toBe(500);
  });

  it('handles half_day attendance correctly', async () => {
    setupMocks(
      { data: { id: 1, daily_rate: 500 }, error: null },
      {
        data: [
          {
            date: '2024-06-01',
            work_status: 'full_day',
            work_type: 'pruning',
            daily_rate_override: null,
          },
          {
            date: '2024-06-02',
            work_status: 'half_day',
            work_type: 'spraying',
            daily_rate_override: null,
          },
        ],
        error: null,
      },
    );

    const result = await calculateWorkerSettlement(1, null, '2024-06-01', '2024-06-30');

    expect(result.days_worked).toBe(1.5);
    expect(result.gross_amount).toBe(750);
    expect(result.attendance_details[1].earnings).toBe(250);
    expect(result.attendance_details[1].work_status).toBe('half_day');
  });

  it('handles empty attendance (no records)', async () => {
    setupMocks({ data: { id: 1, daily_rate: 500 }, error: null }, { data: [], error: null });

    const result = await calculateWorkerSettlement(1, null, '2024-06-01', '2024-06-30');

    expect(result.days_worked).toBe(0);
    expect(result.gross_amount).toBe(0);
    expect(result.attendance_details).toHaveLength(0);
  });

  it('uses daily_rate_override when present', async () => {
    setupMocks(
      { data: { id: 1, daily_rate: 500 }, error: null },
      {
        data: [
          {
            date: '2024-06-01',
            work_status: 'full_day',
            work_type: 'pruning',
            daily_rate_override: 700,
          },
        ],
        error: null,
      },
    );

    const result = await calculateWorkerSettlement(1, null, '2024-06-01', '2024-06-30');

    expect(result.gross_amount).toBe(700);
    expect(result.attendance_details[0].rate).toBe(700);
  });

  it('throws when worker fetch fails', async () => {
    setupMocks({ data: null, error: { message: 'Worker not found' } }, { data: [], error: null });

    await expect(calculateWorkerSettlement(999, null, '2024-06-01', '2024-06-30')).rejects.toEqual({
      message: 'Worker not found',
    });
  });

  it('applies contains filter when farmId is provided', async () => {
    const { attendanceChain } = setupMocks(
      { data: { id: 1, daily_rate: 500 }, error: null },
      { data: [], error: null },
    );

    await calculateWorkerSettlement(1, 42, '2024-06-01', '2024-06-30');

    expect(attendanceChain.contains).toHaveBeenCalledWith('farm_ids', [42]);
  });

  it('throws when attendance fetch fails', async () => {
    setupMocks(
      { data: { id: 1, daily_rate: 500 }, error: null },
      { data: null, error: { message: 'Attendance fetch failed' } },
    );

    await expect(calculateWorkerSettlement(1, null, '2024-06-01', '2024-06-30')).rejects.toEqual({
      message: 'Attendance fetch failed',
    });
  });
});
