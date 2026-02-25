import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeHarvestCard } from '@/components/cards/safe-harvest-card';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('SafeHarvestCard', () => {
  it('shows earliest safe harvest and blocking record', () => {
    const screen = render(
      <SafeHarvestCard
        earliestDate="2026-02-20"
        blockingReason="Lannate (Lannate, 2026-02-01)"
        targetHarvestDate="2026-02-25"
        hasConflict={false}
        onSetTargetDate={jest.fn()}
        onOpenChecker={jest.fn()}
      />,
    );

    expect(screen.getByText('farmDetails.safeHarvest.safeDate')).toBeTruthy();
    expect(screen.getByText('farmDetails.safeHarvest.blockedBy')).toBeTruthy();
  });

  it('shows no-target state and setup CTA', () => {
    const onSetTargetDate = jest.fn();
    const screen = render(
      <SafeHarvestCard
        earliestDate={null}
        blockingReason={null}
        targetHarvestDate={null}
        hasConflict={false}
        onSetTargetDate={onSetTargetDate}
        onOpenChecker={jest.fn()}
      />,
    );

    expect(screen.getByText('farmDetails.safeHarvest.noTarget')).toBeTruthy();
    const setTargetButton = screen.getByText('farmDetails.safeHarvest.ctaSetTarget');
    fireEvent.press(setTargetButton);
    expect(onSetTargetDate).toHaveBeenCalledTimes(1);
  });
});
