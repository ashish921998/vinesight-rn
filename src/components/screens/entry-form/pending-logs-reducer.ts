import type { LogTypeId } from '@/constants/calculator-models';
import type { PendingLog, PendingLogFailure } from '@/components/screens/entry-form/PendingLogs';

/** The two pieces of draft-session state, kept together so every transition is atomic. */
export interface PendingLogsState {
  logs: PendingLog[];
  failures: Record<string, PendingLogFailure>;
}

export const initialPendingLogsState: PendingLogsState = { logs: [], failures: {} };

export type PendingLogsAction =
  | { type: 'append'; log: PendingLog; sourceTaskType: LogTypeId | null }
  | { type: 'remove'; id: string }
  | { type: 'setFailures'; failures: Record<string, PendingLogFailure> }
  | { type: 'clear' };

/**
 * Pure state machine for the entry-form draft session: the list of pending log
 * drafts plus the per-draft save-failure map. Extracted from the (very large)
 * entry form so the draft transitions — especially the "first matching draft
 * completes the source task" tagging and the failure cleanup on removal — are
 * unit-testable in isolation. The reducer owns *state* transitions only; the
 * impure construction of a failure record (Sentry/console/i18n) stays in the
 * component and arrives here via `setFailures`.
 */
export function pendingLogsReducer(
  state: PendingLogsState,
  action: PendingLogsAction,
): PendingLogsState {
  switch (action.type) {
    case 'append': {
      // Tag only the first draft whose type matches the in-progress source task,
      // so saving the session completes that task exactly once.
      const isSourceTaskLog = Boolean(
        action.sourceTaskType &&
        action.log.type === action.sourceTaskType &&
        !state.logs.some((log) => log.isSourceTaskLog),
      );
      return { ...state, logs: [...state.logs, { ...action.log, isSourceTaskLog }] };
    }
    case 'remove': {
      const logs = state.logs.filter((log) => log.id !== action.id);
      // Preserve referential equality of `failures` when the removed draft had none.
      if (!state.failures[action.id]) {
        return { ...state, logs };
      }
      const failures = { ...state.failures };
      delete failures[action.id];
      return { logs, failures };
    }
    case 'setFailures':
      return { ...state, failures: action.failures };
    case 'clear':
      return { logs: [], failures: {} };
    default:
      return state;
  }
}
