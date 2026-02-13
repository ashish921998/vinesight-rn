import { Platform } from 'react-native';
import Constants from 'expo-constants';
import i18n from '@/i18n';

type ExpoNotifications = typeof import('expo-notifications');
type Subscription = { remove: () => void };

const ANDROID_CHANNEL_ID = 'default';

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

/**
 * Set up the foreground notification handler so notifications are displayed
 * even when the app is in the foreground. Must be called once at app startup.
 */
export async function setupNotificationHandler(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Create the default Android notification channel. On Android 8+ notifications
 * are silently dropped without a channel. No-op on iOS/web.
 */
export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const Notifications = await getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to create Android notification channel:', error);
    }
  }
}

/**
 * Register for push notifications and return the Expo push token.
 * Returns null on web or if permissions are not granted.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const Notifications = await getNotifications();
  if (!Notifications) return null;

  try {
    const granted = await ensureNotificationPermissions();
    if (!granted) return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      if (__DEV__) {
        console.error('Missing EAS projectId for push token registration');
      }
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token;
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to register for push notifications:', error);
    }
    return null;
  }
}

/**
 * Add a listener for when a notification is received while the app is foregrounded.
 * Returns a subscription that must be removed on cleanup.
 */
export async function addNotificationReceivedListener(
  callback: (notification: { request: { content: { data: Record<string, unknown> } } }) => void,
): Promise<Subscription | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add a listener for when the user taps on a notification.
 * Returns a subscription that must be removed on cleanup.
 */
export async function addNotificationResponseListener(
  callback: (response: {
    notification: { request: { content: { data: Record<string, unknown> } } };
  }) => void,
): Promise<Subscription | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Clear the app badge count. Call on app foreground to reset badge.
 */
export async function clearBadgeCount(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to clear badge count:', error);
    }
  }
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: true,
      },
    });
    return status === 'granted';
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to request notification permissions:', error);
    }
    return false;
  }
}

export async function cancelNotification(notificationId: string): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to cancel notification:', notificationId, error);
    }
  }
}

export async function scheduleDailyWaterReminder(): Promise<string | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const title = i18n.t('notifications.dailyWater.title');
  const body = i18n.t('notifications.dailyWater.body');

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        ...(Platform.OS === 'android' && { channelId: ANDROID_CHANNEL_ID }),
      },
      // 07:00 local time daily
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 7, minute: 0 },
    });
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to schedule daily water reminder:', error);
    }
    return null;
  }
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

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { type: 'task_due', taskId },
        ...(Platform.OS === 'android' && { channelId: ANDROID_CHANNEL_ID }),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
    });
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to schedule task due reminder:', error);
    }
    return null;
  }
}

export async function notifyLowWaterAlert(farmName?: string): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  const title = i18n.t('notifications.lowWater.title');
  const baseBody = i18n.t('notifications.lowWater.body');
  const body = farmName ? `${farmName}: ${baseBody}` : baseBody;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { type: 'low_water' },
        ...(Platform.OS === 'android' && { channelId: ANDROID_CHANNEL_ID }),
      },
      trigger: null,
    });
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to send low water alert:', error);
    }
  }
}
