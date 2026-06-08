import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useSaveSingleLog } from '@/features/entry-log-session/use-save-single-log';
import { submitEntryPendingLog } from '@/utils/entry-log-submission';
import type { Farm } from '@/types';
import type { AreaUnitPreference } from '@/utils/preferences';

/**
 * Irrigation's water delta is now computed server-side by the log_irrigation RPC
 * (clamped to tank capacity there) and reported back through submitEntryPendingLog's
 * result. The receipt screen subtracts that exact delta from the live tank level on
 * undo. These tests pin that the hook PASSES THROUGH whatever delta the submission
 * reports (rather than recomputing it from a stale client snapshot).
 */

// Boundary mock: the real submission hits the DB/RPC; we only care that the hook
// surfaces the recordId + waterDelta the submission returns.
jest.mock('@/utils/entry-log-submission', () => ({
  submitEntryPendingLog: jest.fn(),
}));

jest.mock('@/hooks', () => ({
  useLogIrrigation: () => ({ mutateAsync: jest.fn().mockResolvedValue({ id: 1, waterDelta: 0 }) }),
  useCreateSprayRecord: () => ({ mutateAsync: jest.fn().mockResolvedValue({ id: 1 }) }),
  useCreateHarvestRecord: () => ({ mutateAsync: jest.fn().mockResolvedValue({ id: 1 }) }),
  useCreateExpenseRecord: () => ({ mutateAsync: jest.fn().mockResolvedValue({ id: 1 }) }),
  useCreateFertigationRecord: () => ({ mutateAsync: jest.fn().mockResolvedValue({ id: 1 }) }),
  useUpsertDailyNote: () => ({ mutateAsync: jest.fn().mockResolvedValue({ id: 1 }) }),
  fetchDailyNoteByDate: jest.fn().mockResolvedValue(null),
  queryKeys: { dashboard: { all: ['dashboard'] } },
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeFarm(overrides: Partial<Farm>): Farm {
  return {
    id: 1,
    area: 1,
    remaining_water: 100,
    total_tank_capacity: 1000,
    system_discharge: 10,
    ...overrides,
  } as Farm;
}

const AREA_UNIT = 'acre' as AreaUnitPreference;

async function save(farm: Farm, type: string, data: Record<string, unknown>) {
  const { result } = renderHook(() => useSaveSingleLog(), { wrapper: createWrapper() });
  let out: Awaited<ReturnType<typeof result.current>> | undefined;
  await act(async () => {
    out = await result.current({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
      farm,
      dateStr: '2026-06-08',
      preferredAreaUnit: AREA_UNIT,
    });
  });
  return out!;
}

describe('useSaveSingleLog — waterDelta passthrough', () => {
  beforeEach(() => {
    (submitEntryPendingLog as jest.Mock).mockReset();
    (submitEntryPendingLog as jest.Mock).mockResolvedValue({ recordId: 123 });
  });

  it('passes through the exact waterDelta the atomic submission reports', async () => {
    (submitEntryPendingLog as jest.Mock).mockResolvedValueOnce({ recordId: 123, waterDelta: 50 });
    const out = await save(makeFarm({}), 'irrigation', { duration: 5 });
    expect(out.waterDelta).toBe(50);
  });

  it('leaves waterDelta undefined when the submission reports none (non-irrigation)', async () => {
    const out = await save(makeFarm({}), 'expense', { type: 'Fuel', cost: 500 });
    expect(out.waterDelta).toBeUndefined();
  });

  it('still returns the record id and farm id from the submission', async () => {
    (submitEntryPendingLog as jest.Mock).mockResolvedValueOnce({ recordId: 123, waterDelta: 50 });
    const out = await save(makeFarm({ id: 42 }), 'irrigation', { duration: 5 });
    expect(out.recordId).toBe(123);
    expect(out.farmId).toBe(42);
  });
});
