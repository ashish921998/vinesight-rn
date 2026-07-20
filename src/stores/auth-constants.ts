import type { AuthState } from './auth-types';

export const initialState: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  errorMessage: null,
  pendingOTPEmail: null,
  pendingOTPPhone: null,
  pendingOTPPhoneName: null,
  pendingOTPPhoneMode: null,
  otpSentSuccessfully: false,
  pendingOTPType: 'email',
  passwordResetEmailSent: false,
  needsProfileCompletion: false,
  emailAlreadyRegistered: false,
  phoneLinkingPending: false,
  phoneLinkingNumber: null,
  phoneLinkingLoading: false,
  hasSeenOnboarding: false,
};

export const signedOutState: AuthState = {
  ...initialState,
  isLoading: false,
};
