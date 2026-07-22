import React from 'react';
import { render } from '@testing-library/react-native';

import { ReceiptLogScreen } from '@/components/screens/receipt-log-screen';

// --- Boundary mocks: keep the test focused on the auto-open behavior ---

// Each form renders a detectable marker so we can assert which sheet is open.
jest.mock('@/components/forms', () => {
  const ReactActual = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  const marker = (id: string) => {
    const Marker = () => ReactActual.createElement(RN.Text, { testID: id }, id);
    Marker.displayName = id;
    return Marker;
  };
  return {
    IrrigationForm: marker('irrigation-form'),
    SprayForm: marker('spray-form'),
    HarvestForm: marker('harvest-form'),
    ExpenseForm: marker('expense-form'),
    FertigationForm: marker('fertigation-form'),
    NoteForm: marker('note-form'),
    validateIrrigationForm: () => true,
    validateSprayForm: () => true,
    validateHarvestForm: () => true,
    validateExpenseForm: () => true,
    validateFertigationForm: () => true,
    validateNoteForm: () => true,
    createEmptySprayFormData: () => ({ chemicals: [], waterVolume: 0 }),
    createEmptyHarvestFormData: () => ({}),
    createEmptyExpenseFormData: () => ({}),
    createEmptyFertigationFormData: () => ({ fertilizers: [] }),
    createEmptyNoteFormData: () => ({ notes: '' }),
  };
});

const mockOpenSheetSaveLog = jest.fn();
jest.mock('@/features/entry-log-session', () => ({
  useSaveSingleLog: () => mockOpenSheetSaveLog,
}));

jest.mock('@/hooks', () => ({
  useFarm: () => ({ data: { id: 1, name: 'Farm A', area: 2 } }),
  useFarmAreaAcres: () => ({ preferredAreaUnit: 'acre', farmAreaAcres: 2 }),
  useDeleteIrrigationRecord: () => ({ mutateAsync: jest.fn() }),
  useDeleteSprayRecord: () => ({ mutateAsync: jest.fn() }),
  useDeleteHarvestRecord: () => ({ mutateAsync: jest.fn() }),
  useDeleteExpenseRecord: () => ({ mutateAsync: jest.fn() }),
  useDeleteFertigationRecord: () => ({ mutateAsync: jest.fn() }),
  useDeleteDailyNote: () => ({ mutateAsync: jest.fn() }),
  useUpsertDailyNote: () => ({ mutateAsync: jest.fn() }),
  queryKeys: { dashboard: { all: ['dashboard'] }, professionalWorkspace: { all: ['pw'] } },
}));

jest.mock('@/hooks/use-farm-seasons', () => ({
  useFarmSeasonStatus: () => ({ activeSeason: { id: 1 }, hasResolvedSeasons: true }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@react-native-community/datetimepicker', () => () => null);

jest.mock('@/components/ui/symbol', () => ({ Symbol: () => null }));
jest.mock('@/components/ui/app-icon', () => ({ AppIcon: () => null }));
jest.mock('@/components/ui/no-active-season-banner', () => ({ NoActiveSeasonBanner: () => null }));

jest.mock('@/services/telemetry', () => ({ telemetry: { capture: jest.fn() } }));
jest.mock('@/utils/haptics', () => ({ triggerHapticSuccess: jest.fn() }));
jest.mock('@/features/guided-tour', () => ({ guidedTourEmit: jest.fn() }));
jest.mock('@/i18n/format', () => ({ formatDate: () => '1 Jan 2026' }));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      background: '#fff',
      surface: '#fff',
      onSurface: '#000',
      onSurfaceVariant: '#333',
      primary: '#0a0',
      onPrimary: '#fff',
      shadow: '#000',
    },
    surface: { s50: '#eee', s100: '#f5f5f5', s300: '#ddd' },
  }),
}));

const Wrapper = ({ initialLogType }: { initialLogType: 'irrigation' | null }) => (
  <ReceiptLogScreen farmId={1} initialLogType={initialLogType} onClose={jest.fn()} />
);

describe('ReceiptLogScreen auto-open', () => {
  it('opens the irrigation sheet on mount when initialLogType is irrigation', () => {
    const { queryByTestId } = render(<Wrapper initialLogType="irrigation" />);
    expect(queryByTestId('irrigation-form')).not.toBeNull();
  });

  it('does not open any sheet when initialLogType is absent', () => {
    const { queryByTestId } = render(<Wrapper initialLogType={null} />);
    expect(queryByTestId('irrigation-form')).toBeNull();
    expect(queryByTestId('note-form')).toBeNull();
  });

  it('auto-opens only once — re-renders do not reopen', () => {
    const { queryByTestId, rerender } = render(<Wrapper initialLogType="irrigation" />);
    expect(queryByTestId('irrigation-form')).not.toBeNull();
    // A re-render with the same prop must not re-trigger the auto-open guard.
    rerender(<Wrapper initialLogType="irrigation" />);
    expect(queryByTestId('irrigation-form')).not.toBeNull();
  });

  it('ignores picker-hidden types (fertigation has no fast-path sheet)', () => {
    const { queryByTestId } = render(
      <ReceiptLogScreen
        farmId={1}
        initialLogType={'fertigation' as 'irrigation'}
        onClose={jest.fn()}
      />,
    );
    expect(queryByTestId('fertigation-form')).toBeNull();
  });
});
