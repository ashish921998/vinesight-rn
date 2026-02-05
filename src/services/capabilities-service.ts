import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { EffectiveCapabilitiesResponse } from '@/types';

export async function fetchEffectiveCapabilities(): Promise<EffectiveCapabilitiesResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase.functions.invoke('capabilities', {
    method: 'GET',
  });

  if (error) {
    const message =
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : 'Failed to fetch capabilities';
    throw new Error(message);
  }

  if (!data) {
    throw new Error('Capabilities response missing');
  }

  return data as EffectiveCapabilitiesResponse;
}
