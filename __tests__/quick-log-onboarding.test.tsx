import React from 'react';
import { render } from '@testing-library/react-native';

// Capture the props passed into ReceiptLogScreen so we can invoke onLogSaved.
const receiptProps: { onLogSaved?: () => void; farmId?: number | null } = {};
jest.mock('@/components/screens/receipt-log-screen', () => ({
  ReceiptLogScreen: (props: { onLogSaved?: () => void; farmId?: number | null }) => {
    receiptProps.onLogSaved = props.onLogSaved;
    receiptProps.farmId = props.farmId;
    return null;
  },
}));

jest.mock('@/hooks/use-safe-back', () => ({ useSafeBack: () => jest.fn() }));

const mockMark = jest.fn();
jest.mock('@/features/onboarding/activation', () => ({
  markOnboardingFirstActionCompleted: (args: unknown) => mockMark(args),
  parseOnboardingActionType: jest.requireActual('@/features/onboarding/activation')
    .parseOnboardingActionType,
  parseOnboardingFlag: jest.requireActual('@/features/onboarding/activation').parseOnboardingFlag,
}));

const mockParams = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams(),
}));

import QuickLogRoute from '../app/log-entry/quick';

beforeEach(() => {
  mockMark.mockClear();
  receiptProps.onLogSaved = undefined;
  receiptProps.farmId = undefined;
});

describe('QuickLogRoute onboarding completion', () => {
  it('completes the onboarding first action on save when onboarding=true', () => {
    mockParams.mockReturnValue({
      farmId: '42',
      initialLogType: 'irrigation',
      onboarding: 'true',
      onboardingActionType: 'log',
    });
    render(<QuickLogRoute />);
    expect(receiptProps.farmId).toBe(42);
    receiptProps.onLogSaved?.();
    expect(mockMark).toHaveBeenCalledWith({ actionType: 'log', farmId: 42 });
  });

  it('defaults the action type to log when not provided', () => {
    mockParams.mockReturnValue({ farmId: '7', onboarding: '1' });
    render(<QuickLogRoute />);
    receiptProps.onLogSaved?.();
    expect(mockMark).toHaveBeenCalledWith({ actionType: 'log', farmId: 7 });
  });

  it('does not complete the first action when onboarding params are absent', () => {
    mockParams.mockReturnValue({ farmId: '42', initialLogType: 'irrigation' });
    render(<QuickLogRoute />);
    receiptProps.onLogSaved?.();
    expect(mockMark).not.toHaveBeenCalled();
  });
});
