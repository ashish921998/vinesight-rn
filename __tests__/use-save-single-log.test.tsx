import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useSaveSingleLog } from '@/features/entry-log-session/use-save-single-log';
import { submitEntryPendingLog } from '@/utils/entry-log-submission';
import type { Farm } from '@/types';
import type { AreaUnitPreference } from '@/utils/preferences';

// Boundary mock: the real submission writes to the DB; these tests cover the hook's
// result mapping and leave water-level side effects to the database trigger.
jest.mock('@/utils/entry-log-submission', () => ({
  submitEntryPendingLog: jest.fn().mockResolvedValue({ recordId: 123 }),
}));

jest.mock('@/hooks', () => ({
  useCreateIrrigationRecord: () => ({ mutateAsync: jest.fn().mockResolvedValue({ id: 1 }) }),
  useCreateSprayRecord: () => ({ mutateAsync: jest.fn().mockResolvedValue({ id: 1 }) }),
  useCreateHarvestRecord: () => ({ mutateAsync: jest.fn().mockResolvedValue({ id: 1 }) }),
  useCreateExpenseRecord: () => ({ mutateAsync: jest.fn().mockResolvedValue({ id: 1 }) }),
  useCreateFertigationRecord: () => ({ mutateAsync: jest.fn().mockResolvedValue({ id: 1 }) }),
  useUpsertDailyNote: () => ({ mutateAsync: jest.fn().mockResolvedValue({ id: 1 }) }),
  useUpdateFarmWaterLevel: () => ({ mutateAsync: jest.fn().mockResolvedValue(undefined) }),
  useDeleteIrrigationRecord: () => ({ mutateAsync: jest.fn().mockResolvedValue(undefined) }),
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

describe('useSaveSingleLog', () => {
  beforeEach(() => {
    (submitEntryPendingLog as jest.Mock).mockClear();
  });

  it('still returns the record id and farm id from the submission', async () => {
    const out = await save(makeFarm({ id: 42 }), 'irrigation', { duration: 5 });
    expect(out.recordId).toBe(123);
    expect(out.farmId).toBe(42);
  });
});
