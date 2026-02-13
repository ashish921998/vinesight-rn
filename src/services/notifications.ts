import { Platform } from 'react-native';
import { router } from 'expo-router';
import i18n from '@/i18n';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

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

// ============================================================
// MARK: - Permission Helpers
// ============================================================

export async function ensureNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Check if notification permissions have been explicitly denied.
 * Returns 'granted' | 'denied' | 'undetermined' | 'unavailable'
 */
export async function getNotificationPermissionStatus(): Promise<
  'granted' | 'denied' | 'undetermined' | 'unavailable'
> {
  const Notifications = await getNotifications();
  if (!Notifications) return 'unavailable';

  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

// ============================================================
// MARK: - Push Token Registration
// ============================================================

/**
 * Get the Expo push token and register it with the Supabase backend.
 * Associates the token with the currently authenticated user.
 * Handles token refresh by upserting on (user_id, device_token) unique constraint.
 */
export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!isSupabaseConfigured()) return null;

  const Notifications = await getNotifications();
  if (!Notifications) return null;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    const token = tokenData.data;
    if (!token) return null;

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // Upsert the push token to the push_tokens table
    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: user.id,
        device_token: token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_token' },
    );

    if (error) {
      if (__DEV__) {
        console.error('Failed to register push token:', error);
      }
      return null;
    }

    return token;
  } catch (error) {
    if (__DEV__) {
      console.error('Error registering push token:', error);
    }
    return null;
  }
}

/**
 * Remove the push token from the backend (e.g., on sign out).
 */
export async function unregisterPushToken(token: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('device_token', token);
  } catch (error) {
    if (__DEV__) {
      console.error('Error unregistering push token:', error);
    }
  }
}

// ============================================================
// MARK: - Notification Handlers
// ============================================================

/**
 * Set up the foreground notification handler.
 * Shows an alert/banner when a notification arrives while the app is open.
 * Returns a cleanup function.
 */
export async function setupForegroundHandler(): Promise<(() => void) | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  return () => {
    // Reset handler on cleanup
    Notifications.setNotificationHandler(null);
  };
}

/**
 * Set up the notification response handler (when user taps a notification).
 * Deep links to the relevant screen based on notification data.
 * Returns a cleanup function to remove the subscription.
 */
export async function setupNotificationResponseHandler(): Promise<(() => void) | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    if (!data) return;

    try {
      handleNotificationDeepLink(data);
    } catch (error) {
      if (__DEV__) {
        console.error('Error handling notification deep link:', error);
      }
    }
  });

  // Also handle the case where the app was opened from a killed state via notification
  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  if (lastResponse) {
    const data = lastResponse.notification.request.content.data as
      | Record<string, unknown>
      | undefined;
    if (data) {
      // Small delay to ensure navigation is ready
      setTimeout(() => {
        try {
          handleNotificationDeepLink(data);
        } catch (error) {
          if (__DEV__) {
            console.error('Error handling cold-start notification deep link:', error);
          }
        }
      }, 1000);
    }
  }

  return () => {
    subscription.remove();
  };
}

/**
 * Route to the appropriate screen based on notification data.
 */
function handleNotificationDeepLink(data: Record<string, unknown>): void {
  const type = data.type as string | undefined;

  switch (type) {
    case 'task_due': {
      const taskId = data.taskId as string | undefined;
      if (taskId) {
        router.push('/tasks');
      } else {
        router.push('/tasks');
      }
      break;
    }
    case 'low_water': {
      const farmId = data.farmId as string | undefined;
      if (farmId) {
        router.push(`/farm/${farmId}`);
      } else {
        router.push('/(tabs)/farms');
      }
      break;
    }
    case 'daily_water':
      router.push('/water-level');
      break;
    case 'weather_alert':
      router.push('/weather');
      break;
    default:
      // Default: go to dashboard
      router.push('/(tabs)');
      break;
  }
}

// ============================================================
// MARK: - Notification Channel Setup (Android)
// ============================================================

/**
 * Set up the default notification channel for Android.
 */
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

// ============================================================
// MARK: - Local Notification Scheduling
// ============================================================

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
      data: { type: 'daily_water' },
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
