import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { supabase } from '@/lib/supabase';
import type { GuidedTourPatchPayload, GuidedTourServerState } from './types';

const GUIDED_TOUR_TABLE = 'user_guided_tour_state';
const PUSH_DEVICES_TABLE = 'user_push_devices';

async function getUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

export async function fetchGuidedTourServerState(): Promise<GuidedTourServerState | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from(GUIDED_TOUR_TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as GuidedTourServerState | null) ?? null;
}

export async function upsertGuidedTourServerState(patch: GuidedTourPatchPayload): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const { error } = await supabase.rpc('upsert_user_guided_tour_state', {
    p_tour_status: patch.tour_status ?? null,
    p_current_step: patch.current_step ?? null,
    p_skipped_at_step: patch.skipped_at_step ?? null,
    p_reminders_sent: patch.reminders_sent ?? null,
    p_tour_started_at: patch.tour_started_at ?? null,
    p_tour_completed_at: patch.tour_completed_at ?? null,
    p_tour_expired_at: patch.tour_expired_at ?? null,
    p_last_active_at: patch.last_active_at ?? null,
    p_active_farm_id: patch.active_farm_id ?? null,
    p_locale: patch.locale ?? null,
    p_tour_version: patch.tour_version ?? null,
  });
  if (error) throw error;
}

export async function registerGuidedTourPushDevice(locale: 'en' | 'hi' | 'mr'): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!Device.isDevice) return;

  const userId = await getUserId();
  if (!userId) return;

  try {
    const Notifications = await import('expo-notifications');
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as typeof Constants & { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const expoPushToken = tokenResult.data;
    if (!expoPushToken) return;

    const { error } = await supabase.from(PUSH_DEVICES_TABLE).upsert(
      {
        user_id: userId,
        expo_push_token: expoPushToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        locale,
        notifications_enabled: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'expo_push_token' },
    );
    if (error) throw error;
  } catch (error) {
    if (__DEV__) {
      console.warn('[guided-tour] push device registration failed', error);
    }
  }
}
