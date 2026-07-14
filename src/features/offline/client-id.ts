/**
 * Client-generated identity for offline-first activity logs.
 *
 * Each activity-log record created on-device gets a `client_uuid` at capture
 * time, so it owns a stable handle before the server assigns its bigint `id`.
 * The offline write queue uses it to make creates idempotent
 * (`insert ... on conflict (client_uuid) do nothing`) and to target offline
 * edits/deletes of records that have not synced yet.
 *
 * This is a DEDUP handle, not a security token: it must be unique, not
 * unpredictable. We therefore generate an RFC-4122 v4 UUID from `Math.random`
 * instead of adding a native crypto dependency. A unique index on the column
 * turns the astronomically-unlikely collision into a harmless `ON CONFLICT`
 * no-op rather than a duplicate row. If a crypto-strong source is ever needed,
 * replace the body of {@link newClientUuid} with expo-crypto /
 * react-native-get-random-values — call sites do not change.
 */

import * as Crypto from 'expo-crypto';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Generate a fresh RFC-4122 v4 UUID string for a new offline record. */
export function newClientUuid(): string {
  const uuid = Crypto.randomUUID();
  if (isClientUuid(uuid)) return uuid;

  // Jest's Expo mock does not implement randomUUID. This fallback is only used
  // outside the native Crypto implementation and preserves the v4 contract.
  let out = '';
  for (let index = 0; index < 36; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) out += '-';
    else if (index === 14) out += '4';
    else {
      const randomNibble = (Math.random() * 16) | 0;
      out += (index === 19 ? (randomNibble & 0x3) | 0x8 : randomNibble).toString(16);
    }
  }
  return out;
}

/** Type guard: true only for a well-formed v4 client_uuid string. */
export function isClientUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value);
}
