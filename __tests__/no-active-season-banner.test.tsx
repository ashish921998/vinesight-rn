import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NoActiveSeasonBanner } from '@/components/ui/no-active-season-banner';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/styles/use-theme', () => ({
  useIsDark: () => false,
  useM3: () => ({
    colorScheme: { onSurfaceVariant: '#5b6270', primary: '#2f6fed' },
    surface: { s100: '#f6f7f9' },
  }),
}));

jest.mock('@/components/ui/symbol', () => ({ Symbol: () => null }));

jest.mock('@/utils/color', () => ({
  colorWithOpacity: (color: string) => color,
}));

describe('NoActiveSeasonBanner', () => {
  it('renders the default no-active-season message', () => {
    const { getByText } = render(<NoActiveSeasonBanner />);
    expect(getByText('farmDetails.seasons.banner.noActiveSeason')).toBeTruthy();
  });

  it('renders a custom message override when provided', () => {
    const { getByText, queryByText } = render(
      <NoActiveSeasonBanner message="No active season for North Plot" />,
    );
    expect(getByText('No active season for North Plot')).toBeTruthy();
    expect(queryByText('farmDetails.seasons.banner.noActiveSeason')).toBeNull();
  });

  it('hides the Start season action when no handler is given', () => {
    const { queryByText } = render(<NoActiveSeasonBanner />);
    expect(queryByText('farmDetails.seasons.banner.startSeason')).toBeNull();
  });

  it('shows and invokes the Start season action when a handler is given', () => {
    const onStartSeason = jest.fn();
    const { getByText } = render(<NoActiveSeasonBanner onStartSeason={onStartSeason} />);
    const action = getByText('farmDetails.seasons.banner.startSeason');
    expect(action).toBeTruthy();
    fireEvent.press(action);
    expect(onStartSeason).toHaveBeenCalledTimes(1);
  });
});
