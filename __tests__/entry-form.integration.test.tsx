import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
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
const mockUseFarms = jest.fn();
const mockUseFarmSeasonStatus = jest.fn();
const mockUseChemicalMixSearch = jest.fn();
const mockUsePhiComputation = jest.fn();

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
  useFarms: (...args: unknown[]) => mockUseFarms(...args),
  useProfile: () => ({ data: { area_unit_preference: 'acres' } }),
  useResponsiveHeight: () => ({ windowHeight: 800 }),
  useWarehouseItems: () => ({ data: [] }),
  useRecentSprayChemicals: () => ({ data: [] }),
  useRecentFertigationItems: () => ({ data: [] }),
  useFarmSeasonStatus: (...args: unknown[]) => mockUseFarmSeasonStatus(...args),
  useChemicalMixSearch: (...args: unknown[]) => mockUseChemicalMixSearch(...args),
  usePhiComputation: (...args: unknown[]) => mockUsePhiComputation(...args),
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
    mockUseFarms.mockReturnValue({ data: [] });
    mockUseFarmSeasonStatus.mockReturnValue({
      activeSeason: null,
      hasActiveSeason: false,
      lastEndedSeason: null,
      needsReview: false,
      isLoading: false,
      refetch: jest.fn(),
    });
    mockUseChemicalMixSearch.mockReturnValue({ data: [], isLoading: false });
    mockUsePhiComputation.mockReturnValue({ data: null, isLoading: false, error: null });
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
      expect(screen.getByPlaceholderText('expenseForm.amountPlaceholder')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('expenseForm.types.Other')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('expenseForm.amountPlaceholder'), '300');
    fireEvent.press(screen.getByText('entryForm.addEntry'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('entryForm.saveLogs'));

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

  it('shows hard-stop alert when spray PHI safe date exceeds target harvest date', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockUseFarmSeasonStatus.mockReturnValue({
      activeSeason: {
        id: 52,
        farm_id: 17,
        target_harvest_date: '2026-02-10',
      },
      hasActiveSeason: true,
      lastEndedSeason: null,
      needsReview: false,
      isLoading: false,
      refetch: jest.fn(),
    });
    mockUseChemicalMixSearch.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: 991,
          name: 'Demo Mix',
          target_problem: 'Downy mildew',
          application_mode: 'preventive',
          source_page: 1,
          is_active: true,
          components: [
            {
              id: 1,
              mix_id: 991,
              product_id: 11,
              product_name: 'Lannate',
              active_ingredient: 'Methomyl',
              dose_value: 1,
              dose_unit: 'gm',
              dose_basis: 'per_liter',
              base_tank_liters: null,
              phi_days: 14,
              phi_source: 'Label',
            },
          ],
        },
      ],
    });
    mockUsePhiComputation.mockImplementation((mixId: number | null) => ({
      isLoading: false,
      error: null,
      data: mixId
        ? {
            catalogMixId: 991,
            sprayDate: '2026-02-01',
            governingPhiDays: 20,
            safeHarvestDate: '2026-02-20',
            blockingComponentName: 'Lannate',
            phiStatus: 'verified',
          }
        : null,
    }));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const screen = render(
      <QueryClientProvider client={queryClient}>
        <EntryForm farm={mockFarm} onClose={jest.fn()} tabs={['log']} presentation="screen" />
      </QueryClientProvider>,
    );

    fireEvent.press(screen.getByText('logs.types.spray'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('sprayForm.waterVolume.placeholder')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('sprayForm.waterVolume.placeholder'), '200');
    fireEvent.press(screen.getByText('sprayForm.catalogOnly.title'));
    fireEvent.press(screen.getByText('Demo Mix'));

    await waitFor(() => {
      expect(screen.getByText('sprayForm.catalogOnly.selectedMix')).toBeTruthy();
    });

    // Flush pending effects so PHI computation syncs to sprayData
    await act(async () => {});

    fireEvent.press(screen.getByText('entryForm.addEntry'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'entryForm.phiErrors.conflictTitle',
        'entryForm.phiErrors.conflictBody',
        expect.any(Array),
      );
    });
    expect(mockCreateSprayMutate).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('retries all-farms expense only for farms that previously failed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onClose = jest.fn();
    const farmA: Farm = { ...mockFarm, id: 101, name: 'Farm A', crop: 'Mango' };
    const farmB: Farm = { ...mockFarm, id: 202, name: 'Farm B', crop: 'Mango' };
    mockUseFarms.mockReturnValue({ data: [farmA, farmB] });

    let farmBAttempts = 0;
    mockCreateExpenseMutate.mockImplementation(async (payload: { farm_id: number }) => {
      if (payload.farm_id === 202 && farmBAttempts === 0) {
        farmBAttempts += 1;
        throw new Error('Farm B failed once');
      }
      if (payload.farm_id === 202) {
        farmBAttempts += 1;
      }
      return { id: payload.farm_id * 10 };
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const screen = render(
      <QueryClientProvider client={queryClient}>
        <EntryForm onClose={onClose} tabs={['log']} presentation="screen" initialApplyToAllFarms />
      </QueryClientProvider>,
    );

    fireEvent.press(screen.getByText('logs.types.expense'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('expenseForm.amountPlaceholder')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('expenseForm.types.Other')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('expenseForm.amountPlaceholder'), '500');
    fireEvent.press(screen.getByText('entryForm.addEntry'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('entryForm.saveLogs'));

    await waitFor(() => {
      expect(mockCreateExpenseMutate).toHaveBeenCalledTimes(2);
    });

    expect(mockCreateExpenseMutate.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ farm_id: 101, cost: 500 }),
    );
    expect(mockCreateExpenseMutate.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ farm_id: 202, cost: 500 }),
    );

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'entryForm.partialSuccess.title',
        'entryForm.partialSuccess.body_one',
      );
    });

    fireEvent.press(screen.getByText('entryForm.saveLogs'));

    await waitFor(() => {
      expect(mockCreateExpenseMutate).toHaveBeenCalledTimes(3);
    });

    expect(mockCreateExpenseMutate.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({ farm_id: 202, cost: 500 }),
    );
    expect(
      mockCreateExpenseMutate.mock.calls.filter((call) => call[0]?.farm_id === 101),
    ).toHaveLength(1);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    alertSpy.mockRestore();
  });
});
