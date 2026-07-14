import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { resolveOrCreateSeasonIdForDate } from '@/lib/season-context';
import { isClientUuid } from '@/features/offline/client-id';
import { queryKeys } from '@/hooks/query-keys';
import { makeChain } from '../jest-setup/supabase-chain-mock';
import {
  useCreateIrrigationRecord,
  useUpdateIrrigationRecord,
  useDeleteIrrigationRecord,
  useCreateSprayRecord,
  useCreateFertigationRecord,
  useCreateHarvestRecord,
  useCreateExpenseRecord,
} from '@/hooks/use-records';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/lib/season-context', () => ({ resolveOrCreateSeasonIdForDate: jest.fn() }));

const mockedFrom = supabase.from as jest.Mock;
const mockedResolveSeason = resolveOrCreateSeasonIdForDate as jest.Mock;

function setup(mutationRetry: false | number = false) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: mutationRetry, retryDelay: 0 },
    },
  });
  const invalidateSpy = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { invalidateSpy, wrapper };
}

const irrigationInsert = {
  farm_id: 7,
  date: '2026-06-01',
  duration: 2,
  area: 1,
  growth_stage: '',
  moisture_status: '',
  system_discharge: 0,
};

beforeEach(() => {
  mockedFrom.mockReset();
  mockedResolveSeason.mockReset();
});

describe('factory create hook (irrigation)', () => {
  it('resolves season, attaches client_uuid, and upserts DO NOTHING on client_uuid', async () => {
    mockedResolveSeason.mockResolvedValue(123);
    const { chain, calls } = makeChain({ data: { id: 1, farm_id: 7 }, error: null });
    mockedFrom.mockReturnValue(chain);
    const { wrapper } = setup();

    const { result } = renderHook(() => useCreateIrrigationRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(irrigationInsert);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedResolveSeason).toHaveBeenCalledWith({ farmId: 7, date: '2026-06-01' });
    const [payload, opts] = calls.upsertArgs!;
    expect(payload.season_id).toBe(123);
    expect(isClientUuid(payload.client_uuid as string)).toBe(true);
    expect(opts).toEqual({ onConflict: 'client_uuid', ignoreDuplicates: true });
  });

  it('preserves a caller-supplied client_uuid', async () => {
    mockedResolveSeason.mockResolvedValue(123);
    const { chain, calls } = makeChain({ data: { id: 1, farm_id: 7 }, error: null });
    mockedFrom.mockReturnValue(chain);
    const { wrapper } = setup();

    const { result } = renderHook(() => useCreateIrrigationRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        ...irrigationInsert,
        client_uuid: 'caller-uuid',
      });
    });

    expect(calls.upsertArgs![0].client_uuid).toBe('caller-uuid');
  });

  it('reuses the same generated client_uuid across React Query mutation retries', async () => {
    mockedResolveSeason.mockResolvedValue(123);
    const payloads: Array<Record<string, unknown>> = [];
    mockedFrom.mockImplementation(() => {
      const attempt = payloads.length;
      const { chain, calls } = makeChain(
        attempt === 0
          ? { data: null, error: new Error('response lost after insert') }
          : { data: { id: 1, farm_id: 7 }, error: null },
      );
      (chain.upsert as jest.Mock).mockImplementation(
        (payload: Record<string, unknown>, opts: unknown) => {
          payloads.push(payload);
          calls.upsertArgs = [payload, opts];
          return chain;
        },
      );
      return chain;
    });
    const { wrapper } = setup(1);

    const { result } = renderHook(() => useCreateIrrigationRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(irrigationInsert);
    });

    expect(payloads).toHaveLength(2);
    expect(isClientUuid(payloads[0].client_uuid as string)).toBe(true);
    expect(payloads[1].client_uuid).toBe(payloads[0].client_uuid);
  });

  it('invalidates BOTH listByFarm and lists for irrigation (invalidateListsOnCreate)', async () => {
    mockedResolveSeason.mockResolvedValue(null);
    mockedFrom.mockReturnValue(makeChain({ data: { id: 1, farm_id: 7 }, error: null }).chain);
    const { invalidateSpy, wrapper } = setup();

    const { result } = renderHook(() => useCreateIrrigationRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(irrigationInsert);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, {
      queryKey: queryKeys.irrigationRecords.listByFarm(7),
    });
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, {
      queryKey: queryKeys.reports.unassignedRecordCount(7),
    });
    expect(invalidateSpy).toHaveBeenNthCalledWith(3, {
      queryKey: queryKeys.irrigationRecords.lists(),
    });
  });
});

