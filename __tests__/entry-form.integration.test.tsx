import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { EntryForm } from '@/components/screens/entry-form';
import type { Farm } from '@/types';

const mockCreateIrrigationMutate = jest.fn();
const mockCreateSprayMutate = jest.fn();
const mockCreateHarvestMutate = jest.fn();
const mockCreateExpenseMutate = jest.fn();
const mockCreateFertigationMutate = jest.fn();
const mockUpsertDailyNoteMutate = jest.fn();
const mockDeleteIrrigationMutate = jest.fn();
const mockDeleteSprayMutate = jest.fn();
const mockDeleteHarvestMutate = jest.fn();
const mockDeleteExpenseMutate = jest.fn();
const mockDeleteFertigationMutate = jest.fn();
const mockDeleteDailyNoteMutate = jest.fn();
const mockUpdateWaterLevelMutate = jest.fn();
const mockTaskCreateMutate = jest.fn();
const mockTaskUpdateMutate = jest.fn();
const mockUpsertTaskSchedule = jest.fn();
const mockRemoveTaskSchedule = jest.fn();
const mockUseFarms = jest.fn();
const mockUseFarmSeasonStatus = jest.fn();
const mockUseChemicalMixSearch = jest.fn();
const mockUsePhiComputation = jest.fn();
const mockDailyNoteMaybeSingle = jest.fn();

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
  useUpsertDailyNote: () => ({ mutateAsync: mockUpsertDailyNoteMutate }),
  useDeleteIrrigationRecord: () => ({ mutateAsync: mockDeleteIrrigationMutate }),
  useDeleteSprayRecord: () => ({ mutateAsync: mockDeleteSprayMutate }),
  useDeleteHarvestRecord: () => ({ mutateAsync: mockDeleteHarvestMutate }),
  useDeleteExpenseRecord: () => ({ mutateAsync: mockDeleteExpenseMutate }),
  useDeleteFertigationRecord: () => ({ mutateAsync: mockDeleteFertigationMutate }),
  useDeleteDailyNote: () => ({ mutateAsync: mockDeleteDailyNoteMutate }),
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
  useFertilizerPlan: () => ({ data: null, isLoading: false, error: null }),
  useMasterProducts: () => ({ data: [], isLoading: false, error: null }),
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

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: mockDailyNoteMaybeSingle,
    })),
  },
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
  useAppModeStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ detailedMode: true }),
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
    mockDailyNoteMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockCreateIrrigationMutate.mockResolvedValue({ id: 101 });
    mockCreateSprayMutate.mockResolvedValue({ id: 102 });
    mockCreateHarvestMutate.mockResolvedValue({ id: 103 });
    mockCreateExpenseMutate.mockResolvedValue({ id: 104 });
    mockCreateFertigationMutate.mockResolvedValue({ id: 105 });
    mockUpsertDailyNoteMutate.mockResolvedValue({ id: 106 });
    mockDeleteIrrigationMutate.mockResolvedValue(undefined);
    mockDeleteSprayMutate.mockResolvedValue(undefined);
    mockDeleteHarvestMutate.mockResolvedValue(undefined);
    mockDeleteExpenseMutate.mockResolvedValue(undefined);
    mockDeleteFertigationMutate.mockResolvedValue(undefined);
    mockDeleteDailyNoteMutate.mockResolvedValue(undefined);
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

    fireEvent.press(screen.getAllByText('logs.types.expense')[0]);

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
            catalogMixId: mixId,
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

  it('rolls back all-farms expense saves atomically and retries every farm when one fails', async () => {
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

    fireEvent.press(screen.getAllByText('logs.types.expense')[0]);

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
      expect(screen.getByText('entryForm.saveFailed.inlineTitle')).toBeTruthy();
      expect(screen.getByText('entryForm.saveFailed.inlineBody')).toBeTruthy();
      expect(screen.getByText('entryForm.saveFailed.draftFailed')).toBeTruthy();
      expect(screen.getByText('Farm B failed once')).toBeTruthy();
    });
    expect(alertSpy.mock.calls.some((call) => call[0] === 'entryForm.saveFailed.title')).toBe(
      false,
    );

    // Atomic semantics: the successful Farm A insert must be rolled back.
    await waitFor(() => {
      expect(mockDeleteExpenseMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1010, farmId: 101 }),
      );
    });

    fireEvent.press(screen.getByText('entryForm.retrySaveLogs'));

    await waitFor(() => {
      // 2 from the first attempt (one rolled back) + 2 from the retry (both
      // farms retried because the first attempt was reverted).
      expect(mockCreateExpenseMutate).toHaveBeenCalledTimes(4);
    });

    expect(
      mockCreateExpenseMutate.mock.calls.filter((call) => call[0]?.farm_id === 101),
    ).toHaveLength(2);
    expect(
      mockCreateExpenseMutate.mock.calls.filter((call) => call[0]?.farm_id === 202),
    ).toHaveLength(2);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    alertSpy.mockRestore();
  });

  it('preserves pending save failure state when another draft is queued', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onClose = jest.fn();
    const farmA: Farm = { ...mockFarm, id: 101, name: 'Farm A', crop: 'Mango' };
    const farmB: Farm = { ...mockFarm, id: 202, name: 'Farm B', crop: 'Mango' };
    mockUseFarms.mockReturnValue({ data: [farmA, farmB] });

    mockCreateExpenseMutate.mockImplementation(async (payload: { farm_id: number }) => {
      if (payload.farm_id === 202) {
        throw new Error('Farm B failed once');
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

    fireEvent.press(screen.getAllByText('logs.types.expense')[0]);

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
      expect(screen.getByText('entryForm.saveFailed.inlineTitle')).toBeTruthy();
      expect(screen.getByText('Farm B failed once')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('logs.types.expense')[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('expenseForm.amountPlaceholder')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('expenseForm.types.Other')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('expenseForm.amountPlaceholder'), '700');
    fireEvent.press(screen.getByText('entryForm.addEntry'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveFailed.inlineTitle')).toBeTruthy();
      expect(screen.getByText('entryForm.saveFailed.draftFailed')).toBeTruthy();
      expect(screen.getByText('Farm B failed once')).toBeTruthy();
    });
    expect(alertSpy.mock.calls.some((call) => call[0] === 'entryForm.saveFailed.title')).toBe(
      false,
    );

    alertSpy.mockRestore();
  });

  it('surfaces rollback failure when compensating delete rejects', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onClose = jest.fn();
    const farmA: Farm = { ...mockFarm, id: 101, name: 'Farm A', crop: 'Mango' };
    const farmB: Farm = { ...mockFarm, id: 202, name: 'Farm B', crop: 'Mango' };
    mockUseFarms.mockReturnValue({ data: [farmA, farmB] });

    mockCreateExpenseMutate.mockImplementation(
      async (payload: { farm_id: number; cost: number }) => {
        if (payload.cost === 700) {
          throw new Error('Every farm failed');
        }
        return { id: payload.farm_id * 10 };
      },
    );

    // Make the rollback delete for Farm A fail too. Only the draft that
    // created that Farm A record should receive the rollback warning.
    mockDeleteExpenseMutate.mockImplementation(async () => {
      throw new Error('Delete failed');
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

    fireEvent.press(screen.getAllByText('logs.types.expense')[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('expenseForm.amountPlaceholder')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('expenseForm.types.Other')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('expenseForm.amountPlaceholder'), '500');
    fireEvent.press(screen.getByText('entryForm.addEntry'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('logs.types.expense')[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('expenseForm.amountPlaceholder')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('expenseForm.types.Other')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('expenseForm.amountPlaceholder'), '700');
    fireEvent.press(screen.getByText('entryForm.addEntry'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('entryForm.saveLogs'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveFailed.inlineTitle')).toBeTruthy();
      expect(screen.getAllByText('entryForm.saveFailed.draftFailed')).toHaveLength(2);
      expect(screen.getByText('Delete failed')).toBeTruthy();
      expect(screen.getByText('Every farm failed')).toBeTruthy();
      expect(screen.getAllByText('entryForm.saveFailed.rollbackInlineWarning')).toHaveLength(1);
    });
    expect(alertSpy.mock.calls.some((call) => call[0] === 'entryForm.saveFailed.title')).toBe(
      false,
    );

    alertSpy.mockRestore();
  });

  it('surfaces rollback failure for single-farm drafts when compensating delete rejects', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onClose = jest.fn();
    const farmA: Farm = { ...mockFarm, id: 101, name: 'Farm A', crop: 'Mango' };
    mockUseFarms.mockReturnValue({ data: [farmA] });

    mockCreateExpenseMutate.mockImplementation(async (payload: { cost: number }) => {
      if (payload.cost === 700) {
        throw new Error('Every farm failed');
      }
      return { id: 1010 };
    });

    mockDeleteExpenseMutate.mockImplementation(async () => {
      throw new Error('Delete failed');
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const screen = render(
      <QueryClientProvider client={queryClient}>
        <EntryForm
          farm={farmA}
          onClose={onClose}
          tabs={['log']}
          presentation="screen"
          initialLogType="expense"
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('expenseForm.amountPlaceholder')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('expenseForm.types.Other')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('expenseForm.amountPlaceholder'), '500');
    fireEvent.press(screen.getByText('entryForm.addEntry'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('logs.types.expense')[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('expenseForm.amountPlaceholder')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('expenseForm.types.Other')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('expenseForm.amountPlaceholder'), '700');
    fireEvent.press(screen.getByText('entryForm.addEntry'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('entryForm.saveLogs'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveFailed.inlineTitle')).toBeTruthy();
      expect(screen.getAllByText('entryForm.saveFailed.draftFailed')).toHaveLength(2);
      expect(screen.getByText('Delete failed')).toBeTruthy();
      expect(screen.getByText('Every farm failed')).toBeTruthy();
      // Rollback warning should be present because delete failed.
      expect(screen.getByText('entryForm.saveFailed.rollbackInlineWarning')).toBeTruthy();
    });
    expect(alertSpy.mock.calls.some((call) => call[0] === 'entryForm.saveFailed.title')).toBe(
      false,
    );

    alertSpy.mockRestore();
  });

  it('rolls back a saved note when a later draft fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onClose = jest.fn();

    mockCreateExpenseMutate.mockRejectedValue(new Error('Expense failed'));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const screen = render(
      <QueryClientProvider client={queryClient}>
        <EntryForm
          farm={mockFarm}
          onClose={onClose}
          tabs={['log']}
          presentation="screen"
          initialLogType="note"
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('dailyNoteForm.placeholders.note')).toBeTruthy();
    });

    fireEvent.changeText(
      screen.getByPlaceholderText('dailyNoteForm.placeholders.note'),
      'Scout row 3',
    );
    fireEvent.press(screen.getByText('entryForm.addEntry'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('logs.types.expense')[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('expenseForm.amountPlaceholder')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('expenseForm.types.Other')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('expenseForm.amountPlaceholder'), '700');
    fireEvent.press(screen.getByText('entryForm.addEntry'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('entryForm.saveLogs'));

    await waitFor(() => {
      expect(mockDeleteDailyNoteMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 106, farmId: 17 }),
      );
    });
    expect(screen.getByText('Expense failed')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(alertSpy.mock.calls.some((call) => call[0] === 'entryForm.saveFailed.title')).toBe(
      false,
    );

    alertSpy.mockRestore();
  });
});
