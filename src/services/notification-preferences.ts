import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { NotificationCategoryPreferences } from '@/stores/notification-store';

const TABLE = 'user_notification_preferences';

/**
 * Fetches notification category preferences from Supabase for the given user.
 * Returns `null` if no server record exists or Supabase is not configured.
 */
export async function fetchNotificationPreferences(
  userId: string,
): Promise<NotificationCategoryPreferences | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        'vine_alerts_enabled, disease_detection_enabled, weather_alerts_enabled, general_updates_enabled, harvest_reminders_enabled, irrigation_alerts_enabled',
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (__DEV__) console.error('Failed to fetch notification preferences:', error);
      return null;
    }

    if (!data) return null;

    return {
      vineAlertsEnabled: data.vine_alerts_enabled ?? true,
      diseaseDetectionEnabled: data.disease_detection_enabled ?? true,
      weatherAlertsEnabled: data.weather_alerts_enabled ?? true,
      generalUpdatesEnabled: data.general_updates_enabled ?? true,
      harvestRemindersEnabled: data.harvest_reminders_enabled ?? true,
      irrigationAlertsEnabled: data.irrigation_alerts_enabled ?? true,
    };
  } catch (error) {
    if (__DEV__) console.error('Failed to fetch notification preferences:', error);
    return null;
  }
}

/**
 * Upserts notification category preferences to Supabase for the given user.
 */
export async function upsertNotificationPreferences(
  userId: string,
  prefs: NotificationCategoryPreferences,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const { error } = await supabase.from(TABLE).upsert(
      {
        user_id: userId,
        vine_alerts_enabled: prefs.vineAlertsEnabled,
        disease_detection_enabled: prefs.diseaseDetectionEnabled,
        weather_alerts_enabled: prefs.weatherAlertsEnabled,
        general_updates_enabled: prefs.generalUpdatesEnabled,
        harvest_reminders_enabled: prefs.harvestRemindersEnabled,
        irrigation_alerts_enabled: prefs.irrigationAlertsEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      if (__DEV__) console.error('Failed to upsert notification preferences:', error);
    }
  } catch (error) {
    if (__DEV__) console.error('Failed to upsert notification preferences:', error);
  }
}
