import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { isExpoPushToken, timingSafeSecretEqual } from './request-validation.ts';

Deno.test('compares reminder job secrets', async () => {
  assertEquals(await timingSafeSecretEqual('same-secret', 'same-secret'), true);
  assertEquals(await timingSafeSecretEqual('wrong-secret', 'same-secret'), false);
});

Deno.test('accepts Expo push token formats supported by the Expo server SDK', () => {
  assertEquals(isExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'), true);
  assertEquals(isExpoPushToken('ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]'), true);
  assertEquals(isExpoPushToken('12345678-1234-1234-1234-123456789abc'), true);
});

Deno.test('rejects malformed or oversized Expo push tokens', () => {
  assertEquals(isExpoPushToken(''), false);
  assertEquals(isExpoPushToken('not-a-push-token'), false);
  assertEquals(isExpoPushToken('ExpoPushToken[]'), false);
  assertEquals(isExpoPushToken('ExpoPushToken[token with spaces]'), false);
  assertEquals(isExpoPushToken('ExpoPushToken[invalid!]'), false);
  assertEquals(isExpoPushToken('zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz'), false);
  assertEquals(isExpoPushToken(`ExpoPushToken[${'x'.repeat(512)}]`), false);
});
