import { authorizeDispatchBatches } from './dispatch-batches.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test('authorizes a user once before batching all of their devices', async () => {
  const pushes = Array.from({ length: 150 }, (_, index) => ({
    userId: 'user-1',
    token: `token-${index}`,
  }));
  let authorizationCalls = 0;

  const result = await authorizeDispatchBatches(pushes, 100, async (candidates) => {
    authorizationCalls += 1;
    assert(candidates.length === 150, 'authorization must receive every device');
    assert(
      new Set(candidates.map((push) => push.userId)).size === 1,
      'authorization must receive unique user ownership',
    );
    return candidates;
  });

  assert(authorizationCalls === 1, 'authorization must run once');
  assert(result.batches.length === 2, '150 devices must produce two Expo batches');
  assert(result.batches[0].length === 100, 'the first Expo batch must contain 100 devices');
  assert(result.batches[1].length === 50, 'the second Expo batch must contain 50 devices');
  assert(
    result.batches
      .flat()
      .map((push) => push.token)
      .join(',') === pushes.map((push) => push.token).join(','),
    'every authorized device must be preserved in order',
  );
  assert(result.skippedUserIds.size === 0, 'authorized users must not be counted as skipped');
});

Deno.test('does not authorize an empty push list', async () => {
  let authorizationCalls = 0;
  const result = await authorizeDispatchBatches([], 100, async (candidates) => {
    authorizationCalls += 1;
    return candidates;
  });

  assert(authorizationCalls === 0, 'empty input must not call authorization');
  assert(result.batches.length === 0, 'empty input must not create Expo batches');
  assert(result.skippedUserIds.size === 0, 'empty input must not count skipped users');
});
