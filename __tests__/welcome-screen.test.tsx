import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { WelcomeScreen } from '@/features/welcome/welcome-screen';

const mockReplace = jest.fn();
const mockMarkWelcomeSeen = jest.fn();
const mockCapture = jest.fn();

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Reanimated = require('react-native-reanimated/mock');
  return {
    ...Reanimated,
    useReducedMotion: () => false,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/ui/symbol', () => ({ Symbol: () => null }));

jest.mock('@/services/telemetry', () => ({
  telemetry: {
    capture: (...args: unknown[]) => mockCapture(...args),
  },
}));

jest.mock('@/utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

jest.mock('@/stores/onboarding-store', () => ({
  useOnboardingStore: (selector: (state: { markWelcomeSeen: jest.Mock }) => unknown) =>
    selector({ markWelcomeSeen: mockMarkWelcomeSeen }),
}));

jest.mock('@/styles/use-theme', () => ({
  useIsDark: () => false,
  useM3: () => ({
    colorScheme: {
      background: '#ffffff',
      surface: '#ffffff',
      onSurface: '#111111',
      onSurfaceVariant: '#666666',
      outline: '#888888',
      primary: '#357047',
      onPrimary: '#ffffff',
      secondary: '#5a7a6a',
      tertiary: '#3a6a8a',
    },
  }),
}));

describe('WelcomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes both welcome actions to phone login and persists that welcome was seen', () => {
    const { getByText } = render(<WelcomeScreen />);

    fireEvent.press(getByText('welcome.cta.getStarted'));
    fireEvent.press(getByText('welcome.cta.logIn'));

    expect(mockMarkWelcomeSeen).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenNthCalledWith(1, '/(auth)/phone-login');
    expect(mockReplace).toHaveBeenNthCalledWith(2, '/(auth)/phone-login');
    expect(mockCapture).toHaveBeenCalledWith('welcome_get_started');
    expect(mockCapture).toHaveBeenCalledWith('welcome_log_in');
  });
});
