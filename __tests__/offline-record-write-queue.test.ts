import type { QueryClient } from '@tanstack/react-query';

import {
  compactPausedRecordWriteMutations,
  flushPausedRecordWriteMutations,
  resetRecordWriteFlushState,
} from '@/features/offline/record-write-queue';

type FakeMutation = {
  options: { mutationKey: readonly unknown[] };
  state: {
    variables: Record<string, unknown>;
    isPaused: boolean;
    status?: string;
    submittedAt?: number;
  };
};

function createMutation(
  table: string,
  operation: 'create' | 'update' | 'delete',
  variables: Record<string, unknown>,
  submittedAt?: number,
): FakeMutation {
  return {
    options: { mutationKey: ['record-write', table, operation] },
    state: { variables, isPaused: true, submittedAt },
  };
}

function createQueryClient(mutations: FakeMutation[]) {
  const removed: FakeMutation[] = [];
  const built: FakeMutation[] = [];
  const mutationCache = {
    getAll: () => [...mutations.filter((mutation) => !removed.includes(mutation)), ...built],
    remove: (mutation: FakeMutation) => removed.push(mutation),
    build: (
      _queryClient: QueryClient,
      options: { mutationKey: readonly unknown[] },
      state: FakeMutation['state'],
    ) => {
      const mutation = { options, state };
      built.push(mutation);
      return mutation;
    },
  };
  return {
    queryClient: { getMutationCache: () => mutationCache } as unknown as QueryClient,
    removed,
    built,
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
    const { queryClient, removed, built } = createQueryClient([create, update]);

    compactPausedRecordWriteMutations(queryClient);

    expect(built).toHaveLength(1);
    expect(built[0].state.variables).toMatchObject({ duration: 9, note: 'adjusted' });
    expect(removed).toEqual([create, update]);
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
    const { queryClient, removed, built } = createQueryClient([create, del]);

    compactPausedRecordWriteMutations(queryClient);

    expect(removed).toEqual([create, del]);
    expect(built).toEqual([]);
  });

  it('preserves unrelated singleton paused mutations', () => {
    const create = createMutation('irrigation_records', 'create', {
      farm_id: 7,
      date: '2026-07-14',
      client_uuid: '12345678-1234-4abc-8def-123456789abc',
      duration: 2,
    });
    const update = createMutation('irrigation_records', 'update', {
      clientUuid: '12345678-1234-4abc-8def-123456789abc',
      farmId: 7,
      updates: { duration: 9 },
    });
    const unrelated = createMutation('spray_records', 'delete', {
      id: 42,
      farmId: 7,
    });
    const { queryClient, removed, built } = createQueryClient([create, update, unrelated]);

    compactPausedRecordWriteMutations(queryClient);

    expect(built).toHaveLength(1);
    expect(removed).toEqual([create, update]);
    expect(queryClient.getMutationCache().getAll()).toContain(unrelated);
  });
});

