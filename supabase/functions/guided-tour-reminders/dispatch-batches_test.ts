import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { authorizeDispatchBatches } from './dispatch-batches.ts';

Deno.test('authorizes a user once before batching all of their devices', async () => {
  const pushes = Array.from({ length: 150 }, (_, index) => ({
    userId: 'user-1',
    token: `token-${index}`,
  }));
  let authorizationCalls = 0;

  const result = await authorizeDispatchBatches(pushes, 100, async (candidates) => {
    authorizationCalls += 1;
    assertEquals(candidates.length, 150);
    assertEquals(new Set(candidates.map((push) => push.userId)).size, 1);
    return candidates;
  });

  assertEquals(authorizationCalls, 1);
  assertEquals(
    result.batches.map((batch) => batch.length),
    [100, 50],
  );
  assertEquals(
    result.batches.flat().map((push) => push.token),
    pushes.map((push) => push.token),
  );
  assertEquals(result.skippedUserIds.size, 0);
});

Deno.test('keeps every device for authorized users and counts rejected users once', async () => {
  const pushes = [
    { userId: 'authorized-user', token: 'authorized-token' },
    { userId: 'rejected-user', token: 'rejected-token-1' },
    { userId: 'rejected-user', token: 'rejected-token-2' },
  ];

  const result = await authorizeDispatchBatches(pushes, 100, async (candidates) =>
    candidates.filter((push) => push.userId === 'authorized-user'),
  );

  assertEquals(result.batches, [[pushes[0]]]);
  assertEquals([...result.skippedUserIds], ['rejected-user']);
});

Deno.test('does not authorize an empty push list', async () => {
  let authorizationCalls = 0;
  const result = await authorizeDispatchBatches([], 100, async (candidates) => {
    authorizationCalls += 1;
    return candidates;
  });

  assertEquals(authorizationCalls, 0);
  assertEquals(result.batches, []);
  assertEquals(result.skippedUserIds.size, 0);
});
