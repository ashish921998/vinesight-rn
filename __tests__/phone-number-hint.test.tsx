import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import PhoneLoginScreen from '../app/(auth)/phone-login';
import { matchPhoneNumberHintToCountry } from '@/utils/phone';

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockMaybeCompleteAuthSession = jest.fn();
const mockIsPhoneNumberHintSupported = jest.fn();
const mockRequestPhoneNumberHint = jest.fn();

const mockAuthState = {
  isLoading: false,
  errorMessage: null as string | null,
  pendingOTPPhone: null as string | null,
  isAuthenticated: false,
  needsProfileCompletion: false,
  signInWithPhone: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
  clearError: jest.fn(),
};

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: () => mockMaybeCompleteAuthSession(),
}));

jest.mock('@/services/phone-number-hint', () => ({
  isPhoneNumberHintSupported: () => mockIsPhoneNumberHintSupported(),
  requestPhoneNumberHint: () => mockRequestPhoneNumberHint(),
}));

jest.mock('@/stores', () => ({
  useAuthStore: () => mockAuthState,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        'authPhone.phoneNumber': 'Phone number',
        'authPhone.invalidPhone': 'Please enter a valid phone number with country code',
        'authPhone.phoneHintUnsupported':
          'Could not fill this number automatically. Please enter it manually.',
        'authPhone.signinTitle': 'Phone Sign In',
        'authPhone.signupTitle': 'Phone Sign Up',
        'authPhone.signinSubtitle':
          'Sign in with your mobile number and we will send a verification code.',
        'authPhone.signupSubtitle':
          'Create your account with your mobile number and we will send a verification code.',
        'auth.signIn': 'Sign In',
        'auth.signUp': 'Sign Up',
        'auth.continueWithGoogle': 'Continue with Google',
        'auth.continueWithApple': 'Continue with Apple',
        'auth.continueWithEmail': 'Sign in with email',
        'auth.or': 'or',
        'authPhone.preferEmail': 'Prefer email?',
        'authPhone.signInWithEmail': 'Sign in with email',
        'auth.alreadyHaveAccount': 'Already have an account?',
        'auth.dontHaveAccount': "Don't have an account?",
        'auth.a11y.switchToSignIn': 'Switch to sign in',
        'auth.a11y.switchToSignUp': 'Switch to sign up',
        'authPhone.selectCountryA11y': 'Open country picker',
        'authPhone.selectCountry': 'Select country',
        'authPhone.closeA11y': 'Close country picker',
        'authPhone.searchCountry': 'Search country...',
      };

      return options?.defaultValue ?? translations[key] ?? key;
    },
  }),
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      surface: '#fff',
      surfaceVariant: '#eee',
      primary: '#0a0',
      onPrimary: '#fff',
      onSurface: '#111',
      onSurfaceVariant: '#666',
      outline: '#999',
      outlineVariant: '#bbb',
      error: '#d00',
    },
    surface: {
      surfaceContainerLow: '#f4f4f4',
      surfaceContainerHigh: '#ededed',
      surfaceContainerLowest: '#fafafa',
    },
    stateLayerOpacity: { pressed: 0.08 },
    shape: { cornerMedium: 16 },
    typography: {
      labelLarge: {
        fontSize: 14,
      },
    },
  }),
  useIsDark: () => false,
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: () => null,
}));

jest.mock('@/components/ui', () => {
  const RN = jest.requireActual('react-native');

  return {
    Button: ({
      title,
      onPress,
      testID,
      accessibilityLabel,
      disabled,
    }: {
      title: string;
      onPress?: () => void;
      testID?: string;
      accessibilityLabel?: string;
      disabled?: boolean;
    }) => (
      <RN.Pressable
        onPress={onPress}
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? title}
        disabled={disabled}
      >
        <RN.Text>{title}</RN.Text>
      </RN.Pressable>
    ),
  };
});

