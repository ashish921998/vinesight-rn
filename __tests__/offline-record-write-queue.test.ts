import type { QueryClient } from '@tanstack/react-query';

import { compactPausedRecordWriteMutations } from '@/features/offline/record-write-queue';

type FakeMutation = {
  options: { mutationKey: readonly unknown[] };
  state: { variables: Record<string, unknown>; isPaused: boolean };
};

function createMutation(
  table: string,
  operation: 'create' | 'update' | 'delete',
  variables: Record<string, unknown>,
): FakeMutation {
  return {
    options: { mutationKey: ['record-write', table, operation] },
    state: { variables, isPaused: true },
  };
}

function createQueryClient(mutations: FakeMutation[]) {
  const removed: FakeMutation[] = [];
  const mutationCache = {
    getAll: () => mutations,
    remove: (mutation: FakeMutation) => removed.push(mutation),
  };
  return {
    queryClient: { getMutationCache: () => mutationCache } as unknown as QueryClient,
    removed,
  };
}

describe('compactPausedRecordWriteMutations', () => {
  it('folds an offline create and edit into the retained create mutation', () => {
    const create = createMutation('irrigation_records', 'create', {
      farm_id: 7,
      date: '2026-07-14',
      client_uuid: '12345678-1234-4abc-8def-123456789abc',
      duration: 2,
    });
    const update = createMutation('irrigation_records', 'update', {
      clientUuid: '12345678-1234-4abc-8def-123456789abc',
      farmId: 7,
      updates: { duration: 9, note: 'adjusted' },
    });
    const { queryClient, removed } = createQueryClient([create, update]);

    compactPausedRecordWriteMutations(queryClient);

    expect(create.state.variables).toMatchObject({ duration: 9, note: 'adjusted' });
    expect(removed).toEqual([update]);
  });

  it('removes every mutation for a record created and deleted before sync', () => {
    const create = createMutation('spray_records', 'create', {
      farm_id: 7,
      date: '2026-07-14',
      client_uuid: '76543210-4321-4abc-8def-123456789abc',
    });
    const del = createMutation('spray_records', 'delete', {
      clientUuid: '76543210-4321-4abc-8def-123456789abc',
      farmId: 7,
    });
    const { queryClient, removed } = createQueryClient([create, del]);

    compactPausedRecordWriteMutations(queryClient);

    expect(removed).toEqual([create, del]);
  });
});
