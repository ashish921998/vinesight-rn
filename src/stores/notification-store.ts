import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ExpoSecureStoreAdapter } from '@/lib/supabase';

export type TaskNotificationSchedule = {
  notificationId: string;
  dueDate: string; // YYYY-MM-DD
};

interface NotificationState {
  hasHydrated: boolean;

  expoPushToken: string | null;

  dailyWaterReminderEnabled: boolean;
  dailyWaterReminderNotificationId: string | null;

  lowWaterAlertsEnabled: boolean;
  taskRemindersEnabled: boolean;

  taskSchedules: Record<string, TaskNotificationSchedule>; // taskId -> schedule
}

interface NotificationActions {
  _setHasHydrated: (value: boolean) => void;

  setExpoPushToken: (token: string | null) => void;

  setDailyWaterReminderEnabled: (enabled: boolean) => void;
  setDailyWaterReminderNotificationId: (id: string | null) => void;

  setLowWaterAlertsEnabled: (enabled: boolean) => void;
  setTaskRemindersEnabled: (enabled: boolean) => void;

  upsertTaskSchedule: (taskId: string, schedule: TaskNotificationSchedule) => void;
  removeTaskSchedule: (taskId: string) => void;
  clearAllTaskSchedules: () => void;
}

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  persist(
    (set) => ({
      hasHydrated: false,

      expoPushToken: null,

      dailyWaterReminderEnabled: false,
      dailyWaterReminderNotificationId: null,

      lowWaterAlertsEnabled: false,
      taskRemindersEnabled: false,

      taskSchedules: {},

      _setHasHydrated: (value) => set({ hasHydrated: value }),

      setExpoPushToken: (token) => set({ expoPushToken: token }),

      setDailyWaterReminderEnabled: (enabled) => set({ dailyWaterReminderEnabled: enabled }),
      setDailyWaterReminderNotificationId: (id) => set({ dailyWaterReminderNotificationId: id }),

      setLowWaterAlertsEnabled: (enabled) => set({ lowWaterAlertsEnabled: enabled }),
      setTaskRemindersEnabled: (enabled) => set({ taskRemindersEnabled: enabled }),

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
