import type { DataAccess } from './DataAccess';

/**
 * Small deterministic fake for unit tests and future offline work.
 *
 * Callers that need query-specific behavior can provide a DataAccess object
 * with only the relevant methods replaced. The default implementation fails
 * loudly instead of accidentally pretending a read or write succeeded.
 */
export class InMemoryDataAccess implements DataAccess {
  readonly isConfigured = () => false;
  private readonly unsupported = (operation: string): never => {
    throw new Error(`InMemoryDataAccess does not implement ${operation}`);
  };

  readonly from: DataAccess['from'] = () => this.unsupported('from');
  readonly rpc: DataAccess['rpc'] = () => this.unsupported('rpc');
  readonly auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => undefined } },
    }),
  } as unknown as DataAccess['auth'];
  readonly functions = {
    invoke: async () => this.unsupported('functions.invoke'),
  } as unknown as DataAccess['functions'];
  readonly storage = {} as DataAccess['storage'];
}