describe('factory create hooks for non-irrigation event tables', () => {
  it.each([
    {
      name: 'spray',
      useCreateHook: useCreateSprayRecord,
      farmId: 9,
      input: {
        farm_id: 9,
        date: '2026-06-01',
        chemical: 'x',
        dose: 'y',
        area: 1,
        weather: '',
        operator: '',
      },
      listByFarmKey: queryKeys.sprayRecords.listByFarm(9),
    },
    {
      name: 'fertigation',
      useCreateHook: useCreateFertigationRecord,
      farmId: 10,
      input: {
        farm_id: 10,
        date: '2026-06-01',
        fertilizer_type: 'NPK',
        quantity: 1,
        area: 1,
      },
      listByFarmKey: queryKeys.fertigationRecords.listByFarm(10),
    },
    {
      name: 'harvest',
      useCreateHook: useCreateHarvestRecord,
      farmId: 11,
      input: {
        farm_id: 11,
        date: '2026-06-01',
        crop: 'grapes',
        quantity: 1,
        quality_grade: 'A',
      },
      listByFarmKey: queryKeys.harvestRecords.listByFarm(11),
    },
    {
      name: 'expense',
      useCreateHook: useCreateExpenseRecord,
      farmId: 12,
      input: {
        farm_id: 12,
        date: '2026-06-01',
        category: 'labor',
        amount: 100,
        description: 'x',
      },
      listByFarmKey: queryKeys.expenseRecords.listByFarm(12),
    },
  ])('invalidates listByFarm + unassigned count (not lists) for $name', async (testCase) => {
    mockedResolveSeason.mockResolvedValue(null);
    mockedFrom.mockReturnValue(
      makeChain({ data: { id: 2, farm_id: testCase.farmId }, error: null }).chain,
    );
    const { invalidateSpy, wrapper } = setup();

    const { result } = renderHook(() => testCase.useCreateHook(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(testCase.input as never);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: testCase.listByFarmKey });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.reports.unassignedRecordCount(testCase.farmId),
    });
  });
});

describe('factory update + delete hooks (irrigation)', () => {
  it('updates by id and invalidates listByFarm', async () => {
    const { chain, calls } = makeChain({ data: { id: 5, farm_id: 7 }, error: null });
    mockedFrom.mockReturnValue(chain);
    const { invalidateSpy, wrapper } = setup();

    const { result } = renderHook(() => useUpdateIrrigationRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 5, updates: { duration: 9 } });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls.updatePatch).toEqual({ duration: 9 });
    expect(calls.eqCalls).toContainEqual(['id', 5]);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.irrigationRecords.listByFarm(7),
    });
  });

  it('updates by client UUID when the server id is unavailable', async () => {
    const clientUuid = '76543210-4321-4abc-8def-123456789abc';
    const { chain, calls } = makeChain({ data: { farm_id: 7 }, error: null });
    mockedFrom.mockReturnValue(chain);
    const { wrapper } = setup();

    const { result } = renderHook(() => useUpdateIrrigationRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ clientUuid, farmId: 7, updates: { duration: 9 } });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls.eqCalls).toContainEqual(['client_uuid', clientUuid]);
    expect(calls.eqCalls).toContainEqual(['farm_id', 7]);
  });

  it('deletes by id and invalidates listByFarm(farmId)', async () => {
    const { chain, calls } = makeChain({ error: null });
    mockedFrom.mockReturnValue(chain);
    const { invalidateSpy, wrapper } = setup();

    const { result } = renderHook(() => useDeleteIrrigationRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 8, farmId: 7 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls.eqCalls).toContainEqual(['id', 8]);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.irrigationRecords.listByFarm(7),
    });
  });

  it('deletes by client UUID when the server id is unavailable', async () => {
    const clientUuid = '76543210-4321-4abc-8def-123456789abc';
    const { chain, calls } = makeChain({ error: null });
    mockedFrom.mockReturnValue(chain);
    const { wrapper } = setup();

    const { result } = renderHook(() => useDeleteIrrigationRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ clientUuid, farmId: 7 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls.eqCalls).toContainEqual(['client_uuid', clientUuid]);
    expect(calls.eqCalls).toContainEqual(['farm_id', 7]);
  });
});
