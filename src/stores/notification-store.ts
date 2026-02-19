import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ExpoSecureStoreAdapter } from '@/lib/supabase';

export type TaskNotificationSchedule = {
  notificationIds: string[]; // IDs for day-before and/or due-date notifications
  dueDate: string; // YYYY-MM-DD
};

export type PetioleNotificationSchedule = {
  notificationIds: string[]; // IDs for day 30, 60, 90, 120 reminders
  pruningDate: string; // YYYY-MM-DD — the farm's date_of_pruning at time of scheduling
};

interface NotificationState {
  hasHydrated: boolean;

  dailyWaterReminderEnabled: boolean;
  dailyWaterReminderNotificationId: string | null;

  lowWaterAlertsEnabled: boolean;
  taskRemindersEnabled: boolean;
  warehouseReorderAlertsEnabled: boolean;
  petioleTestRemindersEnabled: boolean;

  taskSchedules: Record<string, TaskNotificationSchedule>; // taskId -> schedule
  petioleTestSchedules: Record<string, PetioleNotificationSchedule>; // farmId -> schedule
}

interface NotificationActions {
  _setHasHydrated: (value: boolean) => void;

  setDailyWaterReminderEnabled: (enabled: boolean) => void;
  setDailyWaterReminderNotificationId: (id: string | null) => void;

  setLowWaterAlertsEnabled: (enabled: boolean) => void;
  setTaskRemindersEnabled: (enabled: boolean) => void;
  setWarehouseReorderAlertsEnabled: (enabled: boolean) => void;
  setPetioleTestRemindersEnabled: (enabled: boolean) => void;

  upsertTaskSchedule: (taskId: string, schedule: TaskNotificationSchedule) => void;
  removeTaskSchedule: (taskId: string) => void;
  clearAllTaskSchedules: () => void;

  upsertPetioleTestSchedule: (farmId: string, schedule: PetioleNotificationSchedule) => void;
  removePetioleTestSchedule: (farmId: string) => void;
  clearAllPetioleTestSchedules: () => void;
}

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  persist(
    (set) => ({
      hasHydrated: false,

      dailyWaterReminderEnabled: false,
      dailyWaterReminderNotificationId: null,

      lowWaterAlertsEnabled: false,
      taskRemindersEnabled: false,
      warehouseReorderAlertsEnabled: false,
      petioleTestRemindersEnabled: false,

      taskSchedules: {},
      petioleTestSchedules: {},

      _setHasHydrated: (value) => set({ hasHydrated: value }),

      setDailyWaterReminderEnabled: (enabled) => set({ dailyWaterReminderEnabled: enabled }),
      setDailyWaterReminderNotificationId: (id) => set({ dailyWaterReminderNotificationId: id }),

      setLowWaterAlertsEnabled: (enabled) => set({ lowWaterAlertsEnabled: enabled }),
      setTaskRemindersEnabled: (enabled) => set({ taskRemindersEnabled: enabled }),
      setWarehouseReorderAlertsEnabled: (enabled) =>
        set({ warehouseReorderAlertsEnabled: enabled }),
      setPetioleTestRemindersEnabled: (enabled) => set({ petioleTestRemindersEnabled: enabled }),

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

      upsertPetioleTestSchedule: (farmId, schedule) =>
        set((state) => ({
          petioleTestSchedules: { ...state.petioleTestSchedules, [farmId]: schedule },
        })),
      removePetioleTestSchedule: (farmId) =>
        set((state) => {
          const next = { ...state.petioleTestSchedules };
          delete next[farmId];
          return { petioleTestSchedules: next };
        }),
      clearAllPetioleTestSchedules: () => set({ petioleTestSchedules: {} }),
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
