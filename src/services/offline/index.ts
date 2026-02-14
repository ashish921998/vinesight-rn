/**
 * Offline Services - Barrel Export
 * Phase 8 (Part 1): Storage Management, Error Recovery & Network Handling
 */

// Types
export type {
  CacheEntryMeta,
  CacheSetOptions,
  StorageStats,
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  BackoffConfig,
  RetryResult,
  ConnectionQuality,
  NetworkState,
  NetworkStateListener,
  QualityThresholds,
  OperationPriority,
  QueuedOperation,
} from './types';

// 8.2 – Storage Management & Data Pruning
export { StorageManager } from './StorageManager';

// 8.3 – Error Recovery & Resilience
export {
  CircuitBreaker,
  CircuitBreakerOpenError,
  calculateBackoffDelay,
  retryWithBackoff,
  storeWithDegradation,
  getWithRecovery,
  repairStorageIndex,
} from './ErrorRecovery';

// 8.4 – Network State Handling
export { NetworkManager } from './NetworkManager';
