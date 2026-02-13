import { Platform } from 'react-native';
import i18n from '@/i18n';
import type {
  NotificationPayload,
  NotificationType,
  NotificationRoute,
  ParsedNotification,
  PushTokenInsert,
} from '@/types';
import { supabase } from '@/lib/supabase';

type ExpoNotifications = typeof import('expo-notifications');

async function getNotifications(): Promise<ExpoNotifications | null> {
  try {
    return await import('expo-notifications');
  } catch (error) {
    if (__DEV__) {
      console.log('expo-notifications not available:', error);
    }
    return null;
  }
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelNotification(notificationId: string): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function scheduleDailyWaterReminder(): Promise<string | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const title = i18n.t('notifications.dailyWater.title');
  const body = i18n.t('notifications.dailyWater.body');

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    // 07:00 local time daily
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 7, minute: 0 },
  });
}

export async function scheduleTaskDueReminder(
  taskId: string,
  dueDate: string,
): Promise<string | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  // dueDate: YYYY-MM-DD; schedule at 07:00 local time
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(dueDate);
  if (!m) return null;

  const [y, mo, d] = dueDate.split('-').map((n) => Number(n));
  const triggerDate = new Date(y, mo - 1, d, 7, 0, 0);
  if (Number.isNaN(triggerDate.getTime())) return null;

  // Validate date components to prevent rollover (e.g., 2026-02-31 -> Mar 3)
  if (
    triggerDate.getFullYear() !== y ||
    triggerDate.getMonth() !== mo - 1 ||
    triggerDate.getDate() !== d
  ) {
    return null;
  }

  if (triggerDate.getTime() <= Date.now()) return null;

  const title = i18n.t('notifications.taskDue.title');
  const body = i18n.t('notifications.taskDue.body');

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: { type: 'task_due', taskId },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
  });
}

export async function notifyLowWaterAlert(farmName?: string): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  const title = i18n.t('notifications.lowWater.title');
  const baseBody = i18n.t('notifications.lowWater.body');
  const body = farmName ? `${farmName}: ${baseBody}` : baseBody;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: { type: 'low_water' },
    },
    trigger: null,
  });
}

// --- Android Notification Channel ---

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4CAF50',
  });
}

// --- Notification Payload Parsing ---

const ROUTE_MAP: Record<NotificationType, NotificationRoute> = {
  task_due: '/tasks',
  task_assigned: '/tasks',
  water_reminder: '/water-level',
  low_water_alert: '/water-level',
  weather_alert: '/weather',
  farm_update: '/(tabs)/farms',
  general: '/(tabs)',
};

export function parseNotificationPayload(
  response: import('expo-notifications').NotificationResponse,
): ParsedNotification {
  const data = (response.notification.request.content.data ?? {}) as Partial<NotificationPayload>;
  const type: NotificationType = data.type ?? 'general';
  const route: NotificationRoute | null = data.route ?? ROUTE_MAP[type] ?? null;
  const entityId: string | null = data.entityId ?? null;
  return { type, route, entityId, raw: response };
}

// --- Push Token Registration ---

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');
    if (!Device.isDevice) {
      console.warn('[Notifications] Push tokens require a physical device');
      return null;
    }
    const granted = await ensureNotificationPermissions();
    if (!granted) return null;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    });
    return tokenData.data;
  } catch (error) {
    console.error('[Notifications] Failed to get push token:', error);
    return null;
  }
}

export async function registerPushToken(retryCount = 0): Promise<boolean> {
  try {
    const token = await getExpoPushToken();
    if (!token) return false;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[Notifications] No authenticated user for push token registration');
      return false;
    }

    let deviceId: string | null = null;
    try {
      const Device = await import('expo-device');
      deviceId = Device.modelId ?? Device.modelName ?? null;
    } catch {
      // Device info not critical
    }

    const payload: PushTokenInsert = {
      user_id: user.id,
      expo_push_token: token,
      device_id: deviceId,
      platform: Platform.OS as 'ios' | 'android',
    };

    const { error } = await supabase
      .from('push_tokens')
      .upsert(payload, { onConflict: 'user_id,expo_push_token' });

    if (error) {
      throw error;
    }

    console.log('[Notifications] Push token registered successfully');
    return true;
  } catch (error) {
    console.error(
      `[Notifications] Push token registration failed (attempt ${retryCount + 1}):`,
      error,
    );
    if (retryCount < MAX_RETRIES) {
      await delay(RETRY_DELAY_MS * Math.pow(2, retryCount));
      return registerPushToken(retryCount + 1);
    }
    return false;
  }
}

export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (!token) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('push_tokens').delete().eq('user_id', user.id).eq('expo_push_token', token);
  } catch (error) {
    console.error('[Notifications] Failed to unregister push token:', error);
  }
}

// --- Badge Count Management ---

export async function resetBadgeCount(): Promise<void> {
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.error('[Notifications] Failed to reset badge count:', error);
  }
}

export async function incrementBadgeCount(): Promise<void> {
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    const current = await Notifications.getBadgeCountAsync();
    await Notifications.setBadgeCountAsync(current + 1);
  } catch (error) {
    console.error('[Notifications] Failed to increment badge count:', error);
  }
}
