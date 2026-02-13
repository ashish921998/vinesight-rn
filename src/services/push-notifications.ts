import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useNotificationStore } from '@/stores/notification-store';

type ExpoNotifications = typeof import('expo-notifications');
type ExpoDevice = typeof import('expo-device');

// ============================================================
// MARK: - Lazy Imports
// ============================================================

async function getNotifications(): Promise<ExpoNotifications | null> {
  try {
    return await import('expo-notifications');
  } catch {
    if (__DEV__) console.log('expo-notifications not available');
    return null;
  }
}

async function getDevice(): Promise<ExpoDevice | null> {
  try {
    return await import('expo-device');
  } catch {
    if (__DEV__) console.log('expo-device not available');
    return null;
  }
}

// ============================================================
// MARK: - Android Notification Channel
// ============================================================

/**
 * Creates a default notification channel for Android 8+.
 * Must be called early in app initialization before any notifications are sent.
 */
export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const Notifications = await getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
      sound: 'default',
    });
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to create Android notification channel:', error);
    }
  }
}

// ============================================================
// MARK: - Push Token Registration with Exponential Backoff
// ============================================================

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

function getBackoffDelay(attempt: number): number {
  const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Registers the Expo push token with Supabase.
 * Retries with exponential backoff on failure.
 */
async function upsertPushToken(userId: string, token: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await supabase.from('user_devices').upsert(
        {
          user_id: userId,
          push_token: token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,push_token' },
      );

      if (error) throw error;

      if (__DEV__) {
        console.log('Push token registered successfully');
      }
      return;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        if (__DEV__) {
          console.error(
            `Failed to register push token after ${MAX_RETRIES + 1} attempts:`,
            error,
          );
        }
        return;
      }

      const delay = getBackoffDelay(attempt);
      if (__DEV__) {
        console.warn(
          `Push token registration attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        );
      }
      await sleep(delay);
    }
  }
}

/**
 * Requests an Expo push token and registers it with Supabase.
 * Should be called after authentication.
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const Notifications = await getNotifications();
  const Device = await getDevice();
  if (!Notifications || !Device) return;

  // Push tokens only work on physical devices
  if (!Device.isDevice) {
    if (__DEV__) {
      console.log('Push notifications require a physical device');
    }
    return;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      if (__DEV__) {
        console.log('Push notification permission not granted');
      }
      return;
    }

    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? 'ede2bb37-3ad0-4503-9522-02bd1539e79b';
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    if (__DEV__) {
      console.log('Expo push token:', token);
    }

    await upsertPushToken(userId, token);
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to get push token:', error);
    }
  }
}

// ============================================================
// MARK: - Deep Linking from Notification Data
// ============================================================

interface NotificationData {
  type?: string;
  taskId?: string;
  farmId?: string;
  screen?: string;
  [key: string]: unknown;
}

/**
 * Navigates to the appropriate screen based on notification data.
 */
function handleDeepLink(data: NotificationData): void {
  try {
    // If a direct screen path is provided, navigate to it
    if (data.screen && typeof data.screen === 'string') {
      router.push(data.screen as never);
      return;
    }

    switch (data.type) {
      case 'task_due':
        if (data.taskId) {
          router.push('/tasks' as never);
        } else {
          router.push('/tasks' as never);
        }
        break;

      case 'low_water':
        if (data.farmId) {
          router.push(`/farm/${data.farmId}` as never);
        } else {
          router.push('/(tabs)' as never);
        }
        break;

      case 'daily_water':
        router.push('/water-level' as never);
        break;

      case 'weather_alert':
        router.push('/weather' as never);
        break;

      default:
        // For unknown notification types, navigate to dashboard
        router.push('/(tabs)' as never);
        break;
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Deep link navigation failed:', error);
    }
  }
}

// ============================================================
// MARK: - Foreground/Background Notification Handlers
// ============================================================

type NotificationSubscription = { remove: () => void };

let foregroundSubscription: NotificationSubscription | null = null;
let responseSubscription: NotificationSubscription | null = null;

/**
 * Sets up notification listeners for foreground and background events.
 * Respects user notification preferences from the notification store.
 * Returns a cleanup function to remove listeners.
 */
export async function setupNotificationHandlers(): Promise<() => void> {
  if (Platform.OS === 'web') return () => {};

  const Notifications = await getNotifications();
  if (!Notifications) return () => {};

  // Clean up any existing subscriptions
  cleanupNotificationHandlers();

  // Foreground handler: called when a notification is received while app is in foreground
  foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
    const data = (notification.request.content.data ?? {}) as NotificationData;
    const notificationType = data.type;

    // Check user preferences before showing the notification
    const state = useNotificationStore.getState();
    let shouldShow = true;

    switch (notificationType) {
      case 'daily_water':
        shouldShow = state.dailyWaterReminderEnabled;
        break;
      case 'low_water':
        shouldShow = state.lowWaterAlertsEnabled;
        break;
      case 'task_due':
        shouldShow = state.taskRemindersEnabled;
        break;
      default:
        // Allow unknown notification types through
        shouldShow = true;
        break;
    }

    if (__DEV__) {
      console.log(
        `Foreground notification received: type=${notificationType}, shouldShow=${shouldShow}`,
      );
    }

    // Set the notification handler behavior for this notification
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: shouldShow,
        shouldShowList: shouldShow,
        shouldPlaySound: shouldShow,
        shouldSetBadge: false,
      }),
    });
  });

  // Background/tap handler: called when user taps on a notification
  responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as NotificationData;

    if (__DEV__) {
      console.log('Notification tapped, data:', data);
    }

    handleDeepLink(data);
  });

  // Set default notification handler for foreground notifications
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Check if app was opened from a notification (cold start)
  try {
    const lastResponse = await Notifications.getLastNotificationResponseAsync();
    if (lastResponse) {
      const data = (lastResponse.notification.request.content.data ?? {}) as NotificationData;
      // Small delay to ensure navigation is ready
      setTimeout(() => handleDeepLink(data), 500);
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to get last notification response:', error);
    }
  }

  return cleanupNotificationHandlers;
}

/**
 * Removes all notification listeners.
 */
export function cleanupNotificationHandlers(): void {
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }
  if (responseSubscription) {
    responseSubscription.remove();
    responseSubscription = null;
  }
}
