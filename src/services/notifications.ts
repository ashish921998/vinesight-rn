import i18n from '@/i18n';

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

/**
 * Schedules task reminder notifications for a given due date.
 *
 * Strategy:
 * - Day before the due date at 07:00 → "due tomorrow" reminder
 * - Due date itself at 07:00 → "due today" reminder
 * - If the due date is today and 07:00 has already passed → fires an immediate notification
 *
 * Returns an array of scheduled notification IDs (may be empty if all dates are in the past).
 */
export async function scheduleTaskDueReminder(
  taskId: string,
  dueDate: string,
  options?: { allowImmediateToday?: boolean },
): Promise<string[]> {
  const Notifications = await getNotifications();
  if (!Notifications) return [];

  const m = /^\d{4}-\d{2}-\d{2}$/.exec(dueDate);
  if (!m) return [];

  const [y, mo, d] = dueDate.split('-').map((n) => Number(n));

  // Validate date components to prevent rollover (e.g., 2026-02-31 -> Mar 3)
  const check = new Date(y, mo - 1, d);
  if (
    Number.isNaN(check.getTime()) ||
    check.getFullYear() !== y ||
    check.getMonth() !== mo - 1 ||
    check.getDate() !== d
  ) {
    return [];
  }

  const now = Date.now();
  const scheduledIds: string[] = [];

  // --- Notification 1: Day before at 07:00 ---
  const dayBeforeDate = new Date(y, mo - 1, d);
  dayBeforeDate.setDate(dayBeforeDate.getDate() - 1);
  dayBeforeDate.setHours(7, 0, 0, 0);
  if (dayBeforeDate.getTime() > now) {
    const title = i18n.t('notifications.taskDue.title');
    const body = i18n.t('notifications.taskDueTomorrow.body');
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, data: { type: 'task_due_tomorrow', taskId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dayBeforeDate },
      });
      scheduledIds.push(id);
    } catch {
      // If scheduling fails, continue to due-date notification
    }
  }

  // --- Notification 2: Due date at 07:00 ---
  const dueDateAt7 = new Date(y, mo - 1, d, 7, 0, 0);

  if (dueDateAt7.getTime() > now) {
    // Future: schedule normally
    const title = i18n.t('notifications.taskDue.title');
    const body = i18n.t('notifications.taskDue.body');
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, data: { type: 'task_due', taskId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueDateAt7 },
      });
      scheduledIds.push(id);
    } catch {
      // continue
    }
  } else {
    // Past 07:00 on the due date — fire immediately so the user is not silently skipped
    const nowDate = new Date(now);
    const isToday =
      nowDate.getFullYear() === y && nowDate.getMonth() === mo - 1 && nowDate.getDate() === d;

    if (isToday && options?.allowImmediateToday !== false) {
      const title = i18n.t('notifications.taskDue.title');
      const body = i18n.t('notifications.taskDue.body');
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title, body, sound: true, data: { type: 'task_due', taskId } },
          trigger: null, // immediate
        });
        scheduledIds.push(id);
      } catch {
        // continue
      }
    }
    // If the due date is fully in the past (not today), skip silently
  }

  // --- Notification 3: Day after due date at 08:00 (overdue reminder) ---
  const overdueDate = new Date(y, mo - 1, d);
  overdueDate.setDate(overdueDate.getDate() + 1);
  overdueDate.setHours(8, 0, 0, 0);
  if (overdueDate.getTime() > now) {
    const title = i18n.t('notifications.taskOverdue.title');
    const body = i18n.t('notifications.taskOverdue.body');
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, data: { type: 'task_overdue', taskId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: overdueDate },
      });
      scheduledIds.push(id);
    } catch {
      // continue
    }
  }

  return scheduledIds;
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

/**
 * Fires an immediate notification when a warehouse item falls at or below its reorder quantity.
 */
export async function notifyWarehouseReorder(
  itemName: string,
  quantity: number,
  unit: string,
  reorderQty: number,
): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  const title = i18n.t('notifications.warehouseReorder.title');
  const body = i18n.t('notifications.warehouseReorder.body', {
    itemName,
    quantity,
    unit,
    reorderQty,
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: { type: 'warehouse_reorder', itemName },
    },
    trigger: null, // immediate
  });
}

/**
 * Schedules a petiole test reminder for one day before a target pruning milestone.
 * @param farmName  Display name of the farm
 * @param farmId    Stable identifier used in notification data payload
 * @param day       Pruning milestone day: 30 | 60 | 90 | 120
 * @param targetDate  The actual milestone date (YYYY-MM-DD); reminder fires the day before at 07:00
 * @returns The notification ID, or null if the date is already past or invalid
 */
export async function schedulePetioleTestReminder(
  farmName: string,
  farmId: string,
  day: 30 | 60 | 90 | 120,
  targetDate: string,
): Promise<string | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const m = /^\d{4}-\d{2}-\d{2}$/.exec(targetDate);
  if (!m) return null;

  const [y, mo, d] = targetDate.split('-').map((n) => Number(n));

  const target = new Date(y, mo - 1, d);
  if (
    Number.isNaN(target.getTime()) ||
    target.getFullYear() !== y ||
    target.getMonth() !== mo - 1 ||
    target.getDate() !== d
  ) {
    return null;
  }

  const reminderDate = new Date(y, mo - 1, d);
  reminderDate.setDate(reminderDate.getDate() - 1);
  reminderDate.setHours(7, 0, 0, 0);

  if (Number.isNaN(reminderDate.getTime())) return null;

  const now = Date.now();
  const title = i18n.t('notifications.petioleTest.title');
  const body = i18n.t('notifications.petioleTest.body', { farmName, day });
  const content = {
    title,
    body,
    sound: true as const,
    data: { type: 'petiole_test', farmId, day },
  };

  if (reminderDate.getTime() > now) {
    return Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
    });
  }

  // Reminder time already passed — fire immediately if it was today
  const nowDate = new Date(now);
  const isToday =
    nowDate.getFullYear() === reminderDate.getFullYear() &&
    nowDate.getMonth() === reminderDate.getMonth() &&
    nowDate.getDate() === reminderDate.getDate();

  if (isToday) {
    return Notifications.scheduleNotificationAsync({ content, trigger: null });
  }

  return null;
}

/**
 * Sends an immediate notification with any title, body, and optional data payload.
 * Use this to trigger ad-hoc or custom notifications from anywhere in the app.
 *
 * @example
 *   await sendCustomNotification('Harvest reminder', 'Time to check your grapes!', { farmId: '123' });
 */
export async function sendCustomNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<string | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: { type: 'custom', ...data },
    },
    trigger: null, // fires immediately
  });
}
