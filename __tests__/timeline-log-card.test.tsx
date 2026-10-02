import React from 'react';
import { render } from '@testing-library/react-native';
import { TimelineLogCard } from '@/components/cards/timeline-log-card';

jest.mock('@/components/ui/symbol', () => ({ Symbol: () => null }));

jest.mock('@/hooks/use-currency', () => ({
  useCurrency: () => 'INR',
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      onSurface: '#111111',
      onSurfaceVariant: '#555555',
      outlineVariant: '#dddddd',
    },
    shape: { cornerMedium: 16 },
    surface: { surfaceContainer: '#ffffff' },
  }),
}));

jest.mock('@/i18n/format', () => ({
  formatDate: () => 'Mar 15',
  formatNumber: (value: number) => String(value),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const note = {
  type: 'note' as const,
  data: {
    farm_id: 1,
    date: '2026-03-15',
    notes: 'Checked vines',
  },
};

describe('TimelineLogCard accessibility', () => {
  it('does not expose a non-interactive card as a button', () => {
    const { queryByRole } = render(<TimelineLogCard log={note} date={note.data.date} />);

    expect(queryByRole('button')).toBeNull();
  });

  it('exposes an interactive card as a labelled button', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <TimelineLogCard log={note} date={note.data.date} farmName="Sassy" onPress={onPress} />,
    );

    expect(getByRole('button')).toHaveProp('accessibilityLabel', 'Checked vines, Sassy. Mar 15.');
  });
});
