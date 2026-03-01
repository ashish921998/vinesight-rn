import { Platform } from 'react-native';

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
export function createNotificationContent(
  base: Omit<BaseNotificationContent, 'sound'> & { sound?: boolean },
  channelId: string = 'vinesight-reminders',
): ScheduleNotificationInput['content'] {
  return {
    ...base,
    sound: base.sound ?? true,
    ...(Platform.OS === 'android' ? { channelId } : {}),
  } as ScheduleNotificationInput['content'];
}

/**
 * Helper to create a date-based trigger.
 */
export function createDateTrigger(date: Date): NotificationTrigger {
  return { type: 'DATE', date };
}

/**
 * Helper to create a daily trigger.
 * @throws {Error} If hour is not 0-23 or minute is not 0-59
 */
export function createDailyTrigger(hour: number, minute: number): NotificationTrigger {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid hour: ${hour}. Must be an integer between 0 and 23.`);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`Invalid minute: ${minute}. Must be an integer between 0 and 59.`);
  }
  return { type: 'DAILY', hour, minute };
}

/**
 * Helper to create an immediate trigger.
 */
export function createImmediateTrigger(): NotificationTrigger {
  return null;
}
