const MAX_SECRET_LENGTH = 4_096;
const MAX_EXPO_PUSH_TOKEN_LENGTH = 512;
const EXPO_PUSH_TOKEN_UUID = /^[a-z\d]{8}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{12}$/i;

export async function timingSafeSecretEqual(provided: string, expected: string): Promise<boolean> {
  if (provided.length > MAX_SECRET_LENGTH || expected.length > MAX_SECRET_LENGTH) return false;

  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const providedBytes = new Uint8Array(providedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;

  for (let index = 0; index < providedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }

  return difference === 0;
}

export function isExpoPushToken(token: unknown): token is string {
  if (typeof token !== 'string' || token.length > MAX_EXPO_PUSH_TOKEN_LENGTH) return false;

  return (
    (((token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) &&
      token.endsWith(']')) ||
      EXPO_PUSH_TOKEN_UUID.test(token)) &&
    !/\s/.test(token)
  );
}