describe('flushPausedRecordWriteMutations', () => {
  it('compacts once and batches invalidation when concurrent resume signals arrive', async () => {
    const create = createMutation('irrigation_records', 'create', {
      farm_id: 7,
      date: '2026-07-14',
      client_uuid: '12345678-1234-4abc-8def-123456789abc',
      duration: 2,
    });
    const update = createMutation('irrigation_records', 'update', {
      clientUuid: '12345678-1234-4abc-8def-123456789abc',
      farmId: 7,
      updates: { duration: 9 },
    });
    const { queryClient, removed, built } = createQueryClient([create, update]);
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    Object.assign(queryClient, { invalidateQueries });
    let releaseResume: (() => void) | undefined;
    const resumePausedMutations = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseResume = resolve;
        }),
    );

    const firstFlush = flushPausedRecordWriteMutations(queryClient, resumePausedMutations);
    const secondFlush = flushPausedRecordWriteMutations(queryClient, resumePausedMutations);

    expect(secondFlush).toBe(firstFlush);
    expect(resumePausedMutations).toHaveBeenCalledTimes(1);
    expect(removed).toEqual([create, update]);
    built[0].state.isPaused = false;
    built[0].state.status = 'success';
    releaseResume?.();
    await firstFlush;

    expect(built[0].state.variables).toMatchObject({ duration: 9 });
    expect(invalidateQueries).toHaveBeenCalledTimes(6);
  });

  it('skips batch invalidation when a resumed record write fails', async () => {
    const create = createMutation('irrigation_records', 'create', {
      farm_id: 7,
      date: '2026-07-14',
      client_uuid: '12345678-1234-4abc-8def-123456789abc',
    });
    const { queryClient, built } = createQueryClient([
      create,
      createMutation('irrigation_records', 'update', {
        clientUuid: '12345678-1234-4abc-8def-123456789abc',
        farmId: 7,
        updates: { duration: 9 },
      }),
    ]);
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    Object.assign(queryClient, { invalidateQueries });
    const resumePausedMutations = jest.fn(async () => {
      built[0].state.isPaused = false;
      built[0].state.status = 'error';
    });

    await flushPausedRecordWriteMutations(queryClient, resumePausedMutations);

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('skips batch invalidation when a resumed record write is paused again', async () => {
    const create = createMutation('irrigation_records', 'create', {
      farm_id: 7,
      date: '2026-07-14',
      client_uuid: '12345678-1234-4abc-8def-123456789abc',
    });
    const { queryClient } = createQueryClient([create]);
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    Object.assign(queryClient, { invalidateQueries });
    const resumePausedMutations = jest.fn(async () => {
      create.state.isPaused = false;
      create.state.status = 'pending';
      create.state.isPaused = true;
    });

    await flushPausedRecordWriteMutations(queryClient, resumePausedMutations);

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('does not invalidate after a flush is reset for another account', async () => {
    const create = createMutation('irrigation_records', 'create', {
      farm_id: 7,
      date: '2026-07-14',
      client_uuid: '12345678-1234-4abc-8def-123456789abc',
    });
    const { queryClient } = createQueryClient([create]);
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    Object.assign(queryClient, { invalidateQueries });
    let releaseResume: (() => void) | undefined;
    const resumePausedMutations = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseResume = resolve;
        }),
    );

    const flush = flushPausedRecordWriteMutations(queryClient, resumePausedMutations);
    resetRecordWriteFlushState();
    releaseResume?.();
    await flush;

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('re-queues an errored write as a fresh paused mutation so it replays', async () => {
    const errored: FakeMutation = {
      options: { mutationKey: ['record-write', 'irrigation_records', 'create'] },
      state: {
        variables: {
          farm_id: 7,
          date: '2026-07-14',
          client_uuid: '12345678-1234-4abc-8def-123456789abc',
        },
        isPaused: false,
        status: 'error',
      },
    };
    const { queryClient, built, removed } = createQueryClient([errored]);
    Object.assign(queryClient, { invalidateQueries: jest.fn().mockResolvedValue(undefined) });
    const resumePausedMutations = jest.fn().mockResolvedValue(undefined);

    await flushPausedRecordWriteMutations(queryClient, resumePausedMutations);

    expect(removed).toContain(errored);
    expect(built).toHaveLength(1);
    expect(built[0].state).toMatchObject({ isPaused: true, status: 'pending' });
    expect(built[0].state.variables.client_uuid).toBe('12345678-1234-4abc-8def-123456789abc');
  });

  it('folds a requeued errored create ahead of a later offline edit (submission order)', async () => {
    // Errored create was submitted first; the offline edit came after. Requeue
    // rebuilds the create at the cache tail, so only submittedAt preserves order.
    const erroredCreate: FakeMutation = {
      options: { mutationKey: ['record-write', 'irrigation_records', 'create'] },
      state: {
        variables: {
          farm_id: 7,
          date: '2026-07-14',
          client_uuid: '12345678-1234-4abc-8def-123456789abc',
          duration: 2,
        },
        isPaused: false,
        status: 'error',
        submittedAt: 1,
      },
    };
    const pausedEdit = createMutation(
      'irrigation_records',
      'update',
      {
        clientUuid: '12345678-1234-4abc-8def-123456789abc',
        farmId: 7,
        updates: { duration: 9, note: 'adjusted' },
      },
      2,
    );
    const { queryClient, built } = createQueryClient([erroredCreate, pausedEdit]);
    Object.assign(queryClient, { invalidateQueries: jest.fn().mockResolvedValue(undefined) });
    const resumePausedMutations = jest.fn().mockResolvedValue(undefined);

    await flushPausedRecordWriteMutations(queryClient, resumePausedMutations);

    // Both writes collapse to a single create carrying the edit's fields — not a
    // create that clobbered the edit because it was folded last. The compacted
    // op is the last create rebuilt (after the requeue rebuild).
    const finalCreate = built.filter((m) => m.options.mutationKey[2] === 'create').at(-1);
    expect(finalCreate).toBeDefined();
    expect(finalCreate!.state.variables).toMatchObject({ duration: 9, note: 'adjusted' });
  });

  it('resumes an empty paused queue without invalidating queries', async () => {
    const { queryClient } = createQueryClient([]);
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    Object.assign(queryClient, { invalidateQueries });
    const resumePausedMutations = jest.fn().mockResolvedValue(undefined);

    await flushPausedRecordWriteMutations(queryClient, resumePausedMutations);

    expect(resumePausedMutations).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
