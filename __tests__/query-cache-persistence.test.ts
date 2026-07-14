import {
  createQueryPersister,
  persistQueryCacheForUser,
  queryClient,
  queryDehydrateOptions,
  removeQueryCacheForUser,
} from '@/lib/query-cache';

describe('query cache persistence filters', () => {
  it('persists only paused record-write mutations', () => {
    expect(
      queryDehydrateOptions.shouldDehydrateMutation({
        options: { mutationKey: ['record-write', 'irrigation_records', 'create'] },
        state: { isPaused: true },
      }),
    ).toBe(true);
    expect(
      queryDehydrateOptions.shouldDehydrateMutation({
        options: { mutationKey: ['record-write', 'irrigation_records', 'create'] },
        state: { isPaused: false },
      }),
    ).toBe(false);
    expect(
      queryDehydrateOptions.shouldDehydrateMutation({
        options: { mutationKey: ['other-write'] },
        state: { isPaused: true },
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
    await persistQueryCacheForUser(userId);

    const parked = await createQueryPersister(userId).restoreClient();
    expect(parked?.clientState.mutations).toHaveLength(1);

    await removeQueryCacheForUser(userId);
    queryClient.clear();
  });
});
