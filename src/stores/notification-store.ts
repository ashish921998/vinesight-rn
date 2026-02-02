import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

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

  taskSchedules: Record<string, TaskNotificationSchedule>; // taskId -> schedule
}

interface NotificationActions {
  _setHasHydrated: (value: boolean) => void;

  setDailyWaterReminderEnabled: (enabled: boolean) => void;
  setDailyWaterReminderNotificationId: (id: string | null) => void;

  setLowWaterAlertsEnabled: (enabled: boolean) => void;
  setTaskRemindersEnabled: (enabled: boolean) => void;

  upsertTaskSchedule: (taskId: string, schedule: TaskNotificationSchedule) => void;
  removeTaskSchedule: (taskId: string) => void;
  clearAllTaskSchedules: () => void;
}

const isWeb = process.env.EXPO_OS === 'web';

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (isWeb) {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isWeb) {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (isWeb) {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  persist(
    (set) => ({
      hasHydrated: false,

      dailyWaterReminderEnabled: false,
      dailyWaterReminderNotificationId: null,

      lowWaterAlertsEnabled: false,
      taskRemindersEnabled: false,

      taskSchedules: {},

      _setHasHydrated: (value) => set({ hasHydrated: value }),

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
      storage: createJSONStorage(() => storage),
      onRehydrateStorage: () => () => {
        useNotificationStore.setState({ hasHydrated: true });
      },
    },
  ),
);
