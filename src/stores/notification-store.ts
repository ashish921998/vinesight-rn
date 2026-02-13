import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ExpoSecureStoreAdapter } from '@/lib/supabase';

export type TaskNotificationSchedule = {
  notificationId: string;
  dueDate: string; // YYYY-MM-DD
};

interface NotificationState {
  hasHydrated: boolean;

  dailyWaterReminderEnabled: boolean;
  dailyWaterReminderNotificationId: string | null;

  lowWaterAlertsEnabled: boolean;
  taskRemindersEnabled: boolean;

  // Push notification category preferences
  vineAlertsEnabled: boolean;
  diseaseDetectionEnabled: boolean;
  weatherAlertsEnabled: boolean;
  generalUpdatesEnabled: boolean;
  harvestRemindersEnabled: boolean;
  irrigationAlertsEnabled: boolean;

  taskSchedules: Record<string, TaskNotificationSchedule>; // taskId -> schedule
}

interface NotificationActions {
  _setHasHydrated: (value: boolean) => void;

  setDailyWaterReminderEnabled: (enabled: boolean) => void;
  setDailyWaterReminderNotificationId: (id: string | null) => void;

  setLowWaterAlertsEnabled: (enabled: boolean) => void;
  setTaskRemindersEnabled: (enabled: boolean) => void;

  // Push notification category preferences
  setVineAlertsEnabled: (enabled: boolean) => void;
  setDiseaseDetectionEnabled: (enabled: boolean) => void;
  setWeatherAlertsEnabled: (enabled: boolean) => void;
  setGeneralUpdatesEnabled: (enabled: boolean) => void;
  setHarvestRemindersEnabled: (enabled: boolean) => void;
  setIrrigationAlertsEnabled: (enabled: boolean) => void;

  upsertTaskSchedule: (taskId: string, schedule: TaskNotificationSchedule) => void;
  removeTaskSchedule: (taskId: string) => void;
  clearAllTaskSchedules: () => void;
}

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  persist(
    (set) => ({
      hasHydrated: false,

      dailyWaterReminderEnabled: false,
      dailyWaterReminderNotificationId: null,

      lowWaterAlertsEnabled: false,
      taskRemindersEnabled: false,

      // Push notification category preferences (default enabled)
      vineAlertsEnabled: true,
      diseaseDetectionEnabled: true,
      weatherAlertsEnabled: true,
      generalUpdatesEnabled: true,
      harvestRemindersEnabled: true,
      irrigationAlertsEnabled: true,

      taskSchedules: {},

      _setHasHydrated: (value) => set({ hasHydrated: value }),

      setDailyWaterReminderEnabled: (enabled) => set({ dailyWaterReminderEnabled: enabled }),
      setDailyWaterReminderNotificationId: (id) => set({ dailyWaterReminderNotificationId: id }),

      setLowWaterAlertsEnabled: (enabled) => set({ lowWaterAlertsEnabled: enabled }),
      setTaskRemindersEnabled: (enabled) => set({ taskRemindersEnabled: enabled }),

      setVineAlertsEnabled: (enabled) => set({ vineAlertsEnabled: enabled }),
      setDiseaseDetectionEnabled: (enabled) => set({ diseaseDetectionEnabled: enabled }),
      setWeatherAlertsEnabled: (enabled) => set({ weatherAlertsEnabled: enabled }),
      setGeneralUpdatesEnabled: (enabled) => set({ generalUpdatesEnabled: enabled }),
      setHarvestRemindersEnabled: (enabled) => set({ harvestRemindersEnabled: enabled }),
      setIrrigationAlertsEnabled: (enabled) => set({ irrigationAlertsEnabled: enabled }),

      upsertTaskSchedule: (taskId, schedule) =>
        set((state) => ({
          taskSchedules: { ...state.taskSchedules, [taskId]: schedule },
        })),
      removeTaskSchedule: (taskId) =>
        set((state) => {
          const next = { ...state.taskSchedules };
          delete next[taskId];
          return { taskSchedules: next };
        }),
      clearAllTaskSchedules: () => set({ taskSchedules: {} }),
    }),
    {
      name: 'vinesight-notifications',
      storage: createJSONStorage(() => ExpoSecureStoreAdapter),
      onRehydrateStorage: () => () => {
        useNotificationStore.setState({ hasHydrated: true });
      },
    },
  ),
);
