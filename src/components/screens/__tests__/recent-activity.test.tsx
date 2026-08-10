import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RecentActivityList } from '@/components/screens/recent-activity';
import type { RecentActivity } from '@/hooks';

jest.mock('@/hooks', () => ({
  useLogPresentation: () => ({
    irrigation: { icon: 'water', color: '#2563eb', label: 'Irrigation' },
    spray: { icon: 'spraycan', color: '#16a34a', label: 'Spray' },
    harvest: { icon: 'basket', color: '#ca8a04', label: 'Harvest' },
    expense: { icon: 'receipt', color: '#dc2626', label: 'Expense' },
    fertigation: { icon: 'fertigation', color: '#9333ea', label: 'Fertigation' },
    note: { icon: 'document-text', color: '#64748b', label: 'Note' },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'dashboard.recentActivity.editActivity') {
        return `Edit ${String(options?.label ?? '')}`;
      }
      if (key === 'dashboard.recentActivity.title') return 'Recent activity';
      if (key === 'simplifiedHome.viewAll') return 'View all';
      if (key === 'common.today') return 'Today';
      return key;
    },
  }),
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    surface: {
      s100: '#ffffff',
      s200: '#e5e7eb',
      s300: '#d1d5db',
      s400: '#9ca3af',
      s500: '#6b7280',
      s900: '#111827',
    },
    colorScheme: { primary: '#2563eb' },
  }),
}));

jest.mock('@/components/ui/app-icon', () => ({
  AppIcon: () => null,
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: () => null,
}));

jest.mock('@/components/ui/spinner', () => ({
  Spinner: () => null,
}));

jest.mock('@/utils/date', () => ({
  relativeDayKey: () => 'today',
}));

jest.mock('@/i18n/format', () => ({
  formatDate: () => 'Mar 15',
}));

const activity: RecentActivity = {
  id: 'irrigation_1',
  type: 'irrigation',
  date: '2026-03-15',
  description: '2h',
  farmId: 1,
  farmName: 'North Farm',
};

describe('RecentActivityList', () => {
  it('renders activity details and sends the full activity to the edit callback', () => {
    const onEditActivity = jest.fn();

    const { getByLabelText, getByText } = render(
      <RecentActivityList
        activities={[activity]}
        isLoading={false}
        hasFarms
        showFarmName
        onEditActivity={onEditActivity}
        onViewAll={jest.fn()}
      />,
    );

    expect(getByText('Irrigation')).toBeTruthy();
    expect(getByText('2h · North Farm')).toBeTruthy();
    expect(getByLabelText('Edit Irrigation, 2h · North Farm, Today')).toBeTruthy();

    fireEvent.press(getByLabelText('Edit Irrigation, 2h · North Farm, Today'));

    expect(onEditActivity).toHaveBeenCalledTimes(1);
    expect(onEditActivity).toHaveBeenCalledWith(activity);
  });

  it('renders optional secondary details in the shared row', () => {
    const { getByText } = render(
      <RecentActivityList
        activities={[{ ...activity, secondaryDetail: 'Calm' }]}
        isLoading={false}
        hasFarms
        showFarmName={false}
        onEditActivity={jest.fn()}
        onViewAll={jest.fn()}
      />,
    );

    expect(getByText('2h · Calm')).toBeTruthy();
  });
});
