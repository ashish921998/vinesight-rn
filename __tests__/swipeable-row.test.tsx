import React from 'react';
import { render } from '@testing-library/react-native';
import { shouldClaimHorizontalSwipe, SwipeableRow } from '@/components/ui/swipeable-row';

jest.mock('@/components/ui/symbol', () => ({
  Symbol: () => null,
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      primary: '#2563eb',
      onPrimary: '#ffffff',
      error: '#dc2626',
      onError: '#ffffff',
    },
  }),
}));

describe('SwipeableRow', () => {
  const actions = {
    leadingAction: { label: 'Edit', icon: 'pencil', onPress: jest.fn() },
    trailingAction: { label: 'Delete', icon: 'trash', onPress: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('only claims gestures with clear horizontal intent', () => {
    expect(shouldClaimHorizontalSwipe(12, 30, true)).toBe(false);
    expect(shouldClaimHorizontalSwipe(30, 12, true)).toBe(true);
    expect(shouldClaimHorizontalSwipe(30, 12, false)).toBe(false);
  });

  it('hides action controls from accessibility until a swipe opens them', () => {
    const { getByTestId } = render(<SwipeableRow {...actions}>{() => <></>}</SwipeableRow>);
    const actionContainer = getByTestId('swipe-actions', { includeHiddenElements: true });

    expect(actionContainer.props.accessibilityElementsHidden).toBe(true);
    expect(actionContainer.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
