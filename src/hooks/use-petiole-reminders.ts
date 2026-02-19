import { useEffect, useRef } from 'react';
import { useFarms } from '@/hooks/use-farms';
import { useNotificationStore } from '@/stores/notification-store';
import { schedulePetioleTestReminder, cancelNotification } from '@/services/notifications';
import { addDays } from '@/utils/date';

const PRUNING_MILESTONES = [30, 60, 90, 120] as const;

function getFarmKey(farm: {
  id?: number | null;
  name: string;
  region: string;
  crop: string;
  latitude?: number | null;
  longitude?: number | null;
}): string {
  if (farm.id != null) {
    return String(farm.id);
  }

  if (__DEV__) {
    console.warn(
      '[usePetioleTestReminders] Farm has no id, using fallback key. Consider ensuring all farms have valid IDs for petiole reminders.',
      { farmName: farm.name, region: farm.region, crop: farm.crop },
    );
  }

  const coordinates =
    farm.latitude != null && farm.longitude != null
      ? `${farm.latitude},${farm.longitude}`
      : 'no-coords';

  return `fallback:${farm.name}:${farm.region}:${farm.crop}:${coordinates}`;
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
  const { petioleTestRemindersEnabled } = useNotificationStore();
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    if (!petioleTestRemindersEnabled) {
      const allIds = Object.values(useNotificationStore.getState().petioleTestSchedules).flatMap(
        (s) => s.notificationIds,
      );
      if (allIds.length > 0) {
        Promise.allSettled(allIds.map((id) => cancelNotification(id))).catch(() => {});
        useNotificationStore.getState().clearAllPetioleTestSchedules();
      }
      return;
    }

    if (!farms) return;

    const activeFarmIds = new Set(farms.map((farm) => getFarmKey(farm)));
    const existingSchedules = useNotificationStore.getState().petioleTestSchedules;
    const orphanFarmIds = Object.keys(existingSchedules).filter(
      (farmId) => !activeFarmIds.has(farmId),
    );
    if (orphanFarmIds.length > 0) {
      orphanFarmIds.forEach((farmId) => {
        const orphan = existingSchedules[farmId];
        Promise.allSettled(orphan.notificationIds.map((id) => cancelNotification(id))).catch(
          () => {},
        );
        useNotificationStore.getState().removePetioleTestSchedule(farmId);
      });
    }

    if (farms.length === 0) return;

    farms.forEach((farm) => {
      const farmId = getFarmKey(farm);
      const pruningDate = farm.date_of_pruning;
      if (!pruningDate || typeof pruningDate !== 'string') {
        const existing = useNotificationStore.getState().petioleTestSchedules[farmId];
        if (existing) {
          Promise.allSettled(existing.notificationIds.map((id) => cancelNotification(id))).catch(
            () => {},
          );
          useNotificationStore.getState().removePetioleTestSchedule(farmId);
        }
        return;
      }

      if (!farm.crop || farm.crop.toLowerCase() !== 'grape') {
        const existing = useNotificationStore.getState().petioleTestSchedules[farmId];
        if (existing) {
          Promise.allSettled(existing.notificationIds.map((id) => cancelNotification(id))).catch(
            () => {},
          );
          useNotificationStore.getState().removePetioleTestSchedule(farmId);
        }
        return;
      }

      const existing = useNotificationStore.getState().petioleTestSchedules[farmId];

      if (existing && existing.pruningDate === pruningDate) return;

      if (existing) {
        Promise.allSettled(existing.notificationIds.map((id) => cancelNotification(id))).catch(
          () => {},
        );
        useNotificationStore.getState().removePetioleTestSchedule(farmId);
      }

      const schedulingPromises = PRUNING_MILESTONES.map((day) => {
        const targetDate = addDays(pruningDate, day);
        if (!targetDate) return Promise.resolve(null);
        return schedulePetioleTestReminder(farm.name, farmId, day, targetDate);
      });

      Promise.allSettled(schedulingPromises).then((results) => {
        if (cancelledRef.current || !useNotificationStore.getState().petioleTestRemindersEnabled) {
          return;
        }

        const notificationIds = results
          .filter(
            (r): r is PromiseFulfilledResult<string | null> =>
              r.status === 'fulfilled' && r.value !== null,
          )
          .map((r) => r.value as string);

        if (notificationIds.length > 0) {
          useNotificationStore.getState().upsertPetioleTestSchedule(farmId, {
            notificationIds,
            pruningDate,
            farmName: farm.name,
          });
        }
      });
    });

    return () => {
      cancelledRef.current = true;
    };
  }, [petioleTestRemindersEnabled, farms]);
}
