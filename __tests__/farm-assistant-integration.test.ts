/**
 * Integration test: full flow transcript → intent → fetch → compute → verbalize
 */

import { classifyIntent, computeAnswer, verbalizeAnswer } from '@/services/farm-assistant-service';
import type { Farm } from '@/types/database';

const mockChain = {
  select: jest.fn(),
  eq: jest.fn(),
  in: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  order: jest.fn(),
  limit: jest.fn(),
  range: jest.fn(),
};

function mockResetChain(data: Record<string, unknown>[] = []) {
  for (const fn of Object.values(mockChain)) {
    fn.mockReturnValue(mockChain);
  }

  // Terminal calls used by fetchRecordsForIntent()
  mockChain.limit.mockResolvedValue({ data, error: null });
  mockChain.range.mockResolvedValue({ data, error: null });

  // Terminal call used by getFarmNames(): .eq(...).in('id', farmIds)
  mockChain.in.mockImplementation((column: string) => {
    if (column === 'id') {
      return Promise.resolve({ data: [], error: null });
    }
    return mockChain;
  });
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null,
      }),
    },
    from: jest.fn(() => {
      mockResetChain();
      return mockChain;
    }),
  },
}));

const FARMS: Farm[] = [{ id: 1, name: 'Farm A' } as Farm, { id: 2, name: 'Green Valley' } as Farm];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Integration: transcript → intent → fetch → compute → verbalize', () => {
  it('processes "total irrigation this month" end to end', async () => {
    const intent = classifyIntent('total irrigation this month', FARMS);
    expect(intent.category).toBe('irrigation');
    expect(intent.queryType).toBe('total');
    expect(intent.timeRange).not.toBeNull();
    expect(intent.confidence).toBeGreaterThanOrEqual(0.6);

    const mockRecords: Record<string, unknown>[] = [
      { date: '2026-02-05', duration: 3.0, farm_id: 1 },
      { date: '2026-02-03', duration: 2.5, farm_id: 1 },
      { date: '2026-02-01', duration: 1.5, farm_id: 2 },
    ];
    const farmNames = new Map([
      [1, 'Farm A'],
      [2, 'Green Valley'],
    ]);

    const answer = computeAnswer(intent, mockRecords, farmNames);
    expect(answer.category).toBe('irrigation');
    expect(answer.queryType).toBe('total');
    expect(answer.summary.value).toBe(7);
    expect(answer.summary.unit).toBe('hours');
    expect(answer.totalRecordCount).toBe(3);
    expect(answer.rows.length).toBeLessThanOrEqual(5);

    const verbalized = await verbalizeAnswer(answer, 'en');
    expect(verbalized).toBeTruthy();

    expect(answer.summary.label).toBe('Total irrigation');
    expect(answer.timeRange).toBeDefined();
  });

  it('processes "last spray on Farm A" end to end', () => {
    const intent = classifyIntent('last spray on Farm A', FARMS);
    expect(intent.category).toBe('spray');
    expect(intent.queryType).toBe('last');
    expect(intent.farmName).toBe('Farm A');
    expect(intent.farmId).toBe(1);

    const mockRecords: Record<string, unknown>[] = [
      { date: '2026-02-08', chemical: 'Mancozeb', dose: '2g/L', farm_id: 1 },
      { date: '2026-02-01', chemical: 'Carbendazim', dose: '1g/L', farm_id: 1 },
    ];
    const farmNames = new Map([[1, 'Farm A']]);

    const answer = computeAnswer(intent, mockRecords, farmNames);
    expect(answer.rows).toHaveLength(1);
    expect(answer.rows[0].primary).toBe('Mancozeb');
    expect(answer.summary.label).toBe('Last spray');
    expect(answer.farmFilter).toBe('Farm A');
  });

  it('processes "how much did I spend this month" end to end', () => {
    const intent = classifyIntent('how much did I spend this month', FARMS);
    expect(intent.category).toBe('expense');
    expect(intent.queryType).toBe('total');

    const mockRecords: Record<string, unknown>[] = [
      { date: '2026-02-05', type: 'spray', cost: 2000, farm_id: 1 },
      { date: '2026-02-03', type: 'irrigation', cost: 1500, farm_id: 2 },
    ];
    const farmNames = new Map([
      [1, 'Farm A'],
      [2, 'Green Valley'],
    ]);

    const answer = computeAnswer(intent, mockRecords, farmNames);
    expect(answer.category).toBe('expense');
    expect(answer.summary.value).toBe(3500);
    expect(answer.summary.unit).toBe('₹');
  });

  it('processes "fertilizer this season" end to end', () => {
    const intent = classifyIntent('fertilizer this season', FARMS);
    expect(intent.category).toBe('fertigation');
    expect(intent.queryType).toBe('history');
    expect(intent.timeRange).not.toBeNull();

    const mockRecords: Record<string, unknown>[] = [
      {
        date: '2026-01-15',
        fertilizers: [{ name: 'Urea', quantity: 5, unit: 'kg' }],
        farm_id: 1,
      },
      {
        date: '2026-01-10',
        fertilizers: [{ name: 'DAP', quantity: 3, unit: 'kg' }],
        farm_id: 2,
      },
    ];
    const farmNames = new Map([
      [1, 'Farm A'],
      [2, 'Green Valley'],
    ]);

    const answer = computeAnswer(intent, mockRecords, farmNames);
    expect(answer.category).toBe('fertigation');
    expect(answer.rows).toHaveLength(2);
    expect(answer.rows[0].primary).toContain('Urea');
    expect(answer.totalRecordCount).toBe(2);
  });

  it('handles empty results gracefully', () => {
    const intent = classifyIntent('spray last week', FARMS);
    const farmNames = new Map<number, string>();

    const answer = computeAnswer(intent, [], farmNames);
    expect(answer.summary.label).toBe('No records found');
    expect(answer.rows).toHaveLength(0);
    expect(answer.totalRecordCount).toBe(0);
  });

  it('rejects unsupported intents before fetching', () => {
    const intent = classifyIntent('what is the weather today', FARMS);
    expect(intent.category).toBeNull();
    expect(intent.confidence).toBe(0);
  });

  it('verbalizeAnswer returns undefined for empty records', async () => {
    const intent = classifyIntent('spray last week', FARMS);
    const answer = computeAnswer(intent, [], new Map());
    const verbalized = await verbalizeAnswer(answer, 'mr');
    expect(verbalized).toBeUndefined();
  });

  it('handles Marathi query via classification', () => {
    const intent = classifyIntent('मागील महिन्यात फवारणी', FARMS);
    expect(intent.category).toBe('spray');
    expect(intent.timeRange).not.toBeNull();
    expect(intent.queryType).toBe('history');
  });
});
