/**
 * Vinesight Auth Types
 * TypeScript types for authentication state management
 * Ported from iOS AuthManager.swift
 */

import type { Session } from '@supabase/supabase-js';

// ============================================================
// MARK: - OTP Types
// ============================================================

/**
 * Type of OTP being verified via phone
 * - sms: SMS-based OTP
 */
export type PhoneOTPType = 'sms';
export type PhoneAuthMode = 'signin' | 'signup';

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

export interface PhoneOTPCredentials {
  phone: string;
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

export type AuthProvider = 'email' | 'apple' | 'google' | 'otp' | 'phone';

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
  INVALID_PHONE: 'Please enter a valid phone number',
  PHONE_OTP_FAILED: 'Failed to send verification code. Please try again.',
  PHONE_OTP_EXPIRED: 'Code expired. Please request a new one.',
  PROFILE_UPDATE_FAILED: 'Failed to update profile. Please try again.',
} as const;

export type AuthErrorKey = keyof typeof AUTH_ERROR_MESSAGES;