describe('matchPhoneNumberHintToCountry', () => {
  const countries = [
    { name: 'India', code: 'IN', dialCode: '+91' },
    { name: 'United States', code: 'US', dialCode: '+1' },
    { name: 'Canada', code: 'CA', dialCode: '+1' },
    { name: 'United Kingdom', code: 'GB', dialCode: '+44' },
  ];

  it('maps an Indian number and strips the dial code', () => {
    expect(matchPhoneNumberHintToCountry('+919422724937', countries)).toEqual({
      country: countries[0],
      localNumber: '9422724937',
    });
  });

  it('preserves repo ordering for shared +1 countries', () => {
    expect(matchPhoneNumberHintToCountry('+14155552671', countries)).toEqual({
      country: countries[1],
      localNumber: '4155552671',
    });
  });

  it('returns null for unsupported dial codes', () => {
    expect(matchPhoneNumberHintToCountry('+81312345678', countries)).toBeNull();
  });

  it('sanitizes formatting before validating local digits', () => {
    expect(matchPhoneNumberHintToCountry(' +44 7911-123456 ', countries)).toEqual({
      country: countries[3],
      localNumber: '7911123456',
    });
  });
});

describe('PhoneLoginScreen automatic phone hint', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockRouterPush.mockReset();
    mockRouterReplace.mockReset();
    mockMaybeCompleteAuthSession.mockReset();
    mockIsPhoneNumberHintSupported.mockReset().mockResolvedValue(true);
    mockRequestPhoneNumberHint.mockReset().mockResolvedValue(null);
    mockAuthState.isLoading = false;
    mockAuthState.errorMessage = null;
    mockAuthState.pendingOTPPhone = null;
    mockAuthState.isAuthenticated = false;
    mockAuthState.needsProfileCompletion = false;
    mockAuthState.signInWithPhone.mockReset();
    mockAuthState.signInWithApple.mockReset();
    mockAuthState.signInWithGoogle.mockReset();
    mockAuthState.clearError.mockReset();
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('requests the Android hint automatically and fills country plus local number after success', async () => {
    mockRequestPhoneNumberHint.mockResolvedValue('+919422724937');

    render(<PhoneLoginScreen />);

    await waitFor(() => expect(mockRequestPhoneNumberHint).toHaveBeenCalled());

    await waitFor(() => {
      expect(screen.getByDisplayValue('9422724937')).toBeTruthy();
    });
    expect(screen.getByText('+91')).toBeTruthy();
    expect(mockAuthState.clearError).toHaveBeenCalled();
    expect(screen.queryByTestId('phone-hint-button')).toBeNull();
  });

  it('does not request the hint on iOS', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    render(<PhoneLoginScreen />);

    await waitFor(() => expect(mockMaybeCompleteAuthSession).toHaveBeenCalled());
    expect(mockRequestPhoneNumberHint).not.toHaveBeenCalled();
  });

  it('leaves the field unchanged when the user starts typing before the hint resolves', async () => {
    let resolvePhoneHint: ((value: string | null) => void) | null = null;
    mockRequestPhoneNumberHint.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePhoneHint = resolve;
        }),
    );

    render(<PhoneLoginScreen />);

    await waitFor(() => expect(mockRequestPhoneNumberHint).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Phone number');
    fireEvent.changeText(input, '9999999999');

    await act(async () => {
      resolvePhoneHint?.('+919422724937');
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('9999999999')).toBeTruthy();
    });
    expect(screen.queryByTestId('phone-hint-button')).toBeNull();
  });

  it('renders the country selector and phone number input in one horizontal row', async () => {
    render(<PhoneLoginScreen />);

    await waitFor(() => expect(screen.getByTestId('phone-input-row')).toBeTruthy());
    expect(screen.getByTestId('phone-country-trigger')).toBeTruthy();
    expect(screen.getByPlaceholderText('Phone number')).toBeTruthy();
  });

  it('updates the visible dial code after selecting a different country', async () => {
    render(<PhoneLoginScreen />);

    fireEvent.press(screen.getByTestId('phone-country-trigger'));
    fireEvent.press(screen.getByText('United Kingdom'));

    await waitFor(() => {
      expect(screen.getByText('+44')).toBeTruthy();
    });
  });

  it('trims the local number to the selected country digit limit', async () => {
    render(<PhoneLoginScreen />);

    const input = screen.getByPlaceholderText('Phone number');
    fireEvent.changeText(input, '01234567890123');

    await waitFor(() => {
      expect(screen.getByDisplayValue('1234567890')).toBeTruthy();
    });
  });
});
