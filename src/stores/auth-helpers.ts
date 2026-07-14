import * as Sentry from '@sentry/react-native';
import { supabase } from '@/lib/supabase';
import { persistQueryCacheForUser, queryClient, removeQueryCacheForUser } from '@/lib/query-cache';
import { telemetry } from '@/services/telemetry';
import type { User } from '@supabase/supabase-js';

export type AuthErrorContext =
  | 'sign_in'
  | 'sign_up'
  | 'send_email_otp'
  | 'verify_email_otp'
  | 'resend_email_otp'
  | 'send_phone_otp'
  | 'send_phone_signin_otp'
  | 'verify_phone_otp'
  | 'link_phone_otp'
  | 'verify_phone_link_otp'
  | 'profile_update'
  | 'delete_account'
  | 'reset_password'
  | 'update_password'
  | 'generic';

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

export const isNetworkTimeoutError = (error: unknown): boolean => {
  const message = getErrorMessage(error, '').toLowerCase();
  return (
    message.includes('network request timed out') ||
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('timed out')
  );
};

export const isOtpSignupDisabledError = (error: unknown): boolean => {
  const message = getErrorMessage(error, '').toLowerCase();
  return message.includes('signups not allowed for otp');
};

export const isDuplicateEmailError = (error: unknown): boolean => {
  const message = getErrorMessage(error, '').toLowerCase();
  return (
    message.includes('already') &&
    (message.includes('registered') || message.includes('exists') || message.includes('in use'))
  );
};

export const getAuthErrorMessage = (
  error: unknown,
  fallback: string,
  context: AuthErrorContext = 'generic',
): string => {
  const rawMessage = getErrorMessage(error, fallback);
  const message = rawMessage.toLowerCase();

  if (isNetworkTimeoutError(error)) {
    return 'Unable to reach server right now. Please check your internet connection and try again.';
  }

  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return 'Incorrect email or password. Please try again.';
  }

  if (message.includes('email not confirmed') || message.includes('not confirmed')) {
    return 'Please verify your email first, then try signing in.';
  }

  if (message.includes('already registered') || message.includes('already exists')) {
    if (context === 'sign_up') {
      return 'An account with this email already exists. Please sign in instead.';
    }
  }

  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('over request rate limit')
  ) {
    return 'Too many attempts right now. Please wait a minute and try again.';
  }

  if (context === 'verify_email_otp' || context === 'verify_phone_otp') {
    return 'The verification code is invalid or expired. Please request a new code.';
  }

  if (context === 'send_email_otp' || context === 'resend_email_otp') {
    return 'Could not send verification code to your email. Please try again.';
  }

  if (context === 'send_phone_otp') {
    return 'Could not send verification code to your phone. Please try again.';
  }

  if (context === 'send_phone_signin_otp') {
    return fallback;
  }

  if (context === 'link_phone_otp') {
    return 'Could not send verification code to link this phone number. Please try again.';
  }

  if (context === 'verify_phone_link_otp') {
    return 'The verification code is invalid or expired. Please request a new code.';
  }

  if (context === 'profile_update') {
    return 'We could not save your profile changes right now. Please try again.';
  }

  if (context === 'delete_account') {
    return 'We could not process your delete request right now. Please try again.';
  }

  if (context === 'reset_password') {
    return 'Could not send the password reset email. Please check the address and try again.';
  }

  if (context === 'update_password') {
    if (message.includes('expired') || message.includes('invalid') || message.includes('session')) {
      return 'This reset link has expired. Please request a new password reset email.';
    }
    return 'We could not update your password right now. Please try again.';
  }

  return rawMessage;
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const maskPhoneForLogs = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  const visibleDigits = 4;
  const masked = phone.replace(/\d(?=\d{4})/g, '*');
  return masked.length > visibleDigits
    ? masked
    : `${'*'.repeat(Math.max(0, masked.length - 2))}${masked.slice(-2)}`;
};

