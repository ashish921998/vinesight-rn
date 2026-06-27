import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { resolveOrCreateSeasonIdForDate } from '@/lib/season-context';
import { isClientUuid } from '@/features/offline/client-id';
import {
  useCreateIrrigationRecord,
  useUpdateIrrigationRecord,
  useDeleteIrrigationRecord,
  useCreateSprayRecord,
} from '@/hooks/use-records';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/lib/season-context', () => ({ resolveOrCreateSeasonIdForDate: jest.fn() }));

const mockedFrom = supabase.from as jest.Mock;
const mockedResolveSeason = resolveOrCreateSeasonIdForDate as jest.Mock;

type Result = { data?: unknown; error?: unknown };

function makeChain(result: Result = { data: null, error: null }) {
  const calls = {
    upsertArgs: undefined as undefined | [Record<string, unknown>, unknown],
    updatePatch: undefined as unknown,
    eqCalls: [] as Array<[string, unknown]>,
  };
  const chain: Record<string, unknown> = {};
  chain.upsert = jest.fn((payload: Record<string, unknown>, opts: unknown) => {
    calls.upsertArgs = [payload, opts];
    return chain;
  });
  chain.update = jest.fn((patch: unknown) => {
    calls.updatePatch = patch;
    return chain;
  });
  chain.delete = jest.fn(() => chain);
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn((col: string, val: unknown) => {
    calls.eqCalls.push([col, val]);
    return chain;
  });
  chain.single = jest.fn(() => Promise.resolve(result));
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  chain.then = (onF: ((v: Result) => unknown) | null, onR?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onF, onR);
  return { chain, calls };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

  it('invalidates BOTH listByFarm and lists for irrigation (invalidateListsOnCreate)', async () => {
    mockedResolveSeason.mockResolvedValue(null);
    mockedFrom.mockReturnValue(makeChain({ data: { id: 1, farm_id: 7 }, error: null }).chain);
    const { invalidateSpy, wrapper } = setup();

    const { result } = renderHook(() => useCreateIrrigationRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(irrigationInsert);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });
});

describe('factory create hook (spray) — no lists() invalidation', () => {
  it('invalidates only listByFarm, matching the prior spray behaviour', async () => {
    mockedResolveSeason.mockResolvedValue(null);
    mockedFrom.mockReturnValue(makeChain({ data: { id: 2, farm_id: 9 }, error: null }).chain);
    const { invalidateSpy, wrapper } = setup();

    const { result } = renderHook(() => useCreateSprayRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        farm_id: 9,
        date: '2026-06-01',
        chemical: 'x',
        dose: 'y',
        area: 1,
        weather: '',
        operator: '',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
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
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
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
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });
});
