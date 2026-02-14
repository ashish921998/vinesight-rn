/**
 * Conflict Resolution Types
 *
 * Type definitions for the offline conflict resolution system (Phase 4).
 * These types describe conflicts that arise when the same record is edited
 * both offline (locally) and by another user/device on the server.
 *
 * Phase 4: Conflict Resolution
 */

// ============================================================
// MARK: - Conflict Resolution Strategy
// ============================================================

/**
 * Available strategies for resolving sync conflicts.
 *
 * - `last-write-wins`: The most recent `updated_at` timestamp wins automatically.
 * - `merge`: Non-overlapping field changes are merged; overlapping fields
 *   fall back to `prompt-user`.
 * - `prompt-user`: Surface the conflict to the user for manual resolution.
 */
export type ConflictStrategy = 'last-write-wins' | 'merge' | 'prompt-user';

// ============================================================
// MARK: - Field-Level Conflict
// ============================================================

/**
 * Represents a conflict on a single field of a record.
 * Used when showing the user which fields differ between local and server.
 */
export interface FieldConflict {
  /** The field/column name that has conflicting values */
  field: string;
  /** The value stored locally (from the offline edit) */
  localValue: unknown;
  /** The current value on the server */
  serverValue: unknown;
  /** The value the field had when the local edit was made (base version) */
  baseValue: unknown;
}

// ============================================================
// MARK: - Conflict Record
// ============================================================

/**
 * Status of a conflict in the resolution pipeline.
 *
 * - `pending`: Conflict detected, awaiting resolution.
 * - `resolved`: User or auto-strategy has resolved the conflict.
 * - `failed`: Resolution attempt failed (e.g., network error during apply).
 */
export type ConflictStatus = 'pending' | 'resolved' | 'failed';

/**
 * A single sync conflict record.
 * Stored in the conflict queue and persisted across app restarts.
 */
export interface SyncConflict {
  /** Unique identifier for this conflict */
  id: string;
  /** The Supabase table where the conflict occurred */
  table: string;
  /** The record ID (primary key) that has conflicting versions */
  recordId: string;
  /** The CRUD operation that triggered the conflict (PUT or PATCH) */
  operation: 'PUT' | 'PATCH';
  /** The full local version of the record (as the user edited it offline) */
  localRecord: Record<string, unknown>;
  /** The full server version of the record (current state on Supabase) */
  serverRecord: Record<string, unknown>;
  /** The base version of the record (state when the local edit was made) */
  baseRecord: Record<string, unknown>;
  /** List of fields that have conflicting values */
  conflictingFields: FieldConflict[];
  /** When the local edit was made */
  localUpdatedAt: string;
  /** When the server record was last updated */
  serverUpdatedAt: string;
  /** Current status of this conflict */
  status: ConflictStatus;
  /** When this conflict was detected */
  detectedAt: string;
  /** When this conflict was resolved (if resolved) */
  resolvedAt?: string;
  /** How this conflict was resolved */
  resolvedBy?: 'auto-lww' | 'auto-merge' | 'user';
  /** Number of times resolution has been attempted */
  retryCount: number;
}

// ============================================================
// MARK: - Conflict Resolution Result
// ============================================================

/**
 * The result of resolving a conflict — the merged/chosen record
 * that should be written back to the server.
 */
export interface ConflictResolution {
  /** The conflict ID being resolved */
  conflictId: string;
  /** The final merged record to write to the server */
  resolvedRecord: Record<string, unknown>;
  /** How the conflict was resolved */
  strategy: 'auto-lww' | 'auto-merge' | 'user';
}

// ============================================================
// MARK: - Conflict Store State
// ============================================================

/**
 * Shape of the conflict resolution Zustand store.
 */
export interface ConflictStoreState {
  /** All tracked conflicts (pending + resolved + failed) */
  conflicts: SyncConflict[];
  /** The currently active conflict being shown to the user for resolution */
  activeConflict: SyncConflict | null;
  /** Whether the conflict resolution modal is visible */
  isModalVisible: boolean;
  /** The configured default conflict resolution strategy */
  defaultStrategy: ConflictStrategy;
  /** Whether conflicts are currently being loaded from storage */
  isLoading: boolean;
}

/**
 * Actions available on the conflict resolution store.
 */
export interface ConflictStoreActions {
  /** Load persisted conflicts from AsyncStorage */
  loadConflicts: () => Promise<void>;
  /** Add a new conflict to the queue */
  addConflict: (conflict: SyncConflict) => Promise<void>;
  /** Resolve a conflict with the given resolution */
  resolveConflict: (resolution: ConflictResolution) => Promise<void>;
  /** Mark a conflict as failed */
  markConflictFailed: (conflictId: string) => Promise<void>;
  /** Remove a resolved conflict from the queue */
  removeConflict: (conflictId: string) => Promise<void>;
  /** Clear all resolved conflicts */
  clearResolvedConflicts: () => Promise<void>;
  /** Show the conflict resolution modal for a specific conflict */
  showConflictModal: (conflict: SyncConflict) => void;
  /** Hide the conflict resolution modal */
  hideConflictModal: () => void;
  /** Update the default conflict resolution strategy */
  setDefaultStrategy: (strategy: ConflictStrategy) => void;
  /** Get all pending (unresolved) conflicts */
  getPendingConflicts: () => SyncConflict[];
}