export const isValidEmail = (email: string): boolean => {
  const trimmed = email.trim();
  if (!trimmed) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
};

export const isValidPhone = (phone: string): boolean => {
  const trimmed = phone.trim();
  if (!trimmed) return false;
  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  return phoneRegex.test(trimmed);
};

export const getEmailDomain = (email: string | undefined | null) => {
  if (!email) return null;
  const [, domain] = email.split('@');
  return domain?.trim() || null;
};

export const setSentryUser = (user: User | null) => {
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email });
  } else {
    Sentry.setUser(null);
  }
};

export const PROFILE_QUERY_KEY = ['profile'] as const;
export const PROFILE_CURRENT_QUERY_KEY = ['profile', 'current'] as const;

export const hasCompletedProfileName = (user: User | null | undefined) =>
  Boolean(
    user?.user_metadata?.full_name ||
    (user?.user_metadata?.first_name && user?.user_metadata?.last_name),
  );

export const resolveUserFullName = (
  user: User | null | undefined,
  preferredFullName?: string | null,
): string | null => {
  const explicit = preferredFullName?.trim();
  if (explicit) return explicit;

  const metadata = user?.user_metadata;
  const fullName =
    typeof metadata?.full_name === 'string'
      ? metadata.full_name
      : typeof metadata?.name === 'string'
        ? metadata.name
        : null;
  if (fullName?.trim()) return fullName.trim();

  const firstName =
    typeof metadata?.first_name === 'string'
      ? metadata.first_name
      : typeof metadata?.given_name === 'string'
        ? metadata.given_name
        : null;
  const lastName =
    typeof metadata?.last_name === 'string'
      ? metadata.last_name
      : typeof metadata?.family_name === 'string'
        ? metadata.family_name
        : null;
  const combined = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ').trim();
  return combined || null;
};

export const upsertProfileNameFromAuthUser = async (
  user: User | null | undefined,
  preferredFullName?: string | null,
): Promise<void> => {
  if (!user?.id) return;

  const { data: existingProfile, error: readError } = await supabase
    .from('profiles')
    .select('full_name,email')
    .eq('id', user.id)
    .single();
  if (readError && readError.code !== 'PGRST116') {
    throw readError;
  }
  if (existingProfile?.full_name && existingProfile.full_name.trim().length > 0) return;

  const resolvedFullName = resolveUserFullName(user, preferredFullName);
  if (!resolvedFullName) return;

  const upsertPayload: { id: string; full_name: string; email?: string | null } = {
    id: user.id,
    full_name: resolvedFullName,
  };
  if (readError?.code === 'PGRST116' && user.email) {
    upsertPayload.email = user.email;
  }

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(upsertPayload, { onConflict: 'id' });
  if (upsertError) throw upsertError;
};

export const upsertProfileNameFromAuthUserBestEffort = async (
  user: User | null | undefined,
  preferredFullName?: string | null,
): Promise<void> => {
  try {
    await upsertProfileNameFromAuthUser(user, preferredFullName);
  } catch (error: unknown) {
    telemetry.capture('profile_name_upsert_failed', {
      user_id: user?.id ?? null,
      has_preferred_full_name: Boolean(preferredFullName?.trim()),
      error: getErrorMessage(error, 'profile name upsert failed'),
    });
    if (__DEV__) {
      console.warn('Best-effort profile name upsert failed:', {
        userId: user?.id ?? null,
        hasPreferredFullName: Boolean(preferredFullName?.trim()),
        error,
      });
    }
  }
};

export const clearQueryCache = async (
  context: string,
  userId: string | null,
  preserveOfflineWrites = true,
) => {
  if (userId) {
    if (preserveOfflineWrites) await persistQueryCacheForUser(userId);
    else await removeQueryCacheForUser(userId);
  }
  queryClient.clear();
  if (__DEV__) {
    console.info(
      `Cleared query cache during ${context}; offline writes ${preserveOfflineWrites ? 'parked' : 'removed'}.`,
    );
  }
};
