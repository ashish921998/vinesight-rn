import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { supabase } from '@/lib/supabase';
import { telemetry } from '@/services/telemetry';
import type { GuidedTourPatchPayload, GuidedTourServerState } from './types';

const GUIDED_TOUR_TABLE = 'user_guided_tour_state';
const PUSH_DEVICES_TABLE = 'user_push_devices';
const FARMS_TABLE = 'farms';
const SUPPORTED_PUSH_LOCALES = ['en', 'hi', 'mr'] as const;

export type PushDeviceLocale = (typeof SUPPORTED_PUSH_LOCALES)[number];

interface PushDeviceSyncOptions {
  notificationsEnabled?: boolean;
  featureOverviewEnabled?: boolean;
}

function getDeviceTimezone(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
    return timezone ? timezone : null;
  } catch {
    return null;
  }
}

async function getExpoPushToken(): Promise<string | null> {
  const Notifications = await import('expo-notifications');
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as typeof Constants & { easConfig?: { projectId?: string } }).easConfig?.projectId;

  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  return tokenResult.data || null;
}

function normalizePushLocale(locale: string): PushDeviceLocale {
  if ((SUPPORTED_PUSH_LOCALES as readonly string[]).includes(locale)) {
    return locale as PushDeviceLocale;
  }
  return 'en';
}

async function updatePushDeviceRow(
  userId: string,
  expoPushToken: string,
  locale: PushDeviceLocale,
  options: PushDeviceSyncOptions,
): Promise<void> {
  const now = new Date().toISOString();
  const timezone = getDeviceTimezone();
  const featureOverviewEnabled = options.featureOverviewEnabled ?? true;
  const notificationsEnabled = options.notificationsEnabled ?? true;

  const { data: existingRow, error: existingError } = await supabase
    .from(PUSH_DEVICES_TABLE)
    .select('id,feature_overview_started_at')
    .eq('user_id', userId)
    .eq('expo_push_token', expoPushToken)
    .maybeSingle();

  if (existingError) throw existingError;

  const featureOverviewStartedAt =
    featureOverviewEnabled && !existingRow?.feature_overview_started_at ? now : undefined;

  if (existingRow?.id) {
    const { error } = await supabase
      .from(PUSH_DEVICES_TABLE)
      .update({
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        locale,
        timezone,
        notifications_enabled: notificationsEnabled,
        feature_overview_enabled: featureOverviewEnabled,
        last_seen_at: now,
        updated_at: now,
        ...(featureOverviewStartedAt
          ? { feature_overview_started_at: featureOverviewStartedAt }
          : {}),
      })
      .eq('id', existingRow.id)
      .eq('user_id', userId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from(PUSH_DEVICES_TABLE).insert({
    user_id: userId,
    expo_push_token: expoPushToken,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    locale,
    timezone,
    notifications_enabled: notificationsEnabled,
    feature_overview_enabled: featureOverviewEnabled,
    feature_overview_started_at: featureOverviewEnabled ? now : null,
    last_seen_at: now,
    updated_at: now,
  });

  if (error) throw error;
}

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
    p_clear_nullable_fields: patch.clear_nullable_fields ?? false,
  });
  if (error) throw error;
}

export async function userHasAnyFarms(): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;
  const { data, error } = await supabase
    .from(FARMS_TABLE)
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function syncPushDeviceRegistration(
  locale: string,
  options: PushDeviceSyncOptions = {},
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!Device.isDevice) return false;

  try {
    // getUserId() calls supabase.auth.getSession(), which can reject. Keep it
    // inside the try so this function never throws — callers fire-and-forget it.
    const userId = await getUserId();
    if (!userId) return false;

    const expoPushToken = await getExpoPushToken();
    if (!expoPushToken) return false;

    await updatePushDeviceRow(userId, expoPushToken, normalizePushLocale(locale), options);
    return true;
  } catch (error) {
    telemetry.capture('guided_tour_push_registration_failed', {
      context: 'syncPushDeviceRegistration',
    });
    if (__DEV__) {
      console.warn('[guided-tour] push device registration failed', error);
    }
    return false;
  }
}

export async function updatePushDevicePreferences(
  locale: string,
  options: PushDeviceSyncOptions,
): Promise<boolean> {
  return syncPushDeviceRegistration(locale, options);
}

export async function registerGuidedTourPushDevice(locale: PushDeviceLocale): Promise<void> {
  await syncPushDeviceRegistration(locale, {
    notificationsEnabled: true,
  });
}
