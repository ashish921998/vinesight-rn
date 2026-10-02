import React from 'react';
import { render } from '@testing-library/react-native';
import { OnboardingStageHeader } from '@/features/onboarding/components/onboarding-stage-header';

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      primary: '#355847',
      primaryContainer: '#E1EBE5',
      tertiary: '#D0A14A',
      surface: '#FBF8F3',
      onSurface: '#1E241F',
      onSurfaceVariant: '#5C584F',
    },
  }),
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: () => null,
}));

describe('OnboardingStageHeader', () => {
  it('exposes the localized title as one accessible heading', () => {
    const screen = render(
      <OnboardingStageHeader
        isActive
        title="Add your first farm"
        subtitle="This keeps recommendations relevant."
      />,
    );

    expect(screen.getByRole('header', { name: 'Add your first farm' })).toBeTruthy();
    expect(screen.getByText('This keeps recommendations relevant.')).toBeTruthy();
  });
});
