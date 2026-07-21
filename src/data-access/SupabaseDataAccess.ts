import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { DataAccess } from './DataAccess';

export class SupabaseDataAccess implements DataAccess {
  readonly isConfigured = isSupabaseConfigured;
  readonly from: DataAccess['from'] = (...args) => supabase.from(...args);
  readonly rpc: DataAccess['rpc'] = (...args) => supabase.rpc(...args);
  readonly farms = { query: this.from, call: this.rpc };
  readonly records = { query: this.from };
  readonly dashboardStats = { query: this.from, call: this.rpc };
  readonly reports = { query: this.from };
  get auth(): DataAccess['auth'] {
    return supabase.auth;
  }
  get functions(): DataAccess['functions'] {
    return supabase.functions;
  }
  get storage(): DataAccess['storage'] {
    return supabase.storage;
  }
  readonly workers: DataAccess['workers'] = {
    getWorker: async (workerId) => {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('id', workerId)
        .single();
      if (error) throw error;
      return data;
    },
    getAttendance: async ({ workerId, periodStart, periodEnd, farmId }) => {
      let query = supabase
        .from('worker_attendance')
        .select('*')
        .eq('worker_id', workerId)
        .gte('date', periodStart)
        .lte('date', periodEnd)
        .neq('work_status', 'absent')
        .order('date');
      if (farmId) query = query.contains('farm_ids', [farmId]);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    createSettlement: async (payload) => {
      const { data, error } = await supabase
        .from('worker_settlements')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    createTransaction: async (payload) => {
      const { error } = await supabase.from('worker_transactions').insert(payload);
      if (error) throw error;
    },
    getAdvanceBalance: async (workerId) => {
      const { data, error } = await supabase
        .from('workers')
        .select('advance_balance')
        .eq('id', workerId)
        .single();
      if (error) throw error;
      return data?.advance_balance ?? null;
    },
    updateAdvanceBalance: async (workerId, advanceBalance) => {
      const { error } = await supabase
        .from('workers')
        .update({ advance_balance: advanceBalance })
        .eq('id', workerId);
      if (error) throw error;
    },
    deleteSettlement: async (settlementId) => {
      const { error } = await supabase.from('worker_settlements').delete().eq('id', settlementId);
      if (error) throw error;
    },
  };
  readonly delegatedLogs: DataAccess['delegatedLogs'] = {
    getProfessionalWorkspace: async () => {
      const { data, error } = await supabase.rpc('get_professional_workspace');
      if (error) throw error;
      return data;
    },
    createDelegatedLog: async (payload) => {
      const { data, error } = await supabase.rpc('create_delegated_log', payload);
      if (error) throw error;
      return data;
    },
    getDelegatedFarmActivity: async (payload) => {
      const { data, error } = await supabase.rpc('get_delegated_farm_activity', payload);
      if (error) throw error;
      return data ?? [];
    },
    updateDelegatedLog: async (payload) => {
      const { data, error } = await supabase.rpc('update_delegated_log', payload);
      if (error) throw error;
      return data;
    },
    deleteDelegatedLog: async (payload) => {
      const { error } = await supabase.rpc('delete_delegated_log', payload);
      if (error) throw error;
    },
  };
}

export const supabaseDataAccess = new SupabaseDataAccess();
