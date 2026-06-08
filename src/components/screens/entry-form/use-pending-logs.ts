import { useReducer, useCallback } from 'react';
import type { LogTypeId } from '@/constants/calculator-models';
import type { PendingLog, PendingLogFailure } from '@/components/screens/entry-form/PendingLogs';
import {
  pendingLogsReducer,
  initialPendingLogsState,
} from '@/components/screens/entry-form/pending-logs-reducer';

/**
 * React binding for {@link pendingLogsReducer}. Returns the draft list + failure
 * map alongside stable action dispatchers. The list/map are surfaced under the
 * legacy `pendingLogs` / `pendingLogFailures` names so the (large) entry-form
 * consumer keeps reading them unchanged; only the mutation sites move to the
 * semantic dispatchers below.
 */
export function usePendingLogs() {
  const [state, dispatch] = useReducer(pendingLogsReducer, initialPendingLogsState);

  const appendPendingLog = useCallback(
    (log: PendingLog, sourceTaskType: LogTypeId | null) =>
      dispatch({ type: 'append', log, sourceTaskType }),
    [],
  );
  const removePendingLog = useCallback((id: string) => dispatch({ type: 'remove', id }), []);
  const setPendingLogFailures = useCallback(
    (failures: Record<string, PendingLogFailure>) => dispatch({ type: 'setFailures', failures }),
    [],
  );
  const clearPendingLogs = useCallback(() => dispatch({ type: 'clear' }), []);

  return {
    pendingLogs: state.logs,
    pendingLogFailures: state.failures,
    appendPendingLog,
    removePendingLog,
    setPendingLogFailures,
    clearPendingLogs,
  };
}
