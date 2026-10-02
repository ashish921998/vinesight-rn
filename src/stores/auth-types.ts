import type { User, Session } from '@supabase/supabase-js';
import type { PhoneAuthMode } from '@/types/auth';
import type { StoreApi } from 'zustand';

export type EmailOTPType = 'signup' | 'email';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  errorMessage: string | null;

  pendingOTPEmail: string | null;
  pendingOTPPhone: string | null;
  pendingOTPPhoneName: string | null;
  pendingOTPPhoneMode: PhoneAuthMode | null;
  otpSentSuccessfully: boolean;
  pendingOTPType: EmailOTPType;
  passwordResetEmailSent: boolean;
  needsProfileCompletion: boolean;
  // Set when profile completion is blocked solely because the entered email is
  // already registered to another account. The email is optional, so the UI
  // offers a "continue without email" recovery path instead of dead-ending.
  emailAlreadyRegistered: boolean;
  phoneLinkingPending: boolean;
  phoneLinkingNumber: string | null;
  phoneLinkingLoading: boolean;

  hasSeenOnboarding: boolean;
}

export interface AuthActions {
  initialize: () => Promise<void>;
  refreshSession: () => Promise<void>;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signUpWithOTP: (email: string, password: string, name?: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (deleteReason: string) => Promise<void>;

  sendOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, code: string) => Promise<void>;
  resendOTP: () => Promise<void>;
  cancelOTPFlow: () => void;

  resetPasswordForEmail: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  clearPasswordResetState: () => void;

  signInWithPhone: (phone: string, mode?: PhoneAuthMode, name?: string) => Promise<void>;
  signInWithPhoneAuto: (phone: string, name?: string) => Promise<void>;
  verifyPhoneOTP: (phone: string, code: string) => Promise<void>;
  resendPhoneOTP: (mode?: PhoneAuthMode, phone?: string) => Promise<void>;
  cancelPhoneOTPFlow: () => void;
  completeProfile: (data: { firstName: string; lastName: string; email?: string }) => Promise<void>;

  clearError: () => void;
  setHasSeenOnboarding: (value: boolean) => void;

  updateUserCountry: (country: string) => Promise<void>;
  updateUserAreaUnit: (unit: 'hectares' | 'acres') => Promise<void>;

  linkPhoneNumber: (phone: string) => Promise<void>;
  verifyPhoneLinking: (phone: string, code: string) => Promise<void>;
  cancelPhoneLinking: () => void;
}

export type AuthStore = AuthState & AuthActions;
export type SetState = StoreApi<AuthStore>['setState'];
export type GetState = StoreApi<AuthStore>['getState'];
