/**
 * ErrorRecovery - Error Recovery & Resilience
 * Phase 8.3
 *
 * Provides resilience primitives for offline-first operations:
 * - Exponential backoff with jitter for retrying failed requests
 * - Circuit breaker pattern to avoid hammering failing services
 * - Graceful degradation when storage is full
 * - Corrupted cache data recovery helpers
 */

import type {
  BackoffConfig,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerStatus,
  RetryResult,
} from './types';
import { StorageManager } from './StorageManager';

// ============================================================
// MARK: - Default Configurations
// ============================================================

const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  initialDelayMs: 1_000,
  maxDelayMs: 60_000,
  multiplier: 2,
  jitterMs: 500,
  maxRetries: 5,
};

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenSuccessThreshold: 2,
};

// ============================================================
// MARK: - Exponential Backoff
// ============================================================

/**
 * Calculate the delay for a given retry attempt using exponential
 * backoff with jitter.
 *
 * delay = min(initialDelay * multiplier^attempt, maxDelay) + random(0, jitter)
 */
export function calculateBackoffDelay(attempt: number, config: BackoffConfig = DEFAULT_BACKOFF_CONFIG): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.multiplier, attempt);
  const clampedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = Math.random() * config.jitterMs;
  return Math.round(clampedDelay + jitter);
}

/**
 * Execute an async operation with exponential backoff retries.
 *
 * @param operation - The async function to retry
 * @param config    - Backoff configuration (uses sensible defaults)
 * @returns A RetryResult indicating success/failure and attempt count
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<BackoffConfig> = {},
): Promise<RetryResult<T>> {
  const cfg: BackoffConfig = { ...DEFAULT_BACKOFF_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      const data = await operation();
      return { success: true, data, attempts: attempt + 1 };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < cfg.maxRetries) {
        const delay = calculateBackoffDelay(attempt, cfg);
        if (__DEV__) {
          console.log(
            `[ErrorRecovery] Retry ${attempt + 1}/${cfg.maxRetries} in ${delay}ms – ${lastError.message}`,
          );
        }
        await sleep(delay);
      }
    }
  }

  return { success: false, error: lastError, attempts: cfg.maxRetries + 1 };
}

// ============================================================
// MARK: - Circuit Breaker
// ============================================================

/**
 * Circuit breaker implementation to prevent repeated calls to
 * a failing service.
 *
 * States:
 * - **closed**: requests flow through normally
 * - **open**: requests are immediately rejected
 * - **half-open**: a limited number of probe requests are allowed
 *
 * Usage:
 * ```ts
 * const breaker = new CircuitBreaker('supabase-sync');
 * const result = await breaker.execute(() => syncToServer());
 * ```
 */
export class CircuitBreaker {
  readonly name: string;
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureAt: number | null = null;
  private nextRetryAt: number | null = null;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  /** Get a snapshot of the current circuit breaker status */
  getStatus(): CircuitBreakerStatus {
    // Auto-transition from open → half-open if the reset timeout has elapsed
    this.checkAutoTransition();

    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureAt: this.lastFailureAt ? new Date(this.lastFailureAt).toISOString() : null,
      nextRetryAt: this.nextRetryAt ? new Date(this.nextRetryAt).toISOString() : null,
    };
  }

  /**
   * Execute an operation through the circuit breaker.
   *
   * - If the circuit is **open**, the operation is rejected immediately.
   * - If the circuit is **half-open**, a limited number of probes are allowed.
   * - On success the circuit moves toward **closed**.
   * - On failure the circuit moves toward **open**.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.checkAutoTransition();

    if (this.state === 'open') {
      throw new CircuitBreakerOpenError(
        `[CircuitBreaker:${this.name}] Circuit is open – request rejected. ` +
          `Retry after ${this.nextRetryAt ? new Date(this.nextRetryAt).toISOString() : 'unknown'}`,
      );
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  /** Manually reset the circuit breaker to closed state */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureAt = null;
    this.nextRetryAt = null;
  }

  // ----------------------------------------------------------
  // Internal state transitions
  // ----------------------------------------------------------

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.config.halfOpenSuccessThreshold) {
        // Enough successful probes – close the circuit
        this.reset();
        if (__DEV__) {
          console.log(`[CircuitBreaker:${this.name}] Transitioned to CLOSED`);
        }
      }
    } else {
      // In closed state, reset failure count on success
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureAt = Date.now();

    if (this.state === 'half-open') {
      // Any failure in half-open immediately re-opens the circuit
      this.transitionToOpen();
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.transitionToOpen();
    }
  }

  private transitionToOpen(): void {
    this.state = 'open';
    this.successCount = 0;
    this.nextRetryAt = Date.now() + this.config.resetTimeoutMs;
    if (__DEV__) {
      console.log(
        `[CircuitBreaker:${this.name}] Transitioned to OPEN – ` +
          `retry at ${new Date(this.nextRetryAt).toISOString()}`,
      );
    }
  }

  private checkAutoTransition(): void {
    if (this.state === 'open' && this.nextRetryAt && Date.now() >= this.nextRetryAt) {
      this.state = 'half-open';
      this.successCount = 0;
      if (__DEV__) {
        console.log(`[CircuitBreaker:${this.name}] Transitioned to HALF-OPEN`);
      }
    }
  }
}

