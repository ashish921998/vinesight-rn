import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SpraySafeCheckerScreen from '../app/spray-safe-checker';

const mockUseLocalSearchParams = jest.fn();
const mockUseFarms = jest.fn();
const mockUseFarmSeasonStatus = jest.fn();
const mockUseSafeToSprayMatrix = jest.fn();
const mockUseUpdateFarmSeasonTargetHarvestDate = jest.fn();
const mockUseChemicalCatalog = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
    setParams: jest.fn(),
    navigate: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
  }),
  Stack: { Screen: () => null },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  return function MockDateTimePicker() {
    return null;
  };
});

jest.mock('@/components/ui/symbol', () => ({
  Symbol: () => null,
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      surface: '#fff',
      onSurface: '#111',
      onSurfaceVariant: '#666',
      outlineVariant: '#bbb',
      primary: '#0a84ff',
    },
    surface: {
      surfaceContainerLow: '#f4f4f4',
      surfaceContainerHigh: '#ededed',
    },
    typography: {
      headlineSmall: { fontSize: 20 },
      bodyMedium: { fontSize: 14 },
    },
  }),
}));

jest.mock('@/hooks', () => ({
  useFarms: (...args: unknown[]) => mockUseFarms(...args),
  useFarmSeasonStatus: (...args: unknown[]) => mockUseFarmSeasonStatus(...args),
  useSafeToSprayMatrix: (...args: unknown[]) => mockUseSafeToSprayMatrix(...args),
  useUpdateFarmSeasonTargetHarvestDate: (...args: unknown[]) =>
    mockUseUpdateFarmSeasonTargetHarvestDate(...args),
  useChemicalCatalog: (...args: unknown[]) => mockUseChemicalCatalog(...args),
}));

const catalogMixes = [
  {
    id: 1,
    name: 'Alpha Shield',
    target_problem: 'Powdery mildew',
    application_mode: 'preventive',
    is_active: true,
    components: [
      {
        id: 11,
        product_id: 101,
        product_name: 'Sulfur Max',
        active_ingredient: 'Sulfur',
      },
    ],
  },
  {
    id: 2,
    name: 'Berry Guard',
    target_problem: 'Thrips',
    application_mode: 'curative',
    is_active: true,
    components: [
      {
        id: 12,
        product_id: 102,
        product_name: 'Insecto',
        active_ingredient: 'Spinosad',
      },
    ],
  },
  {
    id: 3,
    name: 'Copper Cover',
    target_problem: 'Downy mildew',
    application_mode: 'preventive',
    is_active: true,
    components: [
      {
        id: 13,
        product_id: 103,
        product_name: 'Copper Oxy',
        active_ingredient: 'Copper oxychloride',
      },
    ],
  },
];

const matrixData = [
  {
    mixId: 2,
    mixName: 'Berry Guard',
    status: 'red' as const,
    latestSafeSprayDate: '2026-02-01',
    daysUntilWindowEnds: -1,
    governingPhiDays: 7,
    blockingComponentName: 'Insecto',
  },
  {
    mixId: 1,
    mixName: 'Alpha Shield',
    status: 'green' as const,
    latestSafeSprayDate: '2026-02-20',
    daysUntilWindowEnds: 10,
    governingPhiDays: 3,
    blockingComponentName: 'Sulfur Max',
  },
  {
    mixId: 3,
    mixName: 'Copper Cover',
    status: 'unverified' as const,
    latestSafeSprayDate: null,
    daysUntilWindowEnds: null,
    governingPhiDays: null,
    blockingComponentName: null,
  },
];

describe('SpraySafeCheckerScreen search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({});
    mockUseFarms.mockReturnValue({ data: [{ id: 99, name: 'Demo Farm' }] });
    mockUseFarmSeasonStatus.mockReturnValue({
      activeSeason: {
        id: 77,
        farm_id: 99,
        target_harvest_date: '2026-02-10',
      },
    });
    mockUseSafeToSprayMatrix.mockReturnValue({
      data: matrixData,
      isLoading: false,
    });
    mockUseUpdateFarmSeasonTargetHarvestDate.mockReturnValue({
      isPending: false,
      mutate: jest.fn(),
    });
    mockUseChemicalCatalog.mockReturnValue({
      data: catalogMixes,
      isLoading: false,
    });
  });

  it('filters by mix name', () => {
    render(<SpraySafeCheckerScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Search mix, pest, or product'), 'berry');

    expect(screen.getByText('Berry Guard')).toBeTruthy();
    expect(screen.queryByText('Alpha Shield')).toBeNull();
    expect(screen.queryByText('Copper Cover')).toBeNull();
  });

  it('filters by target problem', () => {
    render(<SpraySafeCheckerScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Search mix, pest, or product'),
      'powdery mildew',
    );

    expect(screen.getByText('Alpha Shield')).toBeTruthy();
    expect(screen.queryByText('Berry Guard')).toBeNull();
  });

  it('filters by product name and active ingredient', () => {
    render(<SpraySafeCheckerScreen />);

    const searchInput = screen.getByPlaceholderText('Search mix, pest, or product');

    fireEvent.changeText(searchInput, 'copper oxy');
    expect(screen.getByText('Copper Cover')).toBeTruthy();
    expect(screen.queryByText('Alpha Shield')).toBeNull();

    fireEvent.changeText(searchInput, 'spinosad');
    expect(screen.getByText('Berry Guard')).toBeTruthy();
    expect(screen.queryByText('Copper Cover')).toBeNull();
  });

  it('clearing search restores the full status-sorted list', () => {
    render(<SpraySafeCheckerScreen />);
    const searchInput = screen.getByPlaceholderText('Search mix, pest, or product');

    fireEvent.changeText(searchInput, 'berry');
    fireEvent.press(screen.getByLabelText('Clear search'));

    const mixNames = ['Berry Guard', 'Alpha Shield', 'Copper Cover'];
    const allText = screen.getAllByText(/Berry Guard|Alpha Shield|Copper Cover/);
    const renderedOrder = allText.map((node) => node.props.children);

    mixNames.forEach((name, i) => {
      expect(renderedOrder[i]).toBe(name);
    });
  });

  it('shows a no-results state for unmatched queries', () => {
    render(<SpraySafeCheckerScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Search mix, pest, or product'), 'nomatch');

    expect(screen.getByText('No results found')).toBeTruthy();
    expect(screen.getByText('Try a different search term')).toBeTruthy();
  });
});
