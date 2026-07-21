import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Application persistence port.
 *
 * The first migration keeps the Supabase query-builder types at this boundary
 * so existing domain queries can move without changing their result handling.
 * Domain-specific operations can be added here as each query is consolidated.
 */
export interface DataAccess {
  isConfigured: () => boolean;
  from: SupabaseClient['from'];
  rpc: SupabaseClient['rpc'];
  auth: SupabaseClient['auth'];
  functions: SupabaseClient['functions'];
  storage: SupabaseClient['storage'];
}
