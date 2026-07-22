import { calculateWorkerSettlement, createWorkerSettlement } from '@/services/worker-service';

const mockWorkers = {
  getWorker: jest.fn(),
  getAttendance: jest.fn(),
  createSettlement: jest.fn(),
  createTransaction: jest.fn(),
  getAdvanceBalance: jest.fn(),
  updateAdvanceBalance: jest.fn(),
  deleteSettlement: jest.fn(),
};
jest.mock('@/data-access', () => {
  return { getDataAccess: jest.fn(() => ({ workers: mockWorkers })) };
});

const mockedWorkers = mockWorkers;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('calculateWorkerSettlement', () => {
  function setupMocks(
    workerResult: { data: unknown; error: unknown },
    attendanceResult: { data: unknown; error: unknown },
  ) {
    if (workerResult.error) mockedWorkers.getWorker.mockRejectedValue(workerResult.error);
    else mockedWorkers.getWorker.mockResolvedValue(workerResult.data);
    if (attendanceResult.error)
      mockedWorkers.getAttendance.mockRejectedValue(attendanceResult.error);
    else mockedWorkers.getAttendance.mockResolvedValue(attendanceResult.data ?? []);
    return { attendance: mockedWorkers.getAttendance };
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
    const { attendance } = setupMocks(
      { data: { id: 1, daily_rate: 500 }, error: null },
      { data: [], error: null },
    );

    await calculateWorkerSettlement(1, 42, '2024-06-01', '2024-06-30');

    expect(attendance).toHaveBeenCalledWith({
      workerId: 1,
      periodStart: '2024-06-01',
      periodEnd: '2024-06-30',
      farmId: 42,
    });
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

describe('createWorkerSettlement', () => {
  it('calls supabase insert with correct data and creates payment transaction', async () => {
    const settlement = {
      worker_id: 1,
      farm_id: 10,
      period_start: '2024-06-01',
      period_end: '2024-06-30',
      days_worked: 20,
      gross_amount: 10000,
      advance_deducted: 0,
      net_payment: 10000,
      status: 'confirmed' as const,
      notes: 'June settlement',
    };

    const createdRecord = { id: 42, ...settlement };
    mockedWorkers.createSettlement.mockResolvedValue(createdRecord);
    mockedWorkers.createTransaction.mockResolvedValue(undefined);

    const result = await createWorkerSettlement(settlement);

    expect(mockedWorkers.createSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        worker_id: 1,
        farm_id: 10,
        period_start: '2024-06-01',
        period_end: '2024-06-30',
        days_worked: 20,
        gross_amount: 10000,
        advance_deducted: 0,
        net_payment: 10000,
        status: 'confirmed',
        notes: 'June settlement',
      }),
    );

    // net_payment > 0 triggers a payment transaction insert
    expect(mockedWorkers.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        worker_id: 1,
        type: 'payment',
        amount: 10000,
        settlement_id: 42,
      }),
    );
    expect(result).toEqual(createdRecord);
  });

  it('throws when insert fails', async () => {
    const settlement = {
      worker_id: 1,
      farm_id: null,
      period_start: '2024-06-01',
      period_end: '2024-06-30',
      days_worked: 0,
      gross_amount: 0,
      advance_deducted: 0,
      net_payment: 0,
      status: 'draft' as const,
    };

    mockedWorkers.createSettlement.mockRejectedValue({ message: 'Insert failed' });

    await expect(createWorkerSettlement(settlement)).rejects.toEqual({
      message: 'Insert failed',
    });
  });
});
