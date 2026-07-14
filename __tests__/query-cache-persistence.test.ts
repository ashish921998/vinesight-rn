import {
  createQueryPersister,
  persistQueryCacheForUser,
  queryClient,
  queryDehydrateOptions,
  removeQueryCacheForUser,
} from '@/lib/query-cache';

describe('query cache persistence filters', () => {
  it('persists every unsynced record-write mutation, drops only successes', () => {
    // Paused (offline), in-flight, and retry-exhausted writes are all still unsynced.
    for (const status of ['pending', 'error']) {
      expect(
        queryDehydrateOptions.shouldDehydrateMutation({
          options: { mutationKey: ['record-write', 'irrigation_records', 'create'] },
          state: { status },
        }),
      ).toBe(true);
    }
    expect(
      queryDehydrateOptions.shouldDehydrateMutation({
        options: { mutationKey: ['record-write', 'irrigation_records', 'create'] },
        state: { status: 'success' },
      }),
    ).toBe(false);
    expect(
      queryDehydrateOptions.shouldDehydrateMutation({
        options: { mutationKey: ['other-write'] },
        state: { status: 'pending' },
      }),
    ).toBe(false);
  });

  it('persists only successful allowlisted queries', () => {
    expect(
      queryDehydrateOptions.shouldDehydrateQuery({
        queryKey: ['irrigationRecords', 'list'],
        state: { status: 'success' },
      }),
    ).toBe(true);
    expect(
      queryDehydrateOptions.shouldDehydrateQuery({
        queryKey: ['irrigationRecords', 'list'],
        state: { status: 'error' },
      }),
    ).toBe(false);
    expect(
      queryDehydrateOptions.shouldDehydrateQuery({
        queryKey: ['profile'],
        state: { status: 'success' },
      }),
    ).toBe(false);
  });

  it('parks paused writes under the signed-out user before clearing memory', async () => {
    const userId = 'offline-user';
    queryClient.getMutationCache().build(
      queryClient,
      { mutationKey: ['record-write', 'irrigation_records', 'create'] },
      {
        context: undefined,
        data: undefined,
        error: null,
        failureCount: 0,
        failureReason: null,
        isPaused: true,
        status: 'pending',
        submittedAt: Date.now(),
        variables: {
          farm_id: 7,
          date: '2026-07-14',
          client_uuid: '12345678-1234-4abc-8def-123456789abc',
        },
      },
    );

    await persistQueryCacheForUser(userId);
    queryClient.clear();

    const parked = await createQueryPersister(userId).restoreClient();
    expect(parked?.clientState.mutations).toHaveLength(1);

    await removeQueryCacheForUser(userId);
    queryClient.clear();
  });

  it('removes a stale parked cache when there are no paused writes to preserve', async () => {
    const userId = 'offline-user-with-no-writes';
    const persister = createQueryPersister(userId);
    await persister.persistClient({
      buster: '',
      timestamp: Date.now(),
      clientState: { mutations: [], queries: [] },
    });

    await persistQueryCacheForUser(userId);

    await expect(persister.restoreClient()).resolves.toBeUndefined();
  });
});
