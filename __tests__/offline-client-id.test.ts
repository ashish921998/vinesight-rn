import { newClientUuid, isClientUuid } from '@/features/offline/client-id';

describe('newClientUuid', () => {
  it('produces a well-formed RFC-4122 v4 UUID', () => {
    expect(isClientUuid(newClientUuid())).toBe(true);
  });

  it('sets version 4 and a valid variant nibble', () => {
    const u = newClientUuid();
    expect(u[14]).toBe('4');
    expect(['8', '9', 'a', 'b']).toContain(u[19].toLowerCase());
  });

  it('is collision-free across many draws', () => {
    const draws = Array.from({ length: 10000 }, () => newClientUuid());
    expect(new Set(draws).size).toBe(draws.length);
  });
});

describe('isClientUuid', () => {
  it('accepts a freshly generated id', () => {
    expect(isClientUuid(newClientUuid())).toBe(true);
  });

  it('rejects malformed or non-string values', () => {
    expect(isClientUuid('nope')).toBe(false);
    expect(isClientUuid(123)).toBe(false);
    expect(isClientUuid(null)).toBe(false);
    expect(isClientUuid(undefined)).toBe(false);
  });

  it('rejects a non-v4 UUID (wrong version)', () => {
    // Valid RFC-4122 but version 1 — must not pass the v4 guard.
    expect(isClientUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(false);
  });
});
