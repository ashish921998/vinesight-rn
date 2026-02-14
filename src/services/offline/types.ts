/**
 * Offline Services - Shared Type Definitions
 *
 * Common interfaces and types used across StorageManager,
 * ErrorRecovery, and NetworkManager modules.
 */

// ============================================================
// MARK: - Storage Types
// ============================================================

/** Metadata stored alongside each cached entry */
export interface CacheEntryMeta {
  /** Unique key for this cache entry */
  key: string;
  /** Size in bytes of the serialized value */
  sizeBytes: number;
  /** ISO timestamp when the entry was created */
  createdAt: string;
  /** ISO timestamp when the entry was last accessed */
  lastAccessedAt: string;
  /** TTL in milliseconds; null means no expiration */
  ttlMs: number | null;
  /** ISO timestamp when the entry expires; null means no expiration */
  expiresAt: string | null;
}

/** Result of a storage stats query */
export interface StorageStats {
  /** Total bytes used by offline cache */
  totalBytes: number;
  /** Number of cached entries */
  entryCount: number;
  /** Storage budget in bytes */
  budgetBytes: number;
  /** Percentage of budget used (0-100) */
  usagePercent: number;
  /** Number of expired entries awaiting cleanup */
  expiredCount: number;
}

/** Options for storing a cache entry */
export interface CacheSetOptions {
  /** TTL in milliseconds; defaults to StorageManager.DEFAULT_TTL_MS */
  ttlMs?: number;
}

// ============================================================
// MARK: - Error Recovery Types
// ============================================================

/** Current state of the circuit breaker */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/** Configuration for the circuit breaker */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Duration in ms the circuit stays open before transitioning to half-open */
  resetTimeoutMs: number;
  /** Number of successful requests in half-open state to close the circuit */
  halfOpenSuccessThreshold: number;
}

/** Snapshot of circuit breaker status */
export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureAt: string | null;
  nextRetryAt: string | null;
}

/** Configuration for exponential backoff */
export interface BackoffConfig {
  /** Initial delay in ms before the first retry */
  initialDelayMs: number;
  /** Maximum delay in ms between retries */
  maxDelayMs: number;
  /** Multiplier applied to the delay after each retry */
  multiplier: number;
  /** Maximum jitter in ms added to each delay to prevent thundering herd */
  jitterMs: number;
  /** Maximum number of retry attempts */
  maxRetries: number;
}

/** Result of a retried operation */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

// ============================================================
// MARK: - Network Types
// ============================================================

/** Connection quality levels */
export type ConnectionQuality = 'good' | 'fair' | 'poor' | 'offline';

/** Detailed network state */
export interface NetworkState {
  /** Whether the device has any network connectivity */
  isConnected: boolean;
  /** Assessed quality of the connection */
  quality: ConnectionQuality;
  /** Estimated round-trip time in ms (null if offline) */
  rttMs: number | null;
  /** Whether the connection is metered (e.g., cellular) */
  isMetered: boolean;
  /** ISO timestamp of the last successful connectivity check */
  lastCheckedAt: string;
}

/** Thresholds for classifying connection quality based on RTT */
export interface QualityThresholds {
  /** RTT below this value (ms) is considered "good" */
  goodMaxRttMs: number;
  /** RTT below this value (ms) is considered "fair"; above is "poor" */
  fairMaxRttMs: number;
}

/** Priority levels for queued operations */
export type OperationPriority = 'critical' | 'high' | 'normal' | 'low';

/** A queued network operation */
export interface QueuedOperation {
  /** Unique identifier for this operation */
  id: string;
  /** Priority level determining when this operation should execute */
  priority: OperationPriority;
  /** Minimum connection quality required to execute this operation */
  minQuality: ConnectionQuality;
  /** ISO timestamp when the operation was queued */
  queuedAt: string;
  /** Number of times this operation has been attempted */
  attempts: number;
  /** Serialized operation data (e.g., API call details) */
  payload: string;
  /** Optional label for debugging */
  label?: string;
}

/** Listener callback for network state changes */
export type NetworkStateListener = (state: NetworkState) => void;
