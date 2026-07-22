import type { DataAccess } from './DataAccess';
import { supabaseDataAccess } from './SupabaseDataAccess';

export type { DataAccess } from './DataAccess';
export { InMemoryDataAccess } from './InMemoryDataAccess';
export {
  SupabaseDataAccess,
  supabaseDataAccess,
  isMissingDisplayOrderColumnError,
} from './SupabaseDataAccess';

/**
 * Global adapter instance.
 *
 * Production code calls getDataAccess() at each call site so that tests can
 * swap the adapter via setDataAccess() without touching React context.
 * This is the actual injection mechanism for the data access layer — see
 * docs/adr/0002 for the migration plan.
 */
let currentDataAccess: DataAccess = supabaseDataAccess;

export function getDataAccess(): DataAccess {
  return currentDataAccess;
}

/**
 * Replace the global adapter. Returns a restore function that reverts to the
 * previous adapter — call it in test teardown to avoid leaking state.
 */
export function setDataAccess(dataAccess: DataAccess): () => void {
  const previousDataAccess = currentDataAccess;
  currentDataAccess = dataAccess;
  return () => {
    currentDataAccess = previousDataAccess;
  };
}
