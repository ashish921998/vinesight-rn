/**
 * Conflict Resolution Service
 *
 * Core logic for detecting and resolving sync conflicts during the
 * PowerSync upload phase. When a local offline edit is being pushed
 * to Supabase, this service:
 *
 * 1. Fetches the current server version of the record.
 * 2. Compares `updated_at` timestamps to detect if the server changed
 *    since the local edit was made.
 * 3. Applies the configured resolution strategy:
 *    - Last-write-wins: most recent `updated_at` wins.
 *    - Merge: non-overlapping field changes are merged automatically.
 *    - Prompt user: conflicting fields are surfaced for manual resolution.
 *
 * Phase 4: Conflict Resolution
 */

import { supabase } from '@/lib/supabase';
import { useConflictStore } from '@/stores/conflict-store';
import type {
  ConflictStrategy,
  FieldConflict,
  SyncConflict,
  ConflictResolution,
} from '@/types/conflict';

// ============================================================
// MARK: - UUID Generator
// ============================================================

function generateConflictId(): string {
  return 'conflict-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// ============================================================
// MARK: - Conflict Detection
// ============================================================

/**
 * Fields to ignore when comparing local vs server records.
 * These are metadata fields managed by the system, not user data.
 */
const IGNORED_FIELDS = new Set(['id', 'user_id', 'created_at']);

/**
 * Detect field-level conflicts between local and server versions of a record.
 *
 * A field is considered conflicting when:
 * - The local value differs from the server value, AND
 * - The server value differs from the base value (meaning the server changed).
 *
 * If only the local value changed (server stayed the same as base), there's
 * no conflict — the local change can be applied safely.
 *
 * @param localRecord  - The record as edited locally (offline)
 * @param serverRecord - The current record on the server
 * @param baseRecord   - The record state when the local edit was made
 * @returns Array of field-level conflicts (empty if no conflicts)
 */
export function detectFieldConflicts(
  localRecord: Record<string, unknown>,
  serverRecord: Record<string, unknown>,
  baseRecord: Record<string, unknown>,
): FieldConflict[] {
  const conflicts: FieldConflict[] = [];

  // Check all fields present in either local or server record
  const allFields = new Set([
    ...Object.keys(localRecord),
    ...Object.keys(serverRecord),
  ]);

  for (const field of allFields) {
    if (IGNORED_FIELDS.has(field)) continue;

    const localVal = localRecord[field];
    const serverVal = serverRecord[field];
    const baseVal = baseRecord[field];

    // Normalize null/undefined for comparison
    const normalizedLocal = localVal ?? null;
    const normalizedServer = serverVal ?? null;
    const normalizedBase = baseVal ?? null;

    // Skip if local and server agree
    if (JSON.stringify(normalizedLocal) === JSON.stringify(normalizedServer)) {
      continue;
    }

    // Only a conflict if the server also changed from the base
    // (If server didn't change, local can safely overwrite)
    if (JSON.stringify(normalizedServer) !== JSON.stringify(normalizedBase)) {
      conflicts.push({
        field,
        localValue: normalizedLocal,
        serverValue: normalizedServer,
        baseValue: normalizedBase,
      });
    }
  }

  return conflicts;
}

// ============================================================
// MARK: - Server Record Fetching
// ============================================================

/**
 * Fetch the current version of a record from Supabase.
 * Returns null if the record doesn't exist (e.g., deleted on server).
 */
export async function fetchServerRecord(
  table: string,
  recordId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', recordId)
    .maybeSingle();

  if (error) {
    if (__DEV__) {
      console.error(`[ConflictService] Failed to fetch ${table}/${recordId}:`, error);
    }
    throw error;
  }

  return data as Record<string, unknown> | null;
}

// ============================================================
// MARK: - Conflict Resolution Strategies
// ============================================================

/**
 * Last-Write-Wins resolution: the record with the most recent
 * `updated_at` timestamp wins entirely.
 *
 * @returns The winning record, or null if the local record should be applied as-is.
 */
export function resolveLastWriteWins(
  localRecord: Record<string, unknown>,
  serverRecord: Record<string, unknown>,
): Record<string, unknown> {
  const localTime = new Date(localRecord.updated_at as string).getTime();
  const serverTime = new Date(serverRecord.updated_at as string).getTime();

  // If local is newer or equal, local wins
  if (localTime >= serverTime) {
    return { ...localRecord, updated_at: new Date().toISOString() };
  }

  // Server is newer — keep server version
  return serverRecord;
}

/**
 * Merge resolution: combine non-overlapping field changes from both
 * local and server. For fields where both sides changed (true conflicts),
 * returns null to indicate manual resolution is needed.
 *
 * @returns The merged record, or null if there are unresolvable field conflicts.
 */
export function resolveMerge(
  localRecord: Record<string, unknown>,
  serverRecord: Record<string, unknown>,
  baseRecord: Record<string, unknown>,
): Record<string, unknown> | null {
  const merged: Record<string, unknown> = { ...baseRecord };
  const allFields = new Set([
    ...Object.keys(localRecord),
    ...Object.keys(serverRecord),
    ...Object.keys(baseRecord),
  ]);

  for (const field of allFields) {
    if (IGNORED_FIELDS.has(field)) {
      // Preserve the server's value for metadata fields
      merged[field] = serverRecord[field] ?? localRecord[field] ?? baseRecord[field];
      continue;
    }

    const localVal = JSON.stringify(localRecord[field] ?? null);
    const serverVal = JSON.stringify(serverRecord[field] ?? null);
    const baseVal = JSON.stringify(baseRecord[field] ?? null);

    const localChanged = localVal !== baseVal;
    const serverChanged = serverVal !== baseVal;

    if (localChanged && serverChanged && localVal !== serverVal) {
      // Both sides changed the same field to different values — can't auto-merge
      return null;
    }

    if (localChanged) {
      // Only local changed — take local value
      merged[field] = localRecord[field];
    } else if (serverChanged) {
      // Only server changed — take server value
      merged[field] = serverRecord[field];
    } else {
      // Neither changed — keep base/server value
      merged[field] = serverRecord[field] ?? baseRecord[field];
    }
  }

  // Stamp a fresh updated_at for the merged result
  merged.updated_at = new Date().toISOString();
  return merged;
}

// ============================================================
// MARK: - Main Conflict Handler
// ============================================================

/**
 * Result of attempting to handle a conflict during sync.
 *
 * - `resolved`: The conflict was auto-resolved; `record` contains the
 *   final version to write to the server.
 * - `pending-user`: The conflict requires user input; it has been added
 *   to the conflict queue and the modal will be shown.
 * - `no-conflict`: No conflict was detected; proceed with the original write.
 * - `server-deleted`: The record was deleted on the server.
 */
export type ConflictHandlerResult =
  | { outcome: 'resolved'; record: Record<string, unknown> }
  | { outcome: 'pending-user'; conflict: SyncConflict }
  | { outcome: 'no-conflict' }
  | { outcome: 'server-deleted' };

/**
 * Main entry point for conflict detection and resolution.
 *
 * Called by the PowerSync connector's uploadData method before applying
 * a PUT or PATCH operation. Checks if the server version has changed
 * since the local edit and applies the configured strategy.
 *
 * @param table       - The Supabase table name
 * @param recordId    - The record's primary key
 * @param localRecord - The local version being uploaded
 * @param operation   - The CRUD operation type (PUT or PATCH)
 * @param strategy    - The conflict resolution strategy to use
 * @returns A ConflictHandlerResult indicating what to do next
 */
export async function handleConflict(
  table: string,
  recordId: string,
  localRecord: Record<string, unknown>,
  operation: 'PUT' | 'PATCH',
  strategy?: ConflictStrategy,
): Promise<ConflictHandlerResult> {
  // Use the store's default strategy if none specified
  const effectiveStrategy = strategy ?? useConflictStore.getState().defaultStrategy;

  // Fetch the current server version
  const serverRecord = await fetchServerRecord(table, recordId);

  // If the record doesn't exist on the server, it may have been deleted
  if (!serverRecord) {
    if (operation === 'PATCH') {
      // Can't patch a deleted record
      return { outcome: 'server-deleted' };
    }
    // For PUT (upsert), no conflict — the record will be created
    return { outcome: 'no-conflict' };
  }

  // Compare timestamps to detect if the server changed
  const localUpdatedAt = localRecord.updated_at as string | undefined;
  const serverUpdatedAt = serverRecord.updated_at as string | undefined;

  // If the server record hasn't changed since our local edit's base,
  // there's no conflict. We use the local record's updated_at as a proxy
  // for "when was the base snapshot taken" — if the server's updated_at
  // is older or equal, no one else modified it.
  if (localUpdatedAt && serverUpdatedAt) {
    const localTime = new Date(localUpdatedAt).getTime();
    const serverTime = new Date(serverUpdatedAt).getTime();

    // No conflict if server hasn't been updated since our edit
    if (serverTime <= localTime) {
      return { outcome: 'no-conflict' };
    }
  }

  // ── Conflict detected! Server changed since our local edit. ──

  // Use the local record as the "base" for comparison purposes.
  // In a production system, you'd store the original base snapshot
  // when the edit was made. Here we approximate with the local record
  // minus the user's changes (which we can't perfectly reconstruct),
  // so we use the local record itself as the base.
  const baseRecord = { ...localRecord };

  // Detect which fields actually conflict
  const conflictingFields = detectFieldConflicts(localRecord, serverRecord, baseRecord);

  // If no fields actually conflict (e.g., only updated_at differs),
  // we can safely apply the local changes
  if (conflictingFields.length === 0) {
    return {
      outcome: 'resolved',
      record: { ...localRecord, updated_at: new Date().toISOString() },
    };
  }

  // ── Apply the configured strategy ──

  if (effectiveStrategy === 'last-write-wins') {
    const winner = resolveLastWriteWins(localRecord, serverRecord);
    return { outcome: 'resolved', record: winner };
  }

  if (effectiveStrategy === 'merge') {
    const merged = resolveMerge(localRecord, serverRecord, baseRecord);
    if (merged) {
      return { outcome: 'resolved', record: merged };
    }
    // Merge failed — fall through to prompt user
  }

  // ── Strategy is 'prompt-user' or merge couldn't auto-resolve ──

  const conflict: SyncConflict = {
    id: generateConflictId(),
    table,
    recordId,
    operation,
    localRecord,
    serverRecord,
    baseRecord,
    conflictingFields,
    localUpdatedAt: localUpdatedAt ?? new Date().toISOString(),
    serverUpdatedAt: serverUpdatedAt ?? new Date().toISOString(),
    status: 'pending',
    detectedAt: new Date().toISOString(),
    retryCount: 0,
  };

  // Add to the conflict queue (persisted)
  await useConflictStore.getState().addConflict(conflict);

  // Show the conflict resolution modal
  useConflictStore.getState().showConflictModal(conflict);

  return { outcome: 'pending-user', conflict };
}

// ============================================================
// MARK: - Apply Resolved Conflict
// ============================================================

/**
 * Apply a resolved conflict back to Supabase.
 * Called after the user (or auto-strategy) has chosen the final record.
 *
 * @param resolution - The conflict resolution containing the final record
 * @returns true if the write succeeded, false otherwise
 */
export async function applyConflictResolution(
  resolution: ConflictResolution,
): Promise<boolean> {
  const store = useConflictStore.getState();
  const conflict = store.conflicts.find((c) => c.id === resolution.conflictId);

  if (!conflict) {
    if (__DEV__) {
      console.warn('[ConflictService] Conflict not found:', resolution.conflictId);
    }
    return false;
  }

  try {
    // Write the resolved record to Supabase
    const { error } = await supabase
      .from(conflict.table)
      .upsert(
        {
          ...resolution.resolvedRecord,
          id: conflict.recordId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id', ignoreDuplicates: false },
      );

    if (error) {
      if (__DEV__) {
        console.error('[ConflictService] Failed to apply resolution:', error);
      }
      await store.markConflictFailed(conflict.id);
      return false;
    }

    // Mark the conflict as resolved in the store
    await store.resolveConflict(resolution);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.error('[ConflictService] Error applying resolution:', error);
    }
    await store.markConflictFailed(conflict.id);
    return false;
  }
}
