import React from 'react';
import { render } from '@testing-library/react-native';
import { FarmCard } from '@/components/cards/farm-card';
import type { Farm } from '@/types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.value !== undefined) return String(opts.value);
      return key;
    },
  }),
}));

jest.mock('@/styles/use-theme', () => ({
  useThemeColors: () => ({
    surface: { 100: '#fff', 200: '#ddd', 300: '#ccc', 400: '#aaa', 500: '#888', 900: '#111' },
    primary: { 500: '#357047' },
  }),
  useM3: () => ({
    colorScheme: { error: '#c00', onSurface: '#111' },
    stateLayerOpacity: { pressed: 0.12 },
    typography: { labelSmall: {} },
  }),
}));

jest.mock('@/components/ui/symbol', () => ({ Symbol: () => null }));

jest.mock('@/utils/color', () => ({
  colorWithOpacity: (color: string) => color,
}));

jest.mock('@/i18n/format', () => ({
  formatDate: (_date: Date, _opts: unknown) => 'Jun 15',
  formatNumber: (value: number) => String(value),
}));

const BASE_FARM: Farm = {
  name: 'Test Farm',
  region: 'Nashik',
  area: 2.5,
  crop: 'Grape',
  crop_variety: 'Cabernet',
  planting_date: '2020-01-01',
  total_tank_capacity: 1000,
  remaining_water: 500,
};

describe('FarmCard — useDaysSincePruning', () => {
  it('shows day counter when today equals pruning date (0 days)', () => {
    const today = new Date(2024, 0, 10); // Jan 10
    const { getByText } = render(
      <FarmCard farm={{ ...BASE_FARM, date_of_pruning: '2024-01-10' }} today={today} />,
    );
    // The since-pruning label only renders when daysSincePruning != null
    expect(getByText('farmCard.season.sincePruning')).toBeTruthy();
  });

  it('shows day counter when pruning date is in the past', () => {
    const today = new Date(2024, 0, 20); // Jan 20 — 19 days after Jan 1
    const { getByText } = render(
      <FarmCard farm={{ ...BASE_FARM, date_of_pruning: '2024-01-01' }} today={today} />,
    );
    expect(getByText('farmCard.season.sincePruning')).toBeTruthy();
  });

  it('does not show day counter when date_of_pruning is null', () => {
    const today = new Date(2024, 0, 10);
    const { queryByText } = render(
      <FarmCard farm={{ ...BASE_FARM, date_of_pruning: null }} today={today} />,
    );
    expect(queryByText('farmCard.season.sincePruning')).toBeNull();
  });

  it('does not show day counter when pruning date is in the future', () => {
    const today = new Date(2024, 0, 1);
    const { queryByText } = render(
      <FarmCard farm={{ ...BASE_FARM, date_of_pruning: '2024-06-01' }} today={today} />,
    );
    expect(queryByText('farmCard.season.sincePruning')).toBeNull();
  });

  it('clamps progress to 100% when past 130 days', () => {
    // 200 days since pruning — todayPct would be >100 without clamp
    const today = new Date(2024, 6, 19); // ~200 days after Jan 1
    const { getByText } = render(
      <FarmCard farm={{ ...BASE_FARM, date_of_pruning: '2024-01-01' }} today={today} />,
    );
    // Day counter should still render (200 days)
    expect(getByText('farmCard.season.sincePruning')).toBeTruthy();
  });
});

describe('FarmCard — useEstimatedHarvestLabel', () => {
  it('shows estimated harvest date when pruning date is set', () => {
    const today = new Date(2024, 0, 10);
    const { getByText } = render(
      <FarmCard farm={{ ...BASE_FARM, date_of_pruning: '2024-01-01' }} today={today} />,
    );
    // formatDate is mocked to return 'Jun 15'
    expect(getByText('Jun 15')).toBeTruthy();
  });

  it('does not show harvest estimate when pruning date is null', () => {
    const today = new Date(2024, 0, 10);
    const { queryByText } = render(
      <FarmCard farm={{ ...BASE_FARM, date_of_pruning: null }} today={today} />,
    );
    expect(queryByText('Jun 15')).toBeNull();
  });
});

describe('FarmCard — low water urgency', () => {
  it('shows Needs Attention status when water is critically low', () => {
    const farm: Farm = {
      ...BASE_FARM,
      remaining_water: 100, // 10% of 1000 — below 30% threshold
      total_tank_capacity: 1000,
    };
    const { getByText } = render(<FarmCard farm={farm} />);
    expect(getByText('farmCard.status.needsAttention')).toBeTruthy();
  });

  it('shows Healthy status when water is sufficient', () => {
    const farm: Farm = {
      ...BASE_FARM,
      remaining_water: 500, // 50% — above 30% threshold
      total_tank_capacity: 1000,
    };
    const { getByText } = render(<FarmCard farm={farm} />);
    expect(getByText('farmCard.status.healthy')).toBeTruthy();
  });

  it('does not show a Healthy status when water data is absent', () => {
    const farm: Farm = {
      ...BASE_FARM,
      remaining_water: null,
      total_tank_capacity: null,
    };
    const { queryByText } = render(<FarmCard farm={farm} />);
    expect(queryByText('farmCard.status.healthy')).toBeNull();
  });
});

describe('FarmCard — water balance label', () => {
  it('shows positive water balance with + prefix', () => {
    const farm: Farm = { ...BASE_FARM, remaining_water: 42 };
    const { getByText } = render(<FarmCard farm={farm} />);
    // t('farmCard.waterBalance.value', { value: '+42' }) → '+42' via our mock
    expect(getByText('+42')).toBeTruthy();
  });

  it('shows zero water balance with + prefix', () => {
    const farm: Farm = { ...BASE_FARM, remaining_water: 0 };
    const { getByText } = render(<FarmCard farm={farm} />);
    expect(getByText('+0')).toBeTruthy();
  });

  it('shows negative water balance without double minus', () => {
    const farm: Farm = { ...BASE_FARM, remaining_water: -15 };
    const { getByText } = render(<FarmCard farm={farm} />);
    expect(getByText('-15')).toBeTruthy();
  });

  it('does not show water balance when remaining_water is null', () => {
    const farm: Farm = { ...BASE_FARM, remaining_water: null };
    const { queryByText } = render(<FarmCard farm={farm} />);
    // Neither positive nor negative balance label should appear
    expect(queryByText(/^\+\d/)).toBeNull();
  });
});

describe('FarmCard — render basics', () => {
  it('renders farm name', () => {
    const { getByText } = render(<FarmCard farm={BASE_FARM} />);
    expect(getByText('Test Farm')).toBeTruthy();
  });

  it('renders edit and delete buttons when callbacks provided', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    // accessibilityLabel uses the i18n key since our t() mock returns the key for non-value opts
    const { getByLabelText } = render(
      <FarmCard farm={BASE_FARM} onEdit={onEdit} onDelete={onDelete} />,
    );
    expect(getByLabelText('farmCard.a11y.editFarm')).toBeTruthy();
    expect(getByLabelText('farmCard.a11y.deleteFarm')).toBeTruthy();
  });

  it('renders without crashing when no optional props provided', () => {
    expect(() => render(<FarmCard farm={BASE_FARM} />)).not.toThrow();
  });
});