/** Custom error thrown when the circuit breaker is open */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

// ============================================================
// MARK: - Graceful Degradation
// ============================================================

/**
 * Attempt to store data with graceful degradation when storage is full.
 *
 * Strategy:
 * 1. Try to store normally.
 * 2. If that fails (budget exceeded), prune expired entries and retry.
 * 3. If still failing, attempt to store a smaller "essential" subset.
 * 4. If all else fails, log a warning and return false.
 *
 * @param key       - Cache key
 * @param fullData  - The complete data to cache
 * @param essentialData - A smaller subset of the data to cache as fallback
 * @param ttlMs     - Optional TTL override
 * @returns true if data (full or essential) was stored successfully
 */
export async function storeWithDegradation<T>(
  key: string,
  fullData: T,
  essentialData?: Partial<T>,
  ttlMs?: number,
): Promise<boolean> {
  try {
    await StorageManager.set(key, fullData, ttlMs ? { ttlMs } : undefined);
    return true;
  } catch {
    // Budget exceeded – try pruning first
    if (__DEV__) {
      console.warn(`[ErrorRecovery] Storage full for "${key}" – pruning expired entries`);
    }
  }

  // Prune and retry with full data
  await StorageManager.pruneExpired();
  try {
    await StorageManager.set(key, fullData, ttlMs ? { ttlMs } : undefined);
    return true;
  } catch {
    // Still not enough room
  }

  // Try essential data subset if provided
  if (essentialData !== undefined) {
    try {
      await StorageManager.set(key, essentialData, ttlMs ? { ttlMs } : undefined);
      if (__DEV__) {
        console.warn(`[ErrorRecovery] Stored essential-only data for "${key}"`);
      }
      return true;
    } catch {
      // Even essential data doesn't fit
    }
  }

  if (__DEV__) {
    console.error(`[ErrorRecovery] Failed to store any data for "${key}" – storage critically full`);
  }
  return false;
}

// ============================================================
// MARK: - Corrupted Data Recovery
// ============================================================

/**
 * Attempt to read cached data with automatic recovery from corruption.
 *
 * If the cached value cannot be parsed, the entry is removed and
 * the optional `fallback` function is called to re-fetch the data.
 *
 * @param key      - Cache key to read
 * @param fallback - Optional async function to re-fetch data on corruption
 * @returns The cached or re-fetched data, or null if unrecoverable
 */
export async function getWithRecovery<T>(
  key: string,
  fallback?: () => Promise<T>,
): Promise<T | null> {
  const cached = await StorageManager.get<T>(key);
  if (cached !== null) return cached;

  // If we get null it could be missing or corrupted (StorageManager
  // already cleans up corrupted entries). Try the fallback.
  if (fallback) {
    try {
      const fresh = await fallback();
      // Re-cache the fresh data
      await StorageManager.set(key, fresh);
      return fresh;
    } catch (err) {
      if (__DEV__) {
        console.warn(`[ErrorRecovery] Fallback for "${key}" failed:`, err);
      }
    }
  }

  return null;
}

/**
 * Validate and repair the storage metadata index.
 *
 * Scans for orphaned entries (meta without data, or data without meta)
 * and cleans them up.
 *
 * @returns Number of entries repaired/removed
 */
export async function repairStorageIndex(): Promise<number> {
  // This delegates to StorageManager's pruneExpired as a first pass,
  // then does a deeper consistency check.
  let repaired = await StorageManager.pruneExpired();

  // Additional repair: clear the in-memory cache and reload to
  // ensure consistency with what's actually in AsyncStorage.
  StorageManager._resetMemoryCache();

  // Re-prune after reload to catch any inconsistencies
  repaired += await StorageManager.pruneExpired();

  if (__DEV__ && repaired > 0) {
    console.log(`[ErrorRecovery] Repaired ${repaired} storage entries`);
  }

  return repaired;
}

// ============================================================
// MARK: - Utilities
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
