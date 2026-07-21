import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { DataAccess } from './DataAccess';

export class SupabaseDataAccess implements DataAccess {
  readonly isConfigured = isSupabaseConfigured;
  readonly from: DataAccess['from'] = (...args) => supabase.from(...args);
  readonly rpc: DataAccess['rpc'] = (...args) => supabase.rpc(...args);
  get auth(): DataAccess['auth'] {
    return supabase.auth;
  }
  get functions(): DataAccess['functions'] {
    return supabase.functions;
  }
  get storage(): DataAccess['storage'] {
    return supabase.storage;
  }
}

export const supabaseDataAccess = new SupabaseDataAccess();
