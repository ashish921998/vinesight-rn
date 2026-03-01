/**
 * Platform-specific notification content.
 * Android requires a channelId, iOS does not.
 */
export type BaseNotificationContent = {
  title: string;
  body: string;
  sound: boolean;
  data?: Record<string, unknown>;
};

export type AndroidNotificationContent = BaseNotificationContent & {
  channelId: string;
};

export type NotificationContent = AndroidNotificationContent | BaseNotificationContent;

/**
 * Union type for all trigger types supported by scheduleNotificationAsync.
 */
export type NotificationTrigger =
  | { type: 'DATE'; date: Date }
  | { type: 'DAILY'; hour: number; minute: number }
  | null; // Immediate notification

/**
 * Strongly typed notification schedule input.
 */
export interface ScheduleNotificationInput {
  content: AndroidNotificationContent | BaseNotificationContent;
  trigger: NotificationTrigger;
}

/**
 * Sound configuration for Android notification channels.
 * The expo-notifications types expect a string path, but `true` is valid for default sound.
 */
export type AndroidChannelSound = 'default' | boolean | string;

/**
 * Android notification channel configuration.
 */
export interface AndroidNotificationChannel {
  name: string;
  importance: 'default' | 'high' | 'max' | 'low' | 'min' | 'none' | 'unspecified';
  vibrationPattern?: number[];
  sound?: AndroidChannelSound;
  enableVibrate?: boolean;
  enableLights?: boolean;
  lightColor?: string;
  showBadge?: boolean;
}

/**
 * Helper to create platform-aware notification content.
 */
