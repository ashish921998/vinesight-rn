import React from 'react';
import { render, screen } from '@widgets/shared/utils/testUtils';
import { QuickStatsWidget } from './QuickStatsWidget';
import { TrendDirection } from '@widgets/shared/types';

describe('QuickStatsWidget', () => {
  it('renders default stats', () => {
    render(<QuickStatsWidget />);
    expect(screen.getByText('Quick Stats')).toBeTruthy();
    expect(screen.getByText('Active Farms')).toBeTruthy();
    expect(screen.getByText('Workers Today')).toBeTruthy();
    expect(screen.getByText('Water Reserve')).toBeTruthy();
    expect(screen.getByText('Season Expenses')).toBeTruthy();
  });

  it('renders stat values', () => {
    render(<QuickStatsWidget />);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('68%')).toBeTruthy();
    expect(screen.getByText('₹2.4L')).toBeTruthy();
  });

  it('renders trend values for each stat', () => {
    render(<QuickStatsWidget />);
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('-5%')).toBeTruthy();
    expect(screen.getByText('+12%')).toBeTruthy();
  });

  it('renders custom stats when provided', () => {
    const customStats = [
      {
        icon: 'leaf-outline' as const,
        labelKey: 'widgets.quickStats.stats.activeFarms',
        value: '10',
        trend: 'up' as TrendDirection,
        trendValue: '+2',
      },
    ];
    render(<QuickStatsWidget stats={customStats} />);
    expect(screen.getByText('Active Farms')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.queryByText('Workers Today')).toBeNull();
  });

  it('renders with testID', () => {
    render(<QuickStatsWidget testID="custom-test-id" />);
    expect(screen.getByTestId('custom-test-id')).toBeTruthy();
  });

  it('renders with accessibilityLabel', () => {
    render(<QuickStatsWidget accessibilityLabel="Custom quick stats" />);
    expect(screen.getByLabelText('Custom quick stats')).toBeTruthy();
  });

  it('renders stat cards with accessibility labels', () => {
    render(<QuickStatsWidget />);
    expect(screen.getByLabelText(/Active Farms:/)).toBeTruthy();
    expect(screen.getByLabelText(/Workers Today:/)).toBeTruthy();
    expect(screen.getByLabelText(/Water Reserve:/)).toBeTruthy();
    expect(screen.getByLabelText(/Season Expenses:/)).toBeTruthy();
  });
});
