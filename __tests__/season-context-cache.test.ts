const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/data-access', () => ({
  getDataAccess: jest.fn(() => ({ rpc: mockRpc, from: mockFrom })),
}));

import {
  resolveSeasonIdForDate,
  resolveOptionalSeasonIdForDate,
  invalidateSeasonIdCache,
} from '@/lib/season-context';
/**
 * Chainable mock for `supabase.from(table).select(cols).eq(col, val).order(col, opts)`.
 * The `.order(...)` terminal is thenable so `await`-ing the chain resolves to `result`.
 * This is the table-scan fallback path used when the RPC misses.
 */
function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => Promise.resolve(result));
  return chain;
}

describe('season-context season id cache', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
    // Each test starts from a clean cache so ordering between tests can't leak.
    invalidateSeasonIdCache();
  });

  it('caches the RPC result so a repeat resolve for the same farm+date skips the network', async () => {
    mockRpc.mockResolvedValue({ data: 10, error: null });

    const first = await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });
    const second = await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });

    expect(first).toBe(10);
    expect(second).toBe(10);
    // The whole point of the optimization: only ONE round-trip for two resolves.
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('normalizes Date and ISO-timestamp inputs to the same cache key', async () => {
    mockRpc.mockResolvedValue({ data: 10, error: null });

    await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21T08:30:00.000Z' });
    await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });

    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('does not share cache entries across different dates', async () => {
    mockRpc.mockResolvedValue({ data: 10, error: null });

    await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });
    await resolveSeasonIdForDate({ farmId: 1, date: '2026-07-01' });

    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('does not share cache entries across different farms', async () => {
    mockRpc.mockResolvedValue({ data: 10, error: null });

    await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });
    await resolveSeasonIdForDate({ farmId: 2, date: '2026-06-21' });

    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('invalidateSeasonIdCache(farmId) forces the next resolve to refetch only that farm', async () => {
    mockRpc.mockResolvedValue({ data: 10, error: null });

    await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });
    await resolveSeasonIdForDate({ farmId: 2, date: '2026-06-21' });
    expect(mockRpc).toHaveBeenCalledTimes(2);

    invalidateSeasonIdCache(1);

    // Farm 1 re-queries...
    await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });
    expect(mockRpc).toHaveBeenCalledTimes(3);
    // ...farm 2 is still cached.
    await resolveSeasonIdForDate({ farmId: 2, date: '2026-06-21' });
    expect(mockRpc).toHaveBeenCalledTimes(3);
  });

  it('invalidateSeasonIdCache() with no arg clears every farm', async () => {
    mockRpc.mockResolvedValue({ data: 10, error: null });

    await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });
    await resolveSeasonIdForDate({ farmId: 2, date: '2026-06-21' });
    expect(mockRpc).toHaveBeenCalledTimes(2);

    invalidateSeasonIdCache();

    await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });
    await resolveSeasonIdForDate({ farmId: 2, date: '2026-06-21' });
    expect(mockRpc).toHaveBeenCalledTimes(4);
  });

  it('does not cache a null result, so a later successful resolve still queries', async () => {
    // RPC returns nothing usable and the table-scan finds no matching window.
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(makeSelectChain({ data: [], error: null }));

    const miss = await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });
    expect(miss).toBeNull();

    // A season now exists — the next resolve must NOT be short-circuited by a cached null.
    mockRpc.mockResolvedValue({ data: 55, error: null });
    const hit = await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });
    expect(hit).toBe(55);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('caches the table-scan fallback result when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('rpc missing') });
    mockFrom.mockReturnValue(
      makeSelectChain({
        data: [{ id: 99, start_date: '2026-01-01', end_date: null }],
        error: null,
      }),
    );

    const first = await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });
    const second = await resolveSeasonIdForDate({ farmId: 1, date: '2026-06-21' });

    expect(first).toBe(99);
    expect(second).toBe(99);
    // Fallback ran once; the cache served the second call.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('resolveOptionalSeasonIdForDate swallows a missing-table error and returns null', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '42P01' } });
    mockFrom.mockReturnValue(makeSelectChain({ data: null, error: { code: '42P01' } }));

    await expect(
      resolveOptionalSeasonIdForDate({ farmId: 1, date: '2026-06-21' }),
    ).resolves.toBeNull();
  });
});
