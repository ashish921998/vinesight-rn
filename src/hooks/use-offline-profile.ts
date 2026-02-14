/**
 * Offline Profile Hook
 *
 * PowerSync-backed reactive hook for reading the current user's profile
 * from the local SQLite database. Falls back to Supabase direct queries
 * when PowerSync is not available.
 *
 * Write operations remain in use-profile.ts and go through Supabase.
 */

import { useMemo } from 'react';
import { useQuery as usePowerSyncQuery } from '@powersync/react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { isPowerSyncConfigured } from '../lib/powersync';
import { queryKeys } from './query-keys';
import type { Profile } from '../types';
import { TABLES } from '../types';

// ============================================================
// MARK: - Helper
// ============================================================

async function getUserId(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session) {
    throw new Error('Please sign in to continue');
  }
  return session.user.id;
}

// ============================================================
// MARK: - PowerSync row → Profile type mapper
// ============================================================

/**
 * Maps a PowerSync SQLite row to the Profile interface.
 */
function mapRowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: (row.id as string) ?? '',
    email: (row.email as string) || null,
    full_name: (row.full_name as string) || null,
    username: (row.username as string) || null,
    avatar_url: (row.avatar_url as string) || null,
    phone: (row.phone as string) || null,
    user_type: (row.user_type as Profile['user_type']) || null,
    consultant_organization_id: (row.consultant_organization_id as string) || null,
    currency_preference: (row.currency_preference as Profile['currency_preference']) || null,
    preferred_spacing_unit:
      (row.preferred_spacing_unit as Profile['preferred_spacing_unit']) || null,
    created_at: (row.created_at as string) || null,
    updated_at: (row.updated_at as string) || null,
  };
}

// ============================================================
// MARK: - Offline Profile Hook
// ============================================================

/**
 * Fetch the current user's profile using PowerSync local reads.
 * Automatically falls back to Supabase when PowerSync is unavailable.
 *
 * Replaces direct Supabase `.from('profiles').select('*')` reads
 * with PowerSync watched queries for offline-first reactivity.
 */
export function useOfflineProfile() {
  const powerSyncAvailable = isPowerSyncConfigured();

  // PowerSync local read — reactive, updates when local DB changes
  // Note: PowerSync syncs only the current user's data based on sync rules,
  // so we can select all profiles (there should only be one).
  const psResult = usePowerSyncQuery<Record<string, unknown>>(
    powerSyncAvailable ? 'SELECT * FROM profiles LIMIT 1' : 'SELECT 1 WHERE 0',
    [],
  );

  // Supabase fallback — used when PowerSync is not configured
  const supabaseResult = useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: async (): Promise<Profile | null> => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from(TABLES.PROFILES)
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Profile might not exist yet
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    },
    enabled: !powerSyncAvailable,
  });

  const offlineProfile = useMemo(() => {
    if (!powerSyncAvailable || psResult.data.length === 0) return null;
    return mapRowToProfile(psResult.data[0]);
  }, [powerSyncAvailable, psResult.data]);

  if (powerSyncAvailable) {
    return {
      data: offlineProfile,
      isLoading: psResult.isLoading,
      error: psResult.error ?? null,
      isFetching: psResult.isFetching,
    };
  }

  // Supabase fallback
  return {
    data: supabaseResult.data ?? null,
    isLoading: supabaseResult.isLoading,
    error: supabaseResult.error ?? null,
    isFetching: supabaseResult.isFetching,
  };
}
