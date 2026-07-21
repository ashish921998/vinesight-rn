import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { DataAccess } from './DataAccess';

export class SupabaseDataAccess implements DataAccess {
  readonly isConfigured = isSupabaseConfigured;
  readonly from: DataAccess['from'] = (...args) => supabase.from(...args);
  readonly rpc: DataAccess['rpc'] = (...args) => supabase.rpc(...args);
  readonly auth = supabase.auth;
  readonly functions = supabase.functions;
  readonly storage = supabase.storage;
}

export const supabaseDataAccess = new SupabaseDataAccess();
