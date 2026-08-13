import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { beginDispatchAndBatch } from './dispatch-batches.ts';

Deno.test("begins dispatch once before batching all of a user's devices", async () => {
  const pushes = Array.from({ length: 150 }, (_, index) => ({
    userId: 'user-1',
    token: `token-${index}`,
  }));
  let dispatchCalls = 0;

  const result = await beginDispatchAndBatch(pushes, 100, async (candidates) => {
    dispatchCalls += 1;
    assertEquals(candidates.length, 150);
    assertEquals(new Set(candidates.map((push) => push.userId)).size, 1);
    return candidates;
  });

  assertEquals(dispatchCalls, 1);
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

Deno.test('keeps every device for dispatching users and counts rejected users once', async () => {
  const pushes = [
    { userId: 'authorized-user', token: 'authorized-token' },
    { userId: 'authorized-user', token: 'authorized-token-2' },
    { userId: 'rejected-user', token: 'rejected-token-1' },
    { userId: 'rejected-user', token: 'rejected-token-2' },
  ];

  const result = await beginDispatchAndBatch(pushes, 100, async (candidates) =>
    candidates.filter((push) => push.userId === 'authorized-user'),
  );

  assertEquals(result.batches, [[pushes[0], pushes[1]]]);
  assertEquals([...result.skippedUserIds], ['rejected-user']);
});

Deno.test('does not begin dispatch for an empty push list', async () => {
  let dispatchCalls = 0;
  const result = await beginDispatchAndBatch([], 100, async (candidates) => {
    dispatchCalls += 1;
    return candidates;
  });

  assertEquals(dispatchCalls, 0);
  assertEquals(result.batches, []);
  assertEquals(result.skippedUserIds.size, 0);
});

Deno.test('rejects invalid batch limits before beginning dispatch', async () => {
  for (const batchLimit of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
    let dispatchCalls = 0;

    await assertRejects(
      () =>
        beginDispatchAndBatch([], batchLimit, async (candidates) => {
          dispatchCalls += 1;
          return candidates;
        }),
      RangeError,
      'batchLimit must be a positive safe integer',
    );

    assertEquals(dispatchCalls, 0);
  }
});
