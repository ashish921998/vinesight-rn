import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ExpoSecureStoreAdapter } from '@/lib/supabase';

export interface TaskNotificationSchedule {
  notificationIds: string[];
  dueDate: string;
}

export interface PetioleNotificationSchedule {
  notificationIds: string[];
  pruningDate: string;
  farmName?: string;
}

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

  notifiedWarehouseItemIds: Set<string | number>;
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

  addNotifiedWarehouseItemId: (id: string | number) => void;
  removeNotifiedWarehouseItemId: (id: string | number) => void;
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
      notifiedWarehouseItemIds: new Set(),

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

      addNotifiedWarehouseItemId: (id) =>
        set((state) => {
          const next = new Set(state.notifiedWarehouseItemIds);
          next.add(id);
          return { notifiedWarehouseItemIds: next };
        }),
      removeNotifiedWarehouseItemId: (id) =>
        set((state) => {
          const next = new Set(state.notifiedWarehouseItemIds);
          next.delete(id);
          return { notifiedWarehouseItemIds: next };
        }),
    }),
    {
      name: 'vinesight-notifications',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (!state) return persistedState;
        if (version < 1) {
          const migrateSchedules = (key: string) => {
            if (state[key] && typeof state[key] === 'object') {
              const schedules = state[key] as Record<string, Record<string, unknown>>;
              for (const id in schedules) {
                const schedule = schedules[id];
                if (
                  'notificationId' in schedule &&
                  !('notificationIds' in schedule) &&
                  typeof schedule.notificationId === 'string'
                ) {
                  schedule.notificationIds = schedule.notificationId
                    ? [schedule.notificationId]
                    : [];
                  delete schedule.notificationId;
                }
              }
            }
          };
          migrateSchedules('taskSchedules');
          migrateSchedules('petioleTestSchedules');
        }
        if (version < 2) {
          state.notifiedWarehouseItemIds = new Set();
        }
        return state as unknown as NotificationState & NotificationActions;
      },
      storage: createJSONStorage(() => ExpoSecureStoreAdapter, {
        reviver: (key, value) => {
          if (key === 'notifiedWarehouseItemIds' && Array.isArray(value)) {
            return new Set(value);
          }
          return value;
        },
        replacer: (key, value) => {
          if (key === 'notifiedWarehouseItemIds' && value instanceof Set) {
            return Array.from(value);
          }
          return value;
        },
      }),
      onRehydrateStorage: () => () => {
        useNotificationStore.setState({ hasHydrated: true });
      },
    },
  ),
);
