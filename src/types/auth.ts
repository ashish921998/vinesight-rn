/**
 * Vinesight Auth Types
 * TypeScript types for authentication state management
 * Ported from iOS AuthManager.swift
 */

import type { User, Session } from '@supabase/supabase-js';

// ============================================================
// MARK: - OTP Types
// ============================================================

/**
 * Type of OTP being verified
 * - email: Passwordless sign-in OTP
 * - signup: Email verification OTP after account creation
 */
export type EmailOTPType = 'email' | 'signup';

// ============================================================
// MARK: - Auth State
// ============================================================

export interface AuthState {
  /** Whether the user is authenticated */
  isAuthenticated: boolean;

  /** Whether auth operations are in progress */
  isLoading: boolean;

  /** The current Supabase user */
  currentUser: User | null;

  /** Current session */
  session: Session | null;

  /** Error message from auth operations */
  errorMessage: string | null;

  /** Email pending email confirmation (legacy flow) */
  pendingEmailConfirmation: string | null;

  /** Email pending OTP verification */
  pendingOTPEmail: string | null;

  /** Whether OTP was sent successfully */
  otpSentSuccessfully: boolean;

  /** Type of OTP flow in progress */
  pendingOTPType: EmailOTPType;
}

export const initialAuthState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  currentUser: null,
  session: null,
  errorMessage: null,
  pendingEmailConfirmation: null,
  pendingOTPEmail: null,
  otpSentSuccessfully: false,
  pendingOTPType: 'email',
};

// ============================================================
// MARK: - Auth Actions (for Zustand store)
// ============================================================

export interface AuthActions {
  /** Check existing session on app start */
  checkSession: () => Promise<void>;

  /** Sign up with email and password */
  signUp: (email: string, password: string, name?: string) => Promise<void>;

  /** Sign up with OTP verification */
  signUpWithOTP: (email: string, password: string, name?: string) => Promise<void>;

  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<void>;

  /** Send OTP for passwordless sign-in */
  sendOTP: (email: string) => Promise<void>;

  /** Verify OTP code */
  verifyOTP: (email: string, code: string) => Promise<void>;

  /** Resend OTP code */
  resendOTP: () => Promise<void>;

  /** Cancel OTP flow */
  cancelOTPFlow: () => void;

  /** Sign out */
  signOut: () => Promise<void>;

  /** Delete account */
  deleteAccount: (deleteReason: string) => Promise<void>;

  /** Refresh session (e.g., when app comes to foreground) */
  refreshSessionIfNeeded: () => Promise<void>;

  /** Resend confirmation email */
  resendConfirmationEmail: (email: string) => Promise<void>;

  /** Clear error message */
  clearError: () => void;

  /** Update user country */
  updateUserCountry: (country: string) => Promise<void>;

  /** Update user area unit preference */
  updateUserAreaUnit: (areaUnit: 'hectares' | 'acres') => Promise<void>;

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set error message */
  setError: (message: string | null) => void;
}

export type AuthStore = AuthState & AuthActions;

// ============================================================
// MARK: - Auth Credentials
// ============================================================

export interface SignUpCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface OTPCredentials {
  email: string;
  code: string;
}

// ============================================================
// MARK: - User Metadata
// ============================================================

export interface UserMetadata {
  full_name?: string;
  country?: string;
  area_unit?: 'hectares' | 'acres';
  avatar_url?: string;
  [key: string]: unknown;
}

// ============================================================
// MARK: - Auth Provider Types
// ============================================================

export type AuthProvider = 'email' | 'apple' | 'google' | 'otp';

export interface AuthEvent {
  event: 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED' | 'PASSWORD_RECOVERY' | 'TOKEN_REFRESHED';
  session: Session | null;
}

// ============================================================
// MARK: - Validation Helpers
// ============================================================

/**
 * Validate email format
 * Uses a regex pattern for basic validation
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;

  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  return { valid: true };
}

/**
 * Validate OTP code format (6 digits)
 */
export function isValidOTPCode(code: string): boolean {
  const trimmed = code.trim();
  return trimmed.length === 6 && /^\d{6}$/.test(trimmed);
}

// ============================================================
// MARK: - Auth Error Messages
// ============================================================

export const AUTH_ERROR_MESSAGES = {
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PASSWORD: 'Password must be at least 6 characters',
  INVALID_OTP: 'Please enter a valid 6-digit code',
  OTP_EXPIRED: 'Invalid or expired code. Please try again.',
  SIGN_IN_FAILED: 'Sign in failed. Please check your credentials.',
  SIGN_UP_FAILED: 'Sign up failed. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  APPLE_SIGN_IN_FAILED: 'Apple sign-in failed. Please try again.',
  APPLE_SIGN_IN_CANCELLED: 'Apple sign-in was cancelled.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
} as const;

export type AuthErrorKey = keyof typeof AUTH_ERROR_MESSAGES;
