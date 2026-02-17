import i18n from '@/i18n';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '@/lib/supabase';

// ============================================================
// MARK: - Push Token Types
// ============================================================

export interface DevicePushToken {
  id?: number;
  user_id: string;
  expo_push_token: string;
  device_id: string | null;
  device_name: string | null;
  platform: 'ios' | 'android' | 'web';
  created_at?: string;
}

// ============================================================
// MARK: - Notification Permissions
// ============================================================

type ExpoNotifications = typeof Notifications;

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

// ============================================================
// MARK: - Push Token Registration
// ============================================================

/**
 * Get the Expo push token for the current device
 * Returns null if not available or permissions not granted
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    if (__DEV__) {
      console.log('Push notifications require a physical device');
    }
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      if (__DEV__) {
        console.log('Push notification permissions not granted');
      }
      return null;
    }
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    return token.data;
  } catch (error) {
    if (__DEV__) {
      console.log('Error getting Expo push token:', error);
    }
    return null;
  }
}

/**
 * Register or update the device push token in Supabase
 */
export async function registerPushToken(
  userId: string,
  expoPushToken: string,
): Promise<boolean> {
  try {
    const platform: 'ios' | 'android' | 'web' =
      Device.platform?.toLowerCase() === 'ios'
        ? 'ios'
        : Device.platform?.toLowerCase() === 'android'
          ? 'android'
          : 'web';

    const deviceName = Device.modelName || 'Unknown Device';
    const deviceId = Device.osBuildId || Device.deviceId || null;

    // Check if token already exists for this user
    const { data: existing } = await supabase
      .from('device_push_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('expo_push_token', expoPushToken)
      .maybeSingle();

    if (existing) {
      // Token already registered, update last seen
      await supabase
        .from('device_push_tokens')
        .update({ device_name: deviceName, device_id: deviceId })
        .eq('id', existing.id);
      return true;
    }

    // Insert new token
    const { error } = await supabase.from('device_push_tokens').insert({
      user_id: userId,
      expo_push_token: expoPushToken,
      device_id: deviceId,
      device_name: deviceName,
      platform,
    });

    if (error) {
      if (__DEV__) {
        console.log('Error registering push token:', error);
      }
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      console.log('Error in registerPushToken:', error);
    }
    return false;
  }
}

/**
 * Remove push token from Supabase (e.g., when user signs out)
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    await supabase.from('device_push_tokens').delete().eq('user_id', userId);
  } catch (error) {
    if (__DEV__) {
      console.log('Error unregistering push token:', error);
    }
  }
}

/**
 * Send a push notification for a task assignment
 * This calls the Supabase Edge Function to send the notification
 */
export async function notifyTaskAssignment(
  assignedUserId: string,
  taskId: number,
  taskTitle: string,
  assignerName?: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('send-task-notification', {
      body: {
        user_id: assignedUserId,
        task_id: taskId,
        task_title: taskTitle,
        assigner_name: assignerName,
      },
    });

    if (error) {
      if (__DEV__) {
        console.log('Error sending task notification:', error);
      }
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      console.log('Error invoking task notification function:', error);
    }
    return false;
  }
}
