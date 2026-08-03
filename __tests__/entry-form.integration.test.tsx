/* eslint-disable @typescript-eslint/no-require-imports */
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

jest.mock('@expo/ui/community/datetime-picker', () => {
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

// QuickLogSheet (irrigation/spray/harvest/expense from the type chips) uses the
// native BottomSheet host, which isn't press-traversable under jest. This mock
// renders sheet children as plain views while the sheet is open (index >= 0),
// so the integration tests can drive the sheet's form + Save button.
jest.mock('@expo/ui/community/bottom-sheet', () =>
  require('../jest-setup/expo-ui-bottom-sheet-mock'),
);

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
  // Edit-mode hooks used by QuickLogSheet (farm details edit flow)
  useUpdateIrrigationRecord: () => ({ mutateAsync: jest.fn() }),
  useUpdateSprayRecord: () => ({ mutateAsync: jest.fn() }),
  useUpdateHarvestRecord: () => ({ mutateAsync: jest.fn() }),
  useUpdateExpenseRecord: () => ({ mutateAsync: jest.fn() }),
  useUpdateFertigationRecord: () => ({ mutateAsync: jest.fn() }),
  useUpdateFarmWaterLevel: () => ({ mutateAsync: mockUpdateWaterLevelMutate }),
  useFarms: (...args: unknown[]) => mockUseFarms(...args),
  useProfile: () => ({ data: { area_unit_preference: 'acres' } }),
  useFarmAreaAcres: (area: number | null | undefined) => ({
    preferredAreaUnit: 'acres' as const,
    farmAreaAcres: typeof area === 'number' && Number.isFinite(area) && area > 0 ? area : null,
  }),
  useResponsiveHeight: () => ({ windowHeight: 800 }),
  useWarehouseItems: () => ({ data: [] }),
  useRecentSprayChemicals: () => ({ data: [] }),
  useRecentFertigationItems: () => ({ data: [] }),
  useFarmSeasonStatus: (...args: unknown[]) => mockUseFarmSeasonStatus(...args),
  useChemicalMixSearch: (...args: unknown[]) => mockUseChemicalMixSearch(...args),
  usePhiComputation: (...args: unknown[]) => mockUsePhiComputation(...args),
  useFertilizerPlan: () => ({ data: null, isLoading: false, error: null }),
  useMasterProducts: () => ({ data: [], isLoading: false, error: null }),
  useSprayInputSources: () => ({ quickAddItems: [], historyItems: [], planItems: [] }),
  useFertigationInputSources: () => ({
    quickAddItems: [],
    historyItems: [],
    planItems: [],
    catalogProducts: [],
  }),
  // Saved-record hooks power the week-strip dots + repeat-last-log suggestion.
  useIrrigationRecords: () => ({ data: [] }),
  useSprayRecords: () => ({ data: [] }),
  useHarvestRecords: () => ({ data: [] }),
  useExpenseRecords: () => ({ data: [] }),
  useFertigationRecords: () => ({ data: [] }),
  useDailyNotes: () => ({ data: [] }),
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

jest.mock('@/data-access', () => {
  const dataAccess = {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: mockDailyNoteMaybeSingle,
    })),
  };
  return { getDataAccess: jest.fn(() => dataAccess), supabase: dataAccess };
});

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
    // Default to an active season so save-flow assertions aren't blocked by the
    // no-season gate; tests that exercise the gate override this explicitly.
    mockUseFarmSeasonStatus.mockReturnValue({
      activeSeason: { id: 1, start_date: '2026-01-01', end_date: null, target_harvest_date: null },
      hasActiveSeason: true,
      lastEndedSeason: null,
      needsReview: false,
      isLoading: false,
      hasResolvedSeasons: true,
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

  it('gates saving on a single farm with no active season and offers Start season', async () => {
    mockUseFarmSeasonStatus.mockReturnValue({
      activeSeason: null,
      hasActiveSeason: false,
      lastEndedSeason: null,
      needsReview: false,
      isLoading: false,
      hasResolvedSeasons: true,
      refetch: jest.fn(),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const screen = render(
      <QueryClientProvider client={queryClient}>
        <EntryForm farm={mockFarm} onClose={jest.fn()} tabs={['log']} presentation="screen" />
      </QueryClientProvider>,
    );

    // Start-season CTA is shown instead of letting the log be saved.
    await waitFor(() => {
      expect(screen.getByText('farmDetails.seasons.banner.startSeason')).toBeTruthy();
    });

    // Building an expense draft is gated — the QuickLogSheet's Save stays
    // disabled (no-season gate) so no draft joins the stack and nothing persists.
    fireEvent.press(screen.getAllByText('logs.types.expense')[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('expenseForm.amountPlaceholder')).toBeTruthy();
    });
    fireEvent.press(screen.getAllByText('expenseForm.types.Other')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('expenseForm.amountPlaceholder'), '300');
    // Sheet Save is disabled by the no-season gate — pressing it enqueues
    // nothing, verified by the no-enqueue assertions below.
    fireEvent.press(screen.getByText('quickLog.saveType'));

    expect(screen.queryByText('entryForm.saveLogs')).toBeNull();
    expect(mockCreateExpenseMutate).not.toHaveBeenCalled();
  });

  it('does not block saving until the season lookup is confirmed (loading or errored)', async () => {
    // activeSeason is null both during the in-flight query and when it errors;
    // in either case hasResolvedSeasons is false, so the gate must not block an
    // otherwise-eligible farm.
    mockUseFarmSeasonStatus.mockReturnValue({
      activeSeason: null,
      hasActiveSeason: false,
      lastEndedSeason: null,
      needsReview: false,
      isLoading: false,
      hasResolvedSeasons: false,
      refetch: jest.fn(),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const screen = render(
      <QueryClientProvider client={queryClient}>
        <EntryForm farm={mockFarm} onClose={jest.fn()} tabs={['log']} presentation="screen" />
      </QueryClientProvider>,
    );

    // No Start-season CTA while loading, and a draft can still be built + saved.
    expect(screen.queryByText('farmDetails.seasons.banner.startSeason')).toBeNull();
    fireEvent.press(screen.getAllByText('logs.types.expense')[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('expenseForm.amountPlaceholder')).toBeTruthy();
    });
    fireEvent.press(screen.getAllByText('expenseForm.types.Other')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('expenseForm.amountPlaceholder'), '300');
    // QuickLogSheet Save enqueues the draft onto the stack; the main Save-all
    // button then appears.
    fireEvent.press(screen.getByText('quickLog.saveType'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });
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
    // QuickLogSheet Save enqueues the draft; the main Save-all persists it.
    fireEvent.press(screen.getByText('quickLog.saveType'));

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
      hasResolvedSeasons: true,
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
      // QuickLogSheet renders tank water as a HeroStepper (presets), not the
      // inline NumericInput placeholder. Press the 200L preset to set water.
      expect(screen.getByLabelText('200 sprayForm.waterVolume.unitLiters')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('200 sprayForm.waterVolume.unitLiters'));
    // Mixes are picked through the chemical name typeahead now.
    fireEvent(screen.getByPlaceholderText('sprayForm.chemicals.namePlaceholder'), 'focus', {
      target: null,
    });
    fireEvent.changeText(
      screen.getByPlaceholderText('sprayForm.chemicals.namePlaceholder'),
      'Demo',
    );
    fireEvent.press(screen.getByText('Demo Mix'));

    await waitFor(() => {
      // The selected mix renders as the removable tag above the rows.
      expect(screen.getByText('Demo Mix')).toBeTruthy();
    });

    // QuickLogSheet Save runs the PHI double-confirm (conflict → alert).
    fireEvent.press(screen.getByText('quickLog.saveType'));

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
    // initialLogType='expense' opened the QuickLogSheet — its Save enqueues the draft.
    fireEvent.press(screen.getByText('quickLog.saveType'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('logs.types.expense')[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('expenseForm.amountPlaceholder')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('expenseForm.types.Other')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('expenseForm.amountPlaceholder'), '700');
    // Second expense also opens the QuickLogSheet — enqueue another draft.
    fireEvent.press(screen.getByText('quickLog.saveType'));

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

  it('opens a plan-prefilled spray in the QuickLogSheet with the chemicals seeded', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const screen = render(
      <QueryClientProvider client={queryClient}>
        <EntryForm
          farm={mockFarm}
          onClose={jest.fn()}
          tabs={['log']}
          presentation="screen"
          initialLogType="spray"
          initialLogPrefill={{
            sprayChemicals: [{ name: 'Sulphur WP', quantity: 2.5, unit: 'gm/L' }],
          }}
        />
      </QueryClientProvider>,
    );

    // The shared sheet opens (not the inline modal) with the plan chemical
    // seeded — a complete row renders as a collapsed receipt line.
    await waitFor(() => {
      expect(screen.getByText('quickLog.saveType')).toBeTruthy();
    });
    expect(screen.getByText('Sulphur WP')).toBeTruthy();
    expect(screen.queryByText('entryForm.addEntry')).toBeNull();

    // Water via the HeroStepper preset completes the draft; Save enqueues it.
    fireEvent.press(screen.getByLabelText('200 sprayForm.waterVolume.unitLiters'));
    fireEvent.press(screen.getByText('quickLog.saveType'));

    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });
  });

  it('opens a duration-prefilled irrigation in the QuickLogSheet', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const screen = render(
      <QueryClientProvider client={queryClient}>
        <EntryForm
          farm={mockFarm}
          onClose={jest.fn()}
          tabs={['log']}
          presentation="screen"
          initialLogType="irrigation"
          initialIrrigationDurationHours={2}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('quickLog.saveType')).toBeTruthy();
    });
    // The HeroStepper's hero input carries the seeded duration.
    expect(screen.getByLabelText('irrigationForm.durationUnit').props.value).toBe('2');

    // Duration is already valid — Save enqueues straight away.
    fireEvent.press(screen.getByText('quickLog.saveType'));
    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });
  });

  it('opens a voice-prefilled harvest in the QuickLogSheet', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const screen = render(
      <QueryClientProvider client={queryClient}>
        <EntryForm
          farm={mockFarm}
          onClose={jest.fn()}
          tabs={['log']}
          presentation="screen"
          initialLogType="harvest"
          initialVoiceLogPrefill={{
            type: 'harvest',
            date: '2026-08-02',
            harvest: { quantity: 500, grade: 'A', price: 42, buyer: 'Trader Joe' },
          }}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('quickLog.saveType')).toBeTruthy();
    });
    expect(screen.getByPlaceholderText('harvestForm.quantityPlaceholder').props.value).toBe('500');

    // Quantity + grade are seeded and valid — Save enqueues the draft.
    fireEvent.press(screen.getByText('quickLog.saveType'));
    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });
  });

  it('opens a voice-prefilled expense in the QuickLogSheet for a single farm', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const screen = render(
      <QueryClientProvider client={queryClient}>
        <EntryForm
          farm={mockFarm}
          onClose={jest.fn()}
          tabs={['log']}
          presentation="screen"
          initialLogType="expense"
          initialVoiceLogPrefill={{
            type: 'expense',
            date: '2026-08-02',
            expense: { cost: 300, expenseType: 'labor', remarks: 'Pruning wages' },
          }}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('quickLog.saveType')).toBeTruthy();
    });
    expect(screen.getByPlaceholderText('expenseForm.amountPlaceholder').props.value).toBe('300');

    // Cost is seeded and the mapped type ("labor" → Other) makes it valid —
    // Save enqueues the draft, matching the sibling harvest prefill test.
    fireEvent.press(screen.getByText('quickLog.saveType'));
    await waitFor(() => {
      expect(screen.getByText('entryForm.saveLogs')).toBeTruthy();
    });
  });

  it('keeps a voice-prefilled fertigation on the inline LogForm modal', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const screen = render(
      <QueryClientProvider client={queryClient}>
        <EntryForm
          farm={mockFarm}
          onClose={jest.fn()}
          tabs={['log']}
          presentation="screen"
          initialLogType="fertigation"
          initialVoiceLogPrefill={{
            type: 'fertigation',
            date: '2026-08-02',
            fertigation: {
              waterVolume: null,
              fertilizers: [{ name: 'Urea', quantity: 25, unit: 'kg' }],
            },
          }}
        />
      </QueryClientProvider>,
    );

    // Fertigation is not a quick-log type: the inline modal opens (Add Entry
    // button), the sheet does not, and the fertilizer row is seeded.
    await waitFor(() => {
      expect(screen.getByText('entryForm.addEntry')).toBeTruthy();
    });
    expect(screen.queryByText('quickLog.saveType')).toBeNull();
    expect(screen.getByText('Urea')).toBeTruthy();
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
    // Expense opens the QuickLogSheet — its Save enqueues the draft.
    fireEvent.press(screen.getByText('quickLog.saveType'));

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
