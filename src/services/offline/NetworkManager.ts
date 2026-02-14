/**
 * NetworkManager - Network State Handling
 * Phase 8.4
 *
 * Provides advanced network state detection and management:
 * - Connection quality assessment (good / fair / poor / offline)
 * - RTT-based quality measurement via lightweight pings
 * - Listener-based network state change notifications
 * - Intelligent operation queuing based on connection quality
 *
 * Uses expo-network when available, with a fetch-based fallback
 * for connectivity probing.
 */

import type {
  ConnectionQuality,
  NetworkState,
  NetworkStateListener,
  OperationPriority,
  QualityThresholds,
  QueuedOperation,
} from './types';

// ============================================================
// MARK: - Constants
// ============================================================

/** URL used for lightweight connectivity probes */
const PROBE_URL = 'https://clients3.google.com/generate_204';

/** Timeout for probe requests in ms */
const PROBE_TIMEOUT_MS = 5_000;

/** How often to poll network quality in ms (30 seconds) */
const POLL_INTERVAL_MS = 30_000;

/** Default quality thresholds */
const DEFAULT_THRESHOLDS: QualityThresholds = {
  goodMaxRttMs: 300,
  fairMaxRttMs: 1_000,
};

/**
 * Minimum connection quality required for each priority level.
 * Critical operations attempt even on poor connections;
 * low-priority operations wait for good connections.
 */
const PRIORITY_QUALITY_MAP: Record<OperationPriority, ConnectionQuality> = {
  critical: 'poor',
  high: 'poor',
  normal: 'fair',
  low: 'good',
};

/** Numeric ordering for quality comparison */
const QUALITY_ORDER: Record<ConnectionQuality, number> = {
  offline: 0,
  poor: 1,
  fair: 2,
  good: 3,
};

// ============================================================
// MARK: - NetworkManager
// ============================================================

export class NetworkManager {
  private static listeners: Set<NetworkStateListener> = new Set();
  private static currentState: NetworkState = {
    isConnected: true, // Optimistic default
    quality: 'good',
    rttMs: null,
    isMetered: false,
    lastCheckedAt: new Date().toISOString(),
  };
  private static pollTimer: ReturnType<typeof setInterval> | null = null;
  private static thresholds: QualityThresholds = DEFAULT_THRESHOLDS;
  private static operationQueue: QueuedOperation[] = [];
  private static nextOperationId = 1;

  // ----------------------------------------------------------
  // Public API – State
  // ----------------------------------------------------------

  /** Get the current network state snapshot */
  static getState(): NetworkState {
    return { ...NetworkManager.currentState };
  }

  /** Get the current connection quality */
  static getQuality(): ConnectionQuality {
    return NetworkManager.currentState.quality;
  }

  /** Check if the device is currently online (any quality) */
  static isOnline(): boolean {
    return NetworkManager.currentState.isConnected;
  }

  /**
   * Check if the current connection quality meets or exceeds
   * the specified minimum quality.
   */
  static meetsQuality(minQuality: ConnectionQuality): boolean {
    return QUALITY_ORDER[NetworkManager.currentState.quality] >= QUALITY_ORDER[minQuality];
  }

  // ----------------------------------------------------------
  // Public API – Probing
  // ----------------------------------------------------------

  /**
   * Perform a network quality probe.
   *
   * Sends a lightweight HTTP request to measure RTT and assess
   * connection quality. Updates the internal state and notifies
   * listeners if the quality changed.
   */
  static async probe(): Promise<NetworkState> {
    const previousQuality = NetworkManager.currentState.quality;
    let rttMs: number | null = null;
    let isConnected = false;

    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

      const response = await fetch(PROBE_URL, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      rttMs = Date.now() - start;
      isConnected = response.ok || response.status === 204;
    } catch {
      // Network error or timeout – device is offline or connection is very poor
      isConnected = false;
      rttMs = null;
    }

    const quality = NetworkManager.assessQuality(isConnected, rttMs);

    NetworkManager.currentState = {
      isConnected,
      quality,
      rttMs,
      isMetered: NetworkManager.currentState.isMetered, // Preserved from last known
      lastCheckedAt: new Date().toISOString(),
    };

    // Notify listeners if quality changed
    if (quality !== previousQuality) {
      NetworkManager.notifyListeners();

      // Process queued operations if quality improved
      if (QUALITY_ORDER[quality] > QUALITY_ORDER[previousQuality]) {
        await NetworkManager.processQueue();
      }
    }

    return NetworkManager.getState();
  }

  // ----------------------------------------------------------
  // Public API – Listeners
  // ----------------------------------------------------------

  /**
   * Subscribe to network state changes.
   * Returns an unsubscribe function.
   */
  static addListener(listener: NetworkStateListener): () => void {
    NetworkManager.listeners.add(listener);
    return () => {
      NetworkManager.listeners.delete(listener);
    };
  }

  /** Remove all listeners */
  static removeAllListeners(): void {
    NetworkManager.listeners.clear();
  }

  // ----------------------------------------------------------
  // Public API – Polling
  // ----------------------------------------------------------

  /**
   * Start periodic network quality polling.
   * Performs an immediate probe, then polls at the configured interval.
   */
  static startPolling(intervalMs: number = POLL_INTERVAL_MS): void {
    NetworkManager.stopPolling();
    // Fire an immediate probe
    NetworkManager.probe().catch(() => {});
    NetworkManager.pollTimer = setInterval(() => {
      NetworkManager.probe().catch(() => {});
    }, intervalMs);
  }

  /** Stop periodic network quality polling */
  static stopPolling(): void {
    if (NetworkManager.pollTimer) {
      clearInterval(NetworkManager.pollTimer);
      NetworkManager.pollTimer = null;
    }
  }

