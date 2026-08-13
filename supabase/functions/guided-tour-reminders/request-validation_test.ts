import { isExpoPushToken, timingSafeSecretEqual } from './request-validation.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test('compares reminder job secrets without direct string equality', async () => {
  assert(await timingSafeSecretEqual('same-secret', 'same-secret'), 'equal secrets must match');
  assert(
    !(await timingSafeSecretEqual('wrong-secret', 'same-secret')),
    'different secrets must not match',
  );
});

Deno.test('accepts Expo push token formats supported by the Expo server SDK', () => {
  assert(isExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'), 'legacy token must pass');
  assert(isExpoPushToken('ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]'), 'current token must pass');
  assert(isExpoPushToken('12345678-1234-1234-1234-123456789abc'), 'UUID token must pass');
});

Deno.test('rejects malformed or oversized Expo push tokens', () => {
  assert(!isExpoPushToken(''), 'empty token must fail');
  assert(!isExpoPushToken('not-a-push-token'), 'malformed token must fail');
  assert(!isExpoPushToken('ExpoPushToken[token with spaces]'), 'whitespace must fail');
  assert(!isExpoPushToken(`ExpoPushToken[${'x'.repeat(512)}]`), 'oversized token must fail');
});
