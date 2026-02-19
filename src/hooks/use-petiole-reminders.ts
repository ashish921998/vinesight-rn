import { useEffect } from 'react';
import { useFarms } from '@/hooks/use-farms';
import { useNotificationStore } from '@/stores/notification-store';
import { schedulePetioleTestReminder, cancelNotification } from '@/services/notifications';

const PRUNING_MILESTONES = [30, 60, 90, 120] as const;

/**
 * Adds the given number of days to a YYYY-MM-DD date string.
 * Returns null if the input is not a valid date string.
 */
function addDays(dateStr: string, days: number): string | null {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (!m) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d + days);
  if (Number.isNaN(date.getTime())) return null;
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Hook that manages petiole test reminder scheduling across all farms.
 *
 * When `petioleTestRemindersEnabled` is true, for each farm with a
 * `date_of_pruning`, this hook schedules reminders one day before the
 * Day 30, 60, 90, and 120 milestones. When disabled, all scheduled
 * reminders are cancelled.
 *
 * Call this hook once from `app/_layout.tsx` after authentication.
 */
export function usePetioleTestReminders() {
  const { data: farms } = useFarms();
  const {
    petioleTestRemindersEnabled,
    petioleTestSchedules,
    upsertPetioleTestSchedule,
    removePetioleTestSchedule,
    clearAllPetioleTestSchedules,
  } = useNotificationStore();

  useEffect(() => {
    if (!petioleTestRemindersEnabled) {
      // Cancel all existing petiole reminders
      const allIds = Object.values(petioleTestSchedules).flatMap((s) => s.notificationIds);
      if (allIds.length > 0) {
        Promise.allSettled(allIds.map((id) => cancelNotification(id))).catch(() => {});
        clearAllPetioleTestSchedules();
      }
      return;
    }

    if (!farms || farms.length === 0) return;

    farms.forEach((farm) => {
      const pruningDate = farm.date_of_pruning;
      if (!pruningDate || typeof pruningDate !== 'string') return;

      const farmId = String(farm.id ?? farm.name);

      // Petiole tests are only relevant for grape crops
      if (!farm.crop || farm.crop.toLowerCase() !== 'grape') {
        // If we had previously scheduled reminders for this farm (e.g. crop was changed),
        // cancel them now
        const existing = petioleTestSchedules[farmId];
        if (existing) {
          Promise.allSettled(existing.notificationIds.map((id) => cancelNotification(id))).catch(
            () => {},
          );
          removePetioleTestSchedule(farmId);
        }
        return;
      }

      const existing = petioleTestSchedules[farmId];

      // Skip re-scheduling if pruning date hasn't changed
      if (existing && existing.pruningDate === pruningDate) return;

      // Cancel old notifications for this farm before re-scheduling
      if (existing) {
        Promise.allSettled(existing.notificationIds.map((id) => cancelNotification(id))).catch(
          () => {},
        );
        removePetioleTestSchedule(farmId);
      }

      // Schedule reminders for each milestone
      const schedulingPromises = PRUNING_MILESTONES.map((day) => {
        const targetDate = addDays(pruningDate, day);
        if (!targetDate) return Promise.resolve(null);
        return schedulePetioleTestReminder(farm.name, farmId, day, targetDate);
      });

      Promise.allSettled(schedulingPromises).then((results) => {
        const notificationIds = results
          .filter(
            (r): r is PromiseFulfilledResult<string | null> =>
              r.status === 'fulfilled' && r.value !== null,
          )
          .map((r) => r.value as string);

        if (notificationIds.length > 0) {
          upsertPetioleTestSchedule(farmId, { notificationIds, pruningDate });
        }
      });
    });
  }, [
    petioleTestRemindersEnabled,
    farms,
    petioleTestSchedules,
    upsertPetioleTestSchedule,
    removePetioleTestSchedule,
    clearAllPetioleTestSchedules,
  ]);
}
