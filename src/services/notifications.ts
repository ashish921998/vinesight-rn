import i18n from '@/i18n';

type ExpoNotifications = typeof import('expo-notifications');

let notificationsModule: ExpoNotifications | null = null;

async function getNotifications(): Promise<ExpoNotifications | null> {
  if (notificationsModule) return notificationsModule;
  try {
    notificationsModule = await import('expo-notifications');
    return notificationsModule;
  } catch (error) {
    if (__DEV__) {
      console.log('expo-notifications not available:', error);
    }
    return null;
  }
}

/**
 * Configure the notification handler so that notifications are presented
 * when the app is in the foreground. Must be called once at app startup.
 */
export async function configureNotificationHandler(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
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
      sound: 'default',
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
      sound: 'default',
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
      sound: 'default',
      data: { type: 'low_water' },
    },
    trigger: null,
  });
}
