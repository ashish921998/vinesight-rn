/**
 * Circuit Breaker – Prevents cascading failures by backing off after
 * repeated errors and auto-resuming after a cooldown period.
 *
 * States:
 *   CLOSED   → Normal operation, requests pass through.
 *   OPEN     → Too many failures; requests are rejected immediately.
 *   HALF_OPEN → Cooldown elapsed; allow a single probe request.
 *
 * Phase 8 of offline functionality.
 */

import { logOfflineEvent } from './offline-logger';

// ── Types ──────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit. Default: 5 */
  failureThreshold?: number;
  /** Cooldown period in ms before transitioning to half-open. Default: 60_000 (1 min) */
  cooldownMs?: number;
  /** Name for logging/debugging. */
  name?: string;
}

export interface CircuitBreakerSnapshot {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
}

// ── Implementation ─────────────────────────────────────────────────

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private lastFailureAt: number | null = null;
  private lastSuccessAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly name: string;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.cooldownMs = config.cooldownMs ?? 60_000;
    this.name = config.name ?? 'default';
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws if the circuit is open and cooldown hasn't elapsed.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldTransitionToHalfOpen()) {
        this.state = 'half_open';
        logOfflineEvent('circuit_breaker_half_open', { breaker: this.name });
      } else {
        throw new CircuitBreakerOpenError(this.name, this.remainingCooldownMs());
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check whether a request would be allowed without actually executing it.
   */
  canExecute(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'half_open') return true;
    return this.shouldTransitionToHalfOpen();
  }

  /**
   * Get a snapshot of the current circuit state.
   */
  getSnapshot(): CircuitBreakerSnapshot {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
    };
  }

  /**
   * Manually reset the circuit to closed state.
   */
  reset(): void {
    this.state = 'closed';
    this.consecutiveFailures = 0;
    logOfflineEvent('circuit_breaker_closed', { breaker: this.name, reason: 'manual_reset' });
  }

  // ── Private ────────────────────────────────────────────────────

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.lastSuccessAt = Date.now();

    if (this.state !== 'closed') {
      this.state = 'closed';
      logOfflineEvent('circuit_breaker_closed', { breaker: this.name });
    }
  }

  private onFailure(): void {
    this.consecutiveFailures += 1;
    this.lastFailureAt = Date.now();

    if (this.state === 'half_open' || this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'open';
      logOfflineEvent('circuit_breaker_opened', {
        breaker: this.name,
        consecutiveFailures: this.consecutiveFailures,
      });
    }
  }

  private shouldTransitionToHalfOpen(): boolean {
    if (this.state !== 'open' || this.lastFailureAt === null) return false;
    return Date.now() - this.lastFailureAt >= this.cooldownMs;
  }

  private remainingCooldownMs(): number {
    if (this.lastFailureAt === null) return 0;
    return Math.max(0, this.cooldownMs - (Date.now() - this.lastFailureAt));
  }
}

// ── Error class ────────────────────────────────────────────────────

export class CircuitBreakerOpenError extends Error {
  readonly remainingMs: number;
  readonly breakerName: string;

  constructor(name: string, remainingMs: number) {
    super(`Circuit breaker "${name}" is open. Retry in ${Math.ceil(remainingMs / 1000)}s.`);
    this.name = 'CircuitBreakerOpenError';
    this.breakerName = name;
    this.remainingMs = remainingMs;
  }
}

// ── Shared instances ───────────────────────────────────────────────

/** Circuit breaker for the sync queue replay. */
export const syncCircuitBreaker = new CircuitBreaker({
  name: 'sync-queue',
  failureThreshold: 5,
  cooldownMs: 60_000, // 1 minute
});

/** Circuit breaker for media uploads. */
export const mediaUploadCircuitBreaker = new CircuitBreaker({
  name: 'media-upload',
  failureThreshold: 3,
  cooldownMs: 120_000, // 2 minutes
});

/** Circuit breaker for background sync tasks. */
export const backgroundSyncCircuitBreaker = new CircuitBreaker({
  name: 'background-sync',
  failureThreshold: 3,
  cooldownMs: 300_000, // 5 minutes
});
