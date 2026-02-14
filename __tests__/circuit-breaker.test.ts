/**
 * Circuit Breaker Tests
 *
 * Verifies the circuit breaker pattern: closed → open → half-open → closed
 * transitions, failure thresholds, and cooldown behaviour.
 */

import { CircuitBreaker, CircuitBreakerOpenError } from '../src/services/circuit-breaker';

// Suppress __DEV__ console output in tests
beforeAll(() => {
  // @ts-expect-error – __DEV__ is a global in RN
  global.__DEV__ = false;
});

describe('CircuitBreaker', () => {
  it('starts in closed state', () => {
    const cb = new CircuitBreaker({ name: 'test' });
    expect(cb.getSnapshot().state).toBe('closed');
    expect(cb.canExecute()).toBe(true);
  });

  it('stays closed on successful executions', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 3 });

    await cb.execute(async () => 'ok');
    await cb.execute(async () => 'ok');

    expect(cb.getSnapshot().state).toBe('closed');
    expect(cb.getSnapshot().consecutiveFailures).toBe(0);
  });

  it('opens after reaching failure threshold', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 3, cooldownMs: 60_000 });

    for (let i = 0; i < 3; i++) {
      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    }

    expect(cb.getSnapshot().state).toBe('open');
    expect(cb.getSnapshot().consecutiveFailures).toBe(3);
  });

  it('rejects requests when open', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 2, cooldownMs: 60_000 });

    // Trip the breaker
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});

    expect(cb.getSnapshot().state).toBe('open');

    // Should throw CircuitBreakerOpenError
    await expect(cb.execute(async () => 'ok')).rejects.toThrow(CircuitBreakerOpenError);
    expect(cb.canExecute()).toBe(false);
  });

  it('transitions to half-open after cooldown', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 2, cooldownMs: 50 });

    // Trip the breaker
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});

    expect(cb.getSnapshot().state).toBe('open');

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 60));

    // Should allow execution (half-open)
    expect(cb.canExecute()).toBe(true);
    const result = await cb.execute(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(cb.getSnapshot().state).toBe('closed');
  });

  it('re-opens on failure in half-open state', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 2, cooldownMs: 50 });

    // Trip the breaker
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 60));

    // Fail again in half-open
    await cb.execute(async () => { throw new Error('still failing'); }).catch(() => {});

    expect(cb.getSnapshot().state).toBe('open');
  });

  it('resets manually', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 2, cooldownMs: 60_000 });

    // Trip the breaker
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});

    expect(cb.getSnapshot().state).toBe('open');

    cb.reset();
    expect(cb.getSnapshot().state).toBe('closed');
    expect(cb.getSnapshot().consecutiveFailures).toBe(0);
    expect(cb.canExecute()).toBe(true);
  });

  it('resets consecutive failures on success', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 5 });

    // Some failures (not enough to trip)
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    expect(cb.getSnapshot().consecutiveFailures).toBe(2);

    // Success resets counter
    await cb.execute(async () => 'ok');
    expect(cb.getSnapshot().consecutiveFailures).toBe(0);
    expect(cb.getSnapshot().state).toBe('closed');
  });
});