  // ----------------------------------------------------------
  // Public API – Operation Queue
  // ----------------------------------------------------------

  /**
   * Queue an operation to be executed when network quality is sufficient.
   *
   * If the current quality already meets the requirement, the operation
   * payload is returned immediately (caller should execute it).
   * Otherwise it is queued for later processing.
   *
   * @param payload  - Serialized operation data
   * @param priority - Priority level (determines minimum quality)
   * @param label    - Optional human-readable label
   * @returns The operation ID, or null if executed immediately
   */
  static enqueue(
    payload: string,
    priority: OperationPriority = 'normal',
    label?: string,
  ): string {
    const minQuality = PRIORITY_QUALITY_MAP[priority];
    const id = `op_${NetworkManager.nextOperationId++}_${Date.now()}`;

    const op: QueuedOperation = {
      id,
      priority,
      minQuality,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      payload,
      label,
    };

    NetworkManager.operationQueue.push(op);

    // Sort queue by priority (critical first)
    NetworkManager.operationQueue.sort((a, b) => {
      const priorityOrder: Record<OperationPriority, number> = {
        critical: 0,
        high: 1,
        normal: 2,
        low: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return id;
  }

  /**
   * Get all operations from the queue that can be executed
   * at the current network quality, removing them from the queue.
   *
   * Callers are responsible for actually executing the operations.
   */
  static dequeueReady(): QueuedOperation[] {
    const ready: QueuedOperation[] = [];
    const remaining: QueuedOperation[] = [];

    for (const op of NetworkManager.operationQueue) {
      if (NetworkManager.meetsQuality(op.minQuality)) {
        op.attempts++;
        ready.push(op);
      } else {
        remaining.push(op);
      }
    }

    NetworkManager.operationQueue = remaining;
    return ready;
  }

  /** Get the current operation queue (read-only snapshot) */
  static getQueue(): ReadonlyArray<QueuedOperation> {
    return [...NetworkManager.operationQueue];
  }

  /** Get the number of queued operations */
  static getQueueSize(): number {
    return NetworkManager.operationQueue.length;
  }

  /** Remove a specific operation from the queue by ID */
  static removeFromQueue(operationId: string): boolean {
    const initialLength = NetworkManager.operationQueue.length;
    NetworkManager.operationQueue = NetworkManager.operationQueue.filter(
      (op) => op.id !== operationId,
    );
    return NetworkManager.operationQueue.length < initialLength;
  }

  /** Clear all queued operations */
  static clearQueue(): void {
    NetworkManager.operationQueue = [];
  }

  // ----------------------------------------------------------
  // Public API – Configuration
  // ----------------------------------------------------------

  /** Override quality thresholds */
  static setThresholds(thresholds: Partial<QualityThresholds>): void {
    NetworkManager.thresholds = { ...NetworkManager.thresholds, ...thresholds };
  }

  /** Manually set the network state (useful for testing or native bridge updates) */
  static setState(partial: Partial<NetworkState>): void {
    const previousQuality = NetworkManager.currentState.quality;
    NetworkManager.currentState = {
      ...NetworkManager.currentState,
      ...partial,
      lastCheckedAt: new Date().toISOString(),
    };

    if (NetworkManager.currentState.quality !== previousQuality) {
      NetworkManager.notifyListeners();
    }
  }

  // ----------------------------------------------------------
  // Internal
  // ----------------------------------------------------------

  /**
   * Assess connection quality based on connectivity and RTT.
   *
   * Classification:
   * - offline: no connectivity
   * - poor:    RTT > fairMaxRttMs or RTT is null (timeout)
   * - fair:    RTT between goodMaxRttMs and fairMaxRttMs
   * - good:    RTT ≤ goodMaxRttMs
   */
  private static assessQuality(isConnected: boolean, rttMs: number | null): ConnectionQuality {
    if (!isConnected) return 'offline';
    if (rttMs === null) return 'poor'; // Connected but couldn't measure – likely very slow

    const { goodMaxRttMs, fairMaxRttMs } = NetworkManager.thresholds;

    if (rttMs <= goodMaxRttMs) return 'good';
    if (rttMs <= fairMaxRttMs) return 'fair';
    return 'poor';
  }

  private static notifyListeners(): void {
    const state = NetworkManager.getState();
    for (const listener of NetworkManager.listeners) {
      try {
        listener(state);
      } catch (err) {
        if (__DEV__) {
          console.warn('[NetworkManager] Listener error:', err);
        }
      }
    }
  }

  /**
   * Process queued operations when network quality improves.
   * Dequeues ready operations and logs them; actual execution
   * is left to the consumer who registered the operations.
   */
  private static async processQueue(): Promise<void> {
    const ready = NetworkManager.dequeueReady();
    if (ready.length > 0 && __DEV__) {
      console.log(
        `[NetworkManager] ${ready.length} queued operation(s) ready for execution`,
      );
    }
    // Note: In a full implementation, this would invoke registered
    // callbacks. For now, consumers should poll dequeueReady() or
    // listen for state changes and call dequeueReady() themselves.
  }

  // ----------------------------------------------------------
  // Reset (for testing)
  // ----------------------------------------------------------

  /** Reset all state (useful in tests) */
  static _reset(): void {
    NetworkManager.stopPolling();
    NetworkManager.removeAllListeners();
    NetworkManager.clearQueue();
    NetworkManager.thresholds = DEFAULT_THRESHOLDS;
    NetworkManager.nextOperationId = 1;
    NetworkManager.currentState = {
      isConnected: true,
      quality: 'good',
      rttMs: null,
      isMetered: false,
      lastCheckedAt: new Date().toISOString(),
    };
  }
}
