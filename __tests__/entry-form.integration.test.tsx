import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EntryForm } from '@/components/screens/entry-form';
import type { Farm } from '@/types';

const mockCreateIrrigationMutate = jest.fn();
const mockCreateSprayMutate = jest.fn();
const mockCreateHarvestMutate = jest.fn();
const mockCreateExpenseMutate = jest.fn();
const mockCreateFertigationMutate = jest.fn();
const mockUpdateWaterLevelMutate = jest.fn();
const mockTaskCreateMutate = jest.fn();
const mockTaskUpdateMutate = jest.fn();
const mockUpsertTaskSchedule = jest.fn();
const mockRemoveTaskSchedule = jest.fn();

jest.mock('react-i18next', () => {
  const actual = jest.requireActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  return function MockDateTimePicker() {
    return null;
  };
});

jest.mock('expo-linear-gradient', () => {
  const mockReact = jest.requireActual('react');
  return {
    LinearGradient: ({ children, ...props }: { children: unknown }) =>
      mockReact.createElement('View', props, children),
  };
});

jest.mock('@/hooks', () => ({
  useCreateIrrigationRecord: () => ({ mutateAsync: mockCreateIrrigationMutate }),
  useCreateSprayRecord: () => ({ mutateAsync: mockCreateSprayMutate }),
  useCreateHarvestRecord: () => ({ mutateAsync: mockCreateHarvestMutate }),
  useCreateExpenseRecord: () => ({ mutateAsync: mockCreateExpenseMutate }),
  useCreateFertigationRecord: () => ({ mutateAsync: mockCreateFertigationMutate }),
  useUpdateFarmWaterLevel: () => ({ mutateAsync: mockUpdateWaterLevelMutate }),
  useFarms: () => ({ data: [] }),
  useProfile: () => ({ data: { area_unit_preference: 'acres' } }),
  useWarehouseItems: () => ({ data: [] }),
  useRecentSprayChemicals: () => ({ data: [] }),
  useRecentFertigationItems: () => ({ data: [] }),
  queryKeys: {
    dashboard: {
      all: ['dashboard'],
    },
  },
}));

jest.mock('@/hooks/use-tasks', () => ({
  useCreateTask: () => ({ mutateAsync: mockTaskCreateMutate, isPending: false }),
  useUpdateTask: () => ({ mutateAsync: mockTaskUpdateMutate, isPending: false }),
}));

jest.mock('@/stores', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: {
        id: 'test-user',
        user_metadata: { area_unit: 'acres' },
      },
    }),
  useNotificationStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      taskRemindersEnabled: false,
      taskSchedules: {},
      upsertTaskSchedule: mockUpsertTaskSchedule,
      removeTaskSchedule: mockRemoveTaskSchedule,
    }),
}));

jest.mock('@/services/telemetry', () => ({
  telemetry: {
    capture: jest.fn(),
  },
}));

jest.mock('@/services/notifications', () => ({
  ensureNotificationPermissions: jest.fn().mockResolvedValue(false),
  scheduleTaskDueReminder: jest.fn(),
  cancelNotification: jest.fn(),
}));

jest.mock('@/utils/haptics', () => ({
  triggerHapticSuccess: jest.fn(),
}));

const mockFarm: Farm = {
  id: 17,
  name: 'Demo Farm',
  region: 'Nashik',
  area: 4,
  crop: 'Grapes',
  crop_variety: 'Thompson',
  planting_date: '2023-01-10',
  total_tank_capacity: 1000,
  system_discharge: 50,
  remaining_water: 350,
  date_of_pruning: '2026-01-01',
};

describe('EntryForm UI integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateIrrigationMutate.mockResolvedValue({ id: 101 });
    mockCreateSprayMutate.mockResolvedValue({ id: 102 });
    mockCreateHarvestMutate.mockResolvedValue({ id: 103 });
    mockCreateExpenseMutate.mockResolvedValue({ id: 104 });
    mockCreateFertigationMutate.mockResolvedValue({ id: 105 });
    mockUpdateWaterLevelMutate.mockResolvedValue({});
    mockTaskCreateMutate.mockResolvedValue({ id: 201 });
    mockTaskUpdateMutate.mockResolvedValue({ id: 202 });
  });

  it('submits expense log from UI with normalized backend expense type', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const onClose = jest.fn();

    const screen = render(
      <QueryClientProvider client={queryClient}>
        <EntryForm farm={mockFarm} onClose={onClose} tabs={['log']} presentation="screen" />
      </QueryClientProvider>,
    );

    fireEvent.press(screen.getByText('logs.types.expense'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter amount')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('Other')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('Enter amount'), '300');
    fireEvent.press(screen.getByText('entryForm.addEntry'));

    await waitFor(() => {
      expect(screen.getByText('common.save')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('common.save'));

    await waitFor(() => {
      expect(mockCreateExpenseMutate).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateExpenseMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 17,
        type: 'other',
        cost: 300,
      }),
    );

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
