import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import OTPVerificationScreen from '../app/(auth)/otp-verification';

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterCanGoBack = jest.fn(() => true);
const mockIsAndroidSmsRetrieverSupported = jest.fn();
const mockStartAndroidSmsRetriever = jest.fn();
const mockStopAndroidSmsRetriever = jest.fn();

let mockParams: Record<string, string | undefined> = {
  phone: '+919876543210',
  channel: 'phone',
  mode: 'signup',
};

const mockAuthState = {
  isLoading: false,
  errorMessage: null as string | null,
  isAuthenticated: false,
  otpSentSuccessfully: false,
  needsProfileCompletion: false,
  verifyOTP: jest.fn(),
  verifyPhoneOTP: jest.fn(),
  resendOTP: jest.fn(),
  resendPhoneOTP: jest.fn(),
  cancelOTPFlow: jest.fn(),
  cancelPhoneOTPFlow: jest.fn(),
  clearError: jest.fn(),
};

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    back: (...args: unknown[]) => mockRouterBack(...args),
    canGoBack: () => mockRouterCanGoBack(),
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/stores', () => ({
  useAuthStore: Object.assign(
    (selector?: (s: typeof mockAuthState) => unknown) =>
      selector ? selector(mockAuthState) : mockAuthState,
    {
      getState: () => mockAuthState,
    },
  ),
}));

jest.mock('@/services/android-sms-retriever', () => ({
  isAndroidSmsRetrieverSupported: () => mockIsAndroidSmsRetrieverSupported(),
  startAndroidSmsRetriever: () => mockStartAndroidSmsRetriever(),
  stopAndroidSmsRetriever: () => mockStopAndroidSmsRetriever(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'authOtp.title': 'Enter verification code',
        'authOtp.subtitle': 'We sent a 6-digit code to',
        'authOtp.subtitlePhone': 'We sent a 6-digit code to',
        'authOtp.verifying': 'Verifying...',
        'authOtp.verify': 'Verify',
        'authOtp.resend': 'Resend code',
        'authOtp.resendA11y': 'Resend code',
        'authOtp.resendA11yWithSeconds': 'Resend code in 60 seconds',
        'authOtp.resendInSecondsShort': 'Resend in 60s',
        'authOtp.useDifferentPhone': 'Use different phone number',
        'authOtp.useDifferentPhoneA11y': 'Use different phone number',
        'authOtp.useDifferentEmail': 'Use different email',
        'authOtp.useDifferentEmailA11y': 'Use different email',
        'authOtp.invalidEmail': 'Invalid email',
        'authPhone.invalidPhone': 'Invalid phone',
      };

      return translations[key] ?? key;
    },
  }),
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      surface: '#fff',
      primary: '#0a0',
      onSurface: '#111',
      onSurfaceVariant: '#666',
      outlineVariant: '#bbb',
    },
    surface: {
      surfaceContainerHigh: '#ededed',
      surfaceContainerLow: '#f4f4f4',
    },
    shape: { cornerMedium: 16 },
    stateLayerOpacity: { pressed: 0.08 },
  }),
  useIsDark: () => false,
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: () => null,
}));

jest.mock('@/components/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native');
  return {
    Button: ({
      title,
      onPress,
      disabled,
    }: {
      title: string;
      onPress?: () => void;
      disabled?: boolean;
    }) => {
      return (
        <RN.Pressable onPress={onPress} disabled={disabled}>
          <RN.Text>{title}</RN.Text>
        </RN.Pressable>
      );
    },
    OTPInput: ({ value, focusKey }: { value: string; focusKey?: string | number }) => {
      return (
        <RN.View>
          <RN.Text testID="otp-value">{value}</RN.Text>
          <RN.Text testID="otp-focus-key">{String(focusKey ?? '')}</RN.Text>
        </RN.View>
      );
    },
  };
});

jest.mock('@/i18n/format', () => ({
  formatNumber: (value: number) => String(value),
}));

describe('OTPVerificationScreen', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockParams = {
      phone: '+919876543210',
      channel: 'phone',
      mode: 'signup',
    };
    mockRouterReplace.mockReset();
    mockRouterBack.mockReset();
    mockRouterCanGoBack.mockReset().mockReturnValue(true);
    mockIsAndroidSmsRetrieverSupported.mockReset().mockResolvedValue(true);
    mockStartAndroidSmsRetriever.mockReset().mockResolvedValue(null);
    mockStopAndroidSmsRetriever.mockReset().mockResolvedValue(undefined);
    mockAuthState.isLoading = false;
    mockAuthState.errorMessage = null;
    mockAuthState.isAuthenticated = false;
    mockAuthState.otpSentSuccessfully = false;
    mockAuthState.needsProfileCompletion = false;
    mockAuthState.verifyOTP.mockReset();
    mockAuthState.verifyPhoneOTP.mockReset().mockResolvedValue(undefined);
    mockAuthState.resendOTP.mockReset().mockResolvedValue(undefined);
    mockAuthState.resendPhoneOTP.mockReset().mockResolvedValue(undefined);
    mockAuthState.cancelOTPFlow.mockReset();
    mockAuthState.cancelPhoneOTPFlow.mockReset();
    mockAuthState.clearError.mockReset();
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('starts Android SMS retriever for phone OTP flows', async () => {
    render(<OTPVerificationScreen />);

    await waitFor(() => {
      expect(mockIsAndroidSmsRetrieverSupported).toHaveBeenCalled();
      expect(mockStartAndroidSmsRetriever).toHaveBeenCalled();
    });
  });

  it('does not start Android SMS retriever for email OTP flows', async () => {
    mockParams = {
      email: 'user@example.com',
      channel: 'email',
    };

    render(<OTPVerificationScreen />);

    await waitFor(() => {
      expect(screen.getByText('user@example.com')).toBeTruthy();
    });
    expect(mockIsAndroidSmsRetrieverSupported).not.toHaveBeenCalled();
    expect(mockStartAndroidSmsRetriever).not.toHaveBeenCalled();
  });

  it('populates the OTP and auto-submits when Android SMS retriever returns a valid code', async () => {
    mockStartAndroidSmsRetriever.mockResolvedValue('123456');

    render(<OTPVerificationScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('otp-value').props.children).toBe('123456');
    });
    await waitFor(() => {
      expect(mockAuthState.verifyPhoneOTP).toHaveBeenCalledWith('+919876543210', '123456');
    });
  });

  it('ignores invalid SMS retriever payloads', async () => {
    mockStartAndroidSmsRetriever.mockResolvedValue('abc123');

    render(<OTPVerificationScreen />);

    await waitFor(() => {
      expect(mockStartAndroidSmsRetriever).toHaveBeenCalled();
    });
    expect(screen.getByTestId('otp-value').props.children).toBe('');
    expect(mockAuthState.verifyPhoneOTP).not.toHaveBeenCalled();
  });

  it('stops the Android SMS retriever on unmount', async () => {
    const { unmount } = render(<OTPVerificationScreen />);

    await waitFor(() => {
      expect(mockStartAndroidSmsRetriever).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(mockStopAndroidSmsRetriever).toHaveBeenCalled();
    });
  });

  it('stops the Android SMS retriever when navigating back from phone OTP', async () => {
    render(<OTPVerificationScreen />);

    fireEvent.press(screen.getByText('Use different phone number'));

    await waitFor(() => {
      expect(mockStopAndroidSmsRetriever).toHaveBeenCalled();
      expect(mockAuthState.cancelPhoneOTPFlow).toHaveBeenCalled();
      expect(mockRouterReplace).toHaveBeenCalled();
    });
  });
});
