import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useSaveSingleLog } from '@/features/entry-log-session/use-save-single-log';
import { submitEntryPendingLog } from '@/utils/entry-log-submission';
import type { Farm } from '@/types';
import type { AreaUnitPreference } from '@/utils/preferences';

/**
 * The receipt screen undoes a removed irrigation by subtracting the saved
 * `waterDelta` from the *live* tank level. That only stays correct if the hook's
 * precomputed delta exactly equals the clamp `submitEntryPendingLog` actually
 * applies. These tests pin that math (capacity clamp, duration fallback, and the
 * non-irrigation / no-capacity no-op) so the save and undo paths can't drift apart.
 */

// Boundary mock: the real submission writes to the DB; we only care that the hook
// returns the delta it computed before submitting, so resolve with a fixed record.
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

describe('useSaveSingleLog — waterDelta', () => {
  beforeEach(() => {
    (submitEntryPendingLog as jest.Mock).mockClear();
  });

  it('returns the amount added (after − before) for a tank-capacity irrigation', async () => {
    // before=100, +duration(5)*discharge(10)=50, after=min(1000,150)=150 → delta 50
    const out = await save(makeFarm({}), 'irrigation', { duration: 5 });
    expect(out.waterDelta).toBe(50);
  });

  it('clamps the delta at tank capacity (never overfills)', async () => {
    // before=990, +50 would be 1040, clamps to 1000 → delta is only 10, not 50
    const out = await save(
      makeFarm({ remaining_water: 990, total_tank_capacity: 1000, system_discharge: 10 }),
      'irrigation',
      { duration: 5 },
    );
    expect(out.waterDelta).toBe(10);
  });

  it('treats a missing duration as 0 (delta 0, not NaN)', async () => {
    const out = await save(makeFarm({}), 'irrigation', {});
    expect(out.waterDelta).toBe(0);
  });

  it('leaves waterDelta undefined when the farm has no tank capacity', async () => {
    const out = await save(
      makeFarm({ total_tank_capacity: 0, system_discharge: 0 }),
      'irrigation',
      { duration: 5 },
    );
    expect(out.waterDelta).toBeUndefined();
  });

  it('leaves waterDelta undefined for non-irrigation entries', async () => {
    const out = await save(makeFarm({}), 'expense', { type: 'Fuel', cost: 500 });
    expect(out.waterDelta).toBeUndefined();
  });

  it('still returns the record id and farm id from the submission', async () => {
    const out = await save(makeFarm({ id: 42 }), 'irrigation', { duration: 5 });
    expect(out.recordId).toBe(123);
    expect(out.farmId).toBe(42);
  });
});
