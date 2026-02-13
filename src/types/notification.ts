import type { NotificationResponse } from 'expo-notifications';

/** Notification route targets for deep linking */
export type NotificationRoute =
  | '/tasks'
  | '/water-level'
  | '/weather'
  | '/(tabs)'
  | '/(tabs)/farms'
  | '/(tabs)/workers';

/** Types of notifications the app can send/receive */
export type NotificationType =
  | 'task_due'
  | 'task_assigned'
  | 'water_reminder'
  | 'low_water_alert'
  | 'weather_alert'
  | 'farm_update'
  | 'general';

/** Push notification payload structure (from server) */
export interface NotificationPayload {
  type: NotificationType;
  route?: NotificationRoute;
  /** Entity ID for deep linking (e.g., task ID, farm ID) */
  entityId?: string;
  /** Additional metadata */
  meta?: Record<string, string>;
}

/** Row in the Supabase push_tokens table */
export interface PushTokenRow {
  id: string;
  user_id: string;
  expo_push_token: string;
  device_id: string | null;
  platform: 'ios' | 'android' | 'web';
  created_at: string;
  updated_at: string;
}

/** Insert payload for push_tokens table */
export interface PushTokenInsert {
  user_id: string;
  expo_push_token: string;
  device_id: string | null;
  platform: 'ios' | 'android' | 'web';
}

/** Notification preference keys that can be toggled */
export type NotificationPreferenceKey =
  | 'dailyWaterReminder'
  | 'lowWaterAlerts'
  | 'taskReminders'
  | 'weatherAlerts'
  | 'farmUpdates';

/** Parsed notification response for internal routing */
export interface ParsedNotification {
  type: NotificationType;
  route: NotificationRoute | null;
  entityId: string | null;
  raw: NotificationResponse;
}
