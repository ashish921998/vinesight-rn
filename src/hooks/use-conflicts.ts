/**
 * Conflict Resolution Hook
 *
 * Provides a convenient React hook for components to access
 * conflict state and actions. Wraps the conflict store with
 * derived values like pending count.
 *
 * Phase 4: Conflict Resolution
 */

import { useMemo } from 'react';
import { useConflictStore } from '@/stores/conflict-store';

/**
 * Hook that provides conflict resolution state and actions.
 *
 * Usage:
 * ```tsx
 * const { pendingCount, hasPendingConflicts, showConflictModal } = useConflicts();
 * ```
 */
export function useConflicts() {
  const conflicts = useConflictStore((s) => s.conflicts);
  const activeConflict = useConflictStore((s) => s.activeConflict);
  const isModalVisible = useConflictStore((s) => s.isModalVisible);
  const defaultStrategy = useConflictStore((s) => s.defaultStrategy);
  const isLoading = useConflictStore((s) => s.isLoading);

  // Actions
  const loadConflicts = useConflictStore((s) => s.loadConflicts);
  const showConflictModal = useConflictStore((s) => s.showConflictModal);
  const hideConflictModal = useConflictStore((s) => s.hideConflictModal);
  const removeConflict = useConflictStore((s) => s.removeConflict);
  const clearResolvedConflicts = useConflictStore((s) => s.clearResolvedConflicts);
  const setDefaultStrategy = useConflictStore((s) => s.setDefaultStrategy);

  const pendingConflicts = useMemo(
    () => conflicts.filter((c) => c.status === 'pending'),
    [conflicts],
  );

  const resolvedConflicts = useMemo(
    () => conflicts.filter((c) => c.status === 'resolved'),
    [conflicts],
  );

  const failedConflicts = useMemo(
    () => conflicts.filter((c) => c.status === 'failed'),
    [conflicts],
  );

  return {
    // State
    conflicts,
    pendingConflicts,
    resolvedConflicts,
    failedConflicts,
    pendingCount: pendingConflicts.length,
    hasPendingConflicts: pendingConflicts.length > 0,
    activeConflict,
    isModalVisible,
    defaultStrategy,
    isLoading,

    // Actions
    loadConflicts,
    showConflictModal,
    hideConflictModal,
    removeConflict,
    clearResolvedConflicts,
    setDefaultStrategy,
  };
}
