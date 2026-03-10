import { create } from 'zustand';
import * as Sentry from '@sentry/react-native';
import { supabase } from '@/lib/supabase';
import { queryClient, queryPersister } from '@/lib/query-cache';
import { telemetry } from '@/services/telemetry';
import type { User, Session } from '@supabase/supabase-js';
import type { PhoneAuthMode } from '@/types/auth';
import type { Profile } from '@/types';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

const isNetworkTimeoutError = (error: unknown): boolean => {
  const message = getErrorMessage(error, '').toLowerCase();
  return (
    message.includes('network request timed out') ||
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('timed out')
  );
};

const isOtpSignupDisabledError = (error: unknown): boolean => {
  const message = getErrorMessage(error, '').toLowerCase();
  return message.includes('signups not allowed for otp');
};

type AuthErrorContext =
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
  | 'generic';

const getAuthErrorMessage = (
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

  return rawMessage;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isDuplicateEmailError = (error: unknown): boolean => {
  const message = getErrorMessage(error, '').toLowerCase();
  return (
    message.includes('already') &&
    (message.includes('registered') || message.includes('exists') || message.includes('in use'))
  );
};

// OTP types matching Supabase
type EmailOTPType = 'signup' | 'email';

interface AuthState {
  // Auth state
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  errorMessage: string | null;

  // OTP state
  pendingOTPEmail: string | null;
  pendingOTPPhone: string | null;
  pendingOTPPhoneName: string | null;
  pendingOTPPhoneMode: PhoneAuthMode | null;
  otpSentSuccessfully: boolean;
  pendingOTPType: EmailOTPType;
  needsProfileCompletion: boolean;
  phoneLinkingPending: boolean;
  phoneLinkingNumber: string | null;
  phoneLinkingLoading: boolean;

  // Onboarding
  hasSeenOnboarding: boolean;
}

interface AuthActions {
  // Session management
  initialize: () => Promise<void>;
  refreshSession: () => Promise<void>;

  // Auth methods
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signUpWithOTP: (email: string, password: string, name?: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (deleteReason: string) => Promise<void>;

  // OTP methods
  sendOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, code: string) => Promise<void>;
  resendOTP: () => Promise<void>;
  cancelOTPFlow: () => void;

  // Phone OTP methods
  signInWithPhone: (phone: string, mode?: PhoneAuthMode, name?: string) => Promise<void>;
  verifyPhoneOTP: (phone: string, code: string) => Promise<void>;
  resendPhoneOTP: (mode?: PhoneAuthMode, phone?: string) => Promise<void>;
  cancelPhoneOTPFlow: () => void;
  completeProfile: (data: { firstName: string; lastName: string; email?: string }) => Promise<void>;

  // Utility
  clearError: () => void;
  setHasSeenOnboarding: (value: boolean) => void;

  // Profile updates
  updateUserCountry: (country: string) => Promise<void>;
  updateUserAreaUnit: (unit: 'hectares' | 'acres') => Promise<void>;

  // Phone linking (for existing users)
  linkPhoneNumber: (phone: string) => Promise<void>;
  verifyPhoneLinking: (phone: string, code: string) => Promise<void>;
  cancelPhoneLinking: () => void;
}

// Email validation helper
const isValidEmail = (email: string): boolean => {
  const trimmed = email.trim();
  if (!trimmed) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
};

// Phone validation helper (E.164 format: +<country><number>)
const isValidPhone = (phone: string): boolean => {
  const trimmed = phone.trim();
  if (!trimmed) return false;
  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  return phoneRegex.test(trimmed);
};

const getEmailDomain = (email: string | undefined | null) => {
  if (!email) return null;
  const [, domain] = email.split('@');
  return domain?.trim() || null;
};

const setSentryUser = (user: User | null) => {
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email });
  } else {
    Sentry.setUser(null);
  }
};

const PROFILE_QUERY_KEY = ['profile'] as const;
const PROFILE_CURRENT_QUERY_KEY = ['profile', 'current'] as const;

const hasCompletedProfileName = (user: User | null | undefined) =>
  Boolean(
    user?.user_metadata?.full_name ||
    (user?.user_metadata?.first_name && user?.user_metadata?.last_name),
  );

const resolveUserFullName = (
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

const upsertProfileNameFromAuthUser = async (
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

const upsertProfileNameFromAuthUserBestEffort = async (
  user: User | null | undefined,
  preferredFullName?: string | null,
): Promise<void> => {
  try {
    await upsertProfileNameFromAuthUser(user, preferredFullName);
  } catch (error: unknown) {
    telemetry.capture('profile_name_upsert_failed', {
      user_id: user?.id ?? null,
      preferred_full_name: preferredFullName?.trim() || null,
      error: getErrorMessage(error, 'profile name upsert failed'),
    });
    if (__DEV__) {
      console.warn('Best-effort profile name upsert failed:', {
        userId: user?.id ?? null,
        preferredFullName: preferredFullName?.trim() || null,
        error,
      });
    }
  }
};

const clearQueryCache = async (context: string) => {
  queryClient.clear();
  try {
    await queryPersister.removeClient();
  } catch (_persisterError) {
    // Best effort: auth flows should still complete if persistence cleanup fails.
    if (__DEV__) {
      console.error(`Failed to remove persisted query cache during ${context}`);
    }
  }
};

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  // Initial state
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
  needsProfileCompletion: false,
  phoneLinkingPending: false,
  phoneLinkingNumber: null,
  phoneLinkingLoading: false,
  hasSeenOnboarding: false,

  // Initialize - check existing session
  initialize: async () => {
    let settled = false;
    // Safety: if getSession() hangs (e.g. SecureStore on Android), don't block forever.
    const safetyTimeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        if (__DEV__) {
          console.warn('[VineSight] supabase.auth.getSession() timed out after 5 s');
        }
        Sentry.captureMessage('supabase.auth.getSession() timed out', {
          level: 'warning',
          extra: { timeoutMs: 5_000 },
        });
        set({ isLoading: false });
      }
    }, 5_000);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      clearTimeout(safetyTimeout);
      if (!settled) {
        settled = true;
      }

      if (error) throw error;

      if (session) {
        setSentryUser(session.user);
        telemetry.identify(session.user.id, { email_domain: getEmailDomain(session.user.email) });
        telemetry.capture('auth_session_restored', {
          provider: session.user.app_metadata?.provider ?? null,
        });
        set({
          user: session.user,
          session,
          isAuthenticated: true,
          // Do not force profile completion on generic session restore.
          // Profile completion should only be required when we explicitly detect
          // a new phone-auth flow in verifyPhoneOTP/onAuthStateChange.
          needsProfileCompletion: false,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      clearTimeout(safetyTimeout);
      if (!settled) {
        settled = true;
        console.error('Auth initialization error:', error);
        set({ isLoading: false });
      }
    }
  },

  // Refresh session
  refreshSession: async () => {
    const { pendingOTPEmail, isAuthenticated, isLoading } = get();

    // Only refresh if in incomplete auth state
    if (!pendingOTPEmail && isAuthenticated) return;
    if (isLoading) return;

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (session?.user.email_confirmed_at) {
        set({
          user: session.user,
          session,
          isAuthenticated: true,
          pendingOTPEmail: null,
          otpSentSuccessfully: false,
        });
      }
    } catch (error) {
      // Silent fail - expected if user hasn't confirmed yet
      console.log('Session refresh failed:', error);
    }
  },

  // Sign in with email/password
  signIn: async (email: string, password: string) => {
    set({ errorMessage: null, isLoading: true });
    telemetry.capture('auth_sign_in_started', { method: 'password' });

    try {
      const signInRequest = () =>
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      let { data, error } = await signInRequest();

      if (error && isNetworkTimeoutError(error)) {
        telemetry.capture('auth_sign_in_retry', { method: 'password', reason: 'network_timeout' });
        await sleep(800);
        const retryResult = await signInRequest();
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) throw error;
      if (!data.user || !data.session) {
        throw new Error('Sign in failed: missing authenticated session');
      }

      setSentryUser(data.user);
      telemetry.identify(data.user.id, { email_domain: getEmailDomain(data.user.email) });
      telemetry.capture('auth_sign_in_succeeded', { method: 'password' });
      telemetry.capture('user_logged_in', { method: 'password' });
      set({
        user: data.user,
        session: data.session,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: unknown) {
      telemetry.capture('auth_sign_in_failed', {
        method: 'password',
        is_network_timeout: isNetworkTimeoutError(error),
      });
      set({
        errorMessage: getAuthErrorMessage(error, 'Sign in failed', 'sign_in'),
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // Sign up with email/password (direct)
  signUp: async (email: string, password: string, name?: string) => {
    set({ errorMessage: null, isLoading: true });
    telemetry.capture('auth_sign_up_started', { method: 'password' });

    try {
      const metadata = name ? { full_name: name } : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: metadata },
      });

      if (error) throw error;

      if (data.session) {
        if (data.user) {
          await upsertProfileNameFromAuthUserBestEffort(data.user, name?.trim() || null);
          setSentryUser(data.user);
          telemetry.identify(data.user.id, { email_domain: getEmailDomain(data.user.email) });
        }
        telemetry.capture('auth_sign_up_succeeded', { method: 'password', confirmed: true });
        telemetry.capture('user_signed_up', { method: 'password' });
        set({
          user: data.user,
          session: data.session,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        telemetry.capture('auth_sign_up_succeeded', { method: 'password', confirmed: false });
        telemetry.capture('user_signed_up', { method: 'password', confirmed: false });
        // Email confirmation required
        set({
          pendingOTPEmail: email.trim(),
          isLoading: false,
        });
      }
    } catch (error: unknown) {
      telemetry.capture('auth_sign_up_failed', { method: 'password' });
      set({
        errorMessage: getAuthErrorMessage(error, 'Sign up failed', 'sign_up'),
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // Sign up with OTP verification
  signUpWithOTP: async (email: string, password: string, name?: string) => {
    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      set({ errorMessage: 'Please enter a valid email address' });
      return;
    }

    if (password.length < 6) {
      set({ errorMessage: 'Password must be at least 6 characters' });
      return;
    }

    set({
      errorMessage: null,
      isLoading: true,
      pendingOTPEmail: null,
      otpSentSuccessfully: false,
      pendingOTPType: 'signup',
    });
    telemetry.capture('auth_sign_up_started', { method: 'otp' });

    try {
      const metadata = name ? { full_name: name } : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: metadata },
      });

      if (error) throw error;

      if (data.session) {
        if (data.user) {
          await upsertProfileNameFromAuthUserBestEffort(data.user, name?.trim() || null);
          setSentryUser(data.user);
          telemetry.identify(data.user.id, { email_domain: getEmailDomain(data.user.email) });
        }
        telemetry.capture('auth_sign_up_succeeded', { method: 'otp', confirmed: true });
        telemetry.capture('user_signed_up', { method: 'otp' });
        // Email confirmation disabled, user is authenticated
        set({
          user: data.user,
          session: data.session,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        telemetry.capture('auth_sign_up_succeeded', { method: 'otp', confirmed: false });
        telemetry.capture('user_signed_up', { method: 'otp', confirmed: false });
        // OTP sent for email verification
        set({
          pendingOTPEmail: trimmedEmail,
          otpSentSuccessfully: true,
          isLoading: false,
        });
      }
    } catch (error: unknown) {
      telemetry.capture('auth_sign_up_failed', { method: 'otp' });
      set({
        errorMessage: getAuthErrorMessage(error, 'Sign up failed', 'sign_up'),
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // Sign in with Google OAuth
  signInWithGoogle: async () => {
    set({ errorMessage: null, isLoading: true });
    telemetry.capture('auth_sign_in_started', { method: 'google' });

    try {
      const { openAuthSessionAsync } = await import('expo-web-browser');

      const redirectUri = 'vinesight://auth/callback';

      const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });
      if (oauthError) throw oauthError;
      if (!oauthData?.url) throw new Error('No OAuth URL returned');

      const result = await openAuthSessionAsync(oauthData.url, redirectUri);

      if (result.type === 'success') {
        let url: URL;
        let code: string | null;
        let queryError: string | null;
        let hashParams: URLSearchParams;
        let accessToken: string | null;
        let refreshToken: string | null;

        try {
          url = new URL(result.url);
          code = url.searchParams.get('code');
          queryError = url.searchParams.get('error');
          hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
          accessToken = hashParams.get('access_token') || url.searchParams.get('access_token');
          refreshToken = hashParams.get('refresh_token') || url.searchParams.get('refresh_token');
        } catch (error) {
          throw new Error(`Failed to parse OAuth URL: ${result.url}. ${error}`);
        }

        if (queryError) {
          throw new Error(queryError);
        }

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          await upsertProfileNameFromAuthUserBestEffort(data.user);
          setSentryUser(data.user);
          telemetry.identify(data.user.id, { email_domain: getEmailDomain(data.user.email) });
          telemetry.capture('auth_sign_in_succeeded', { method: 'google' });
          telemetry.capture('user_logged_in', { method: 'google' });
          set({
            user: data.user,
            session: data.session,
            isAuthenticated: true,
            isLoading: false,
          });
        } else if (accessToken) {
          if (!refreshToken && __DEV__) {
            console.warn('OAuth response missing refresh_token - session may not persist');
          }
          if (!refreshToken) {
            throw new Error('OAuth response missing refresh_token');
          }
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          await upsertProfileNameFromAuthUserBestEffort(data.user);
          if (data.user) {
            setSentryUser(data.user);
            telemetry.identify(data.user.id, { email_domain: getEmailDomain(data.user.email) });
          }
          telemetry.capture('auth_sign_in_succeeded', { method: 'google' });
          telemetry.capture('user_logged_in', { method: 'google' });
          set({
            user: data.user,
            session: data.session,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          throw new Error('No code or access token in response');
        }
      } else if (result.type === 'cancel') {
        telemetry.capture('auth_sign_in_cancelled', { method: 'google' });
        set({
          errorMessage: 'Google sign-in was cancelled',
          isLoading: false,
        });
      } else {
        throw new Error('Google sign-in failed');
      }
    } catch (error: unknown) {
      telemetry.capture('auth_sign_in_failed', { method: 'google' });
      set({
        errorMessage: getAuthErrorMessage(error, 'Google sign-in failed', 'sign_in'),
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // Sign in with Apple (required on iOS if other third-party auth providers are offered)
  signInWithApple: async () => {
    set({ errorMessage: null, isLoading: true });
    telemetry.capture('auth_sign_in_started', { method: 'apple' });

    try {
      const AppleAuthentication = await import('expo-apple-authentication');

      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sign in with Apple is not available on this device.');
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple sign-in did not return an identity token.');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;

      const appleNameFromCredential = [
        credential.fullName?.givenName?.trim(),
        credential.fullName?.familyName?.trim(),
      ]
        .filter(Boolean)
        .join(' ')
        .trim();
      await upsertProfileNameFromAuthUserBestEffort(data.user, appleNameFromCredential || null);
      setSentryUser(data.user);
      telemetry.identify(data.user.id, { email_domain: getEmailDomain(data.user.email) });
      telemetry.capture('auth_sign_in_succeeded', { method: 'apple' });
      telemetry.capture('user_logged_in', { method: 'apple' });
      set({
        user: data.user,
        session: data.session,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error && 'code' in error
          ? (error as { code?: unknown }).code
          : null;

      if (code === 'ERR_REQUEST_CANCELED') {
        telemetry.capture('auth_sign_in_cancelled', { method: 'apple' });
        set({ errorMessage: 'Apple sign-in was cancelled', isLoading: false });
        return;
      }

      telemetry.capture('auth_sign_in_failed', { method: 'apple' });
      set({
        errorMessage: getAuthErrorMessage(error, 'Apple sign-in failed', 'sign_in'),
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // Sign out
  signOut: async () => {
    set({ errorMessage: null, isLoading: true });
    telemetry.capture('auth_sign_out');
    telemetry.capture('user_logged_out');

    try {
      if (__DEV__) {
        console.log('Signing out...');
      }

      // Clear Supabase session first
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;

      if (__DEV__) {
        console.log('Sign out successful, clearing state');
      }

      setSentryUser(null);

      // Explicitly clear state
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        pendingOTPEmail: null,
        pendingOTPPhone: null,
        otpSentSuccessfully: false,
        pendingOTPType: 'email',
        needsProfileCompletion: false,
        phoneLinkingPending: false,
        phoneLinkingNumber: null,
        phoneLinkingLoading: false,
      });
      telemetry.reset();
      await clearQueryCache('sign out success path');
    } catch {
      useAuthStore.setState({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        pendingOTPEmail: null,
        pendingOTPPhone: null,
        pendingOTPPhoneName: null,
        pendingOTPPhoneMode: null,
        otpSentSuccessfully: false,
        pendingOTPType: 'email',
        needsProfileCompletion: false,
        phoneLinkingPending: false,
        phoneLinkingNumber: null,
        phoneLinkingLoading: false,
      });
      telemetry.reset();
      await clearQueryCache('sign out recovery path');
    }
  },
  // Delete account
  deleteAccount: async (deleteReason: string) => {
    try {
      useAuthStore.setState({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        pendingOTPEmail: null,
        pendingOTPPhone: null,
        pendingOTPPhoneName: null,
        pendingOTPPhoneMode: null,
        otpSentSuccessfully: false,
        pendingOTPType: 'email',
        needsProfileCompletion: false,
        phoneLinkingPending: false,
        phoneLinkingNumber: null,
        phoneLinkingLoading: false,
      });

      if (__DEV__) {
        console.log('Logging deletion request...');
      }

      // Log deletion request (actual deletion happens via server-side process)
      const userId = get().user?.id;
      if (userId) {
        const userEmail = get().user?.email;
        const maskEmail = (email: string) => {
          const [localPart, domain] = email.split('@');
          if (localPart.length <= 2) {
            return `${localPart[0]}***@${domain}`;
          }
          return `${localPart[0]}${localPart[1]}***@${domain}`;
        };
        console.warn('[DELETE ACCOUNT REQUEST]', {
          user_id: userId,
          user_email: userEmail ? maskEmail(userEmail) : undefined,
          delete_reason: deleteReason || 'Not provided',
          status: 'pending',
          requested_at: new Date().toISOString(),
        });
      }

      // Sign out after request is logged
      await supabase.auth.signOut({ scope: 'global' });

      setSentryUser(null);

      // Clear state
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        pendingOTPEmail: null,
        pendingOTPPhone: null,
        otpSentSuccessfully: false,
        pendingOTPType: 'email',
        needsProfileCompletion: false,
        phoneLinkingPending: false,
        phoneLinkingNumber: null,
        phoneLinkingLoading: false,
      });
      await clearQueryCache('delete account');
    } catch (error) {
      useAuthStore.setState({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        pendingOTPEmail: null,
        pendingOTPPhone: null,
        pendingOTPPhoneName: null,
        pendingOTPPhoneMode: null,
        otpSentSuccessfully: false,
        pendingOTPType: 'email',
        needsProfileCompletion: false,
        phoneLinkingPending: false,
        phoneLinkingNumber: null,
        phoneLinkingLoading: false,
      });
      if (__DEV__) {
        console.error('Delete account error:', error);
      }

      // Preserve user state on error so they can retry
      set({
        isLoading: false,
        errorMessage: getAuthErrorMessage(error, 'Failed to delete account', 'delete_account'),
      });

      throw error;
    }
  },

  // Send OTP for passwordless auth
  sendOTP: async (email: string) => {
    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      set({ errorMessage: 'Please enter a valid email address' });
      return;
    }

    set({
      errorMessage: null,
      isLoading: true,
      otpSentSuccessfully: false,
      pendingOTPType: 'email',
    });
    telemetry.capture('auth_otp_send_started');

    try {
      const { error } = await supabase.auth.signInWithOtp({ email: trimmedEmail });
      if (error) throw error;

      telemetry.capture('auth_otp_send_succeeded');
      set({
        pendingOTPEmail: trimmedEmail,
        otpSentSuccessfully: true,
        isLoading: false,
      });
    } catch (error: unknown) {
      telemetry.capture('auth_otp_send_failed');
      set({
        errorMessage: getAuthErrorMessage(error, 'Failed to send OTP', 'send_email_otp'),
        otpSentSuccessfully: false,
        isLoading: false,
      });
    }
  },

  // Verify OTP code
  verifyOTP: async (email: string, code: string) => {
    const trimmedCode = code.trim();

    if (trimmedCode.length !== 6 || !/^\d+$/.test(trimmedCode)) {
      set({ errorMessage: 'Please enter a valid 6-digit code' });
      return;
    }

    const wasAuthenticated = get().isAuthenticated;
    set({ errorMessage: null, isLoading: true });

    const { pendingOTPType } = get();
    telemetry.capture('auth_otp_verify_started', { type: pendingOTPType });

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: trimmedCode,
        type: pendingOTPType,
      });

      if (error) throw error;

      if (data.user) {
        if (pendingOTPType === 'signup') {
          await upsertProfileNameFromAuthUserBestEffort(data.user);
        }
        setSentryUser(data.user);
        telemetry.identify(data.user.id, { email_domain: getEmailDomain(data.user.email) });
      }
      telemetry.capture('auth_otp_verify_succeeded', { type: pendingOTPType });
      if (pendingOTPType === 'signup') {
        telemetry.capture('user_signed_up', { method: 'otp', verified: true });
      } else {
        telemetry.capture('user_logged_in', { method: 'otp' });
      }
      set({
        user: data.user,
        session: data.session,
        isAuthenticated: true,
        pendingOTPEmail: null,
        otpSentSuccessfully: false,
        isLoading: false,
      });
    } catch (error: unknown) {
      telemetry.capture('auth_otp_verify_failed', { type: pendingOTPType });
      set({
        errorMessage: getAuthErrorMessage(
          error,
          'Invalid or expired code. Please try again.',
          'verify_email_otp',
        ),
        isAuthenticated: wasAuthenticated,
        isLoading: false,
      });
    }
  },

  resendOTP: async () => {
    const { pendingOTPEmail, pendingOTPType, sendOTP } = get();

    if (!pendingOTPEmail) return;

    if (pendingOTPType === 'signup') {
      set({ isLoading: true, otpSentSuccessfully: false });

      try {
        const { error } = await supabase.auth.resend({
          email: pendingOTPEmail,
          type: 'signup',
        });

        if (error) throw error;

        set({ isLoading: false, otpSentSuccessfully: true });
      } catch (error: unknown) {
        set({
          errorMessage: getAuthErrorMessage(error, 'Failed to resend code', 'resend_email_otp'),
          otpSentSuccessfully: false,
          isLoading: false,
        });
      }
    } else {
      await sendOTP(pendingOTPEmail);
    }
  },

  // Cancel OTP flow
  cancelOTPFlow: () => {
    set({
      pendingOTPEmail: null,
      pendingOTPPhone: null,
      pendingOTPPhoneName: null,
      pendingOTPPhoneMode: null,
      otpSentSuccessfully: false,
      pendingOTPType: 'email',
      errorMessage: null,
    });
  },

  // Sign in with phone (send OTP via SMS)
  signInWithPhone: async (phone: string, mode: PhoneAuthMode = 'signin', name?: string) => {
    const trimmedPhone = phone.trim();
    const maskedPhone = trimmedPhone.replace(/\d(?=\d{4})/g, '*');

    if (!isValidPhone(trimmedPhone)) {
      set({ errorMessage: 'Please enter a valid phone number with country code' });
      return;
    }

    set({
      errorMessage: null,
      isLoading: true,
      otpSentSuccessfully: false,
    });
    telemetry.capture('auth_phone_otp_send_started', { mode });
    if (__DEV__) {
      console.log('[auth] signInWithPhone', {
        phone: maskedPhone,
        mode,
        shouldCreateUser: mode === 'signup',
        hasName: Boolean(name?.trim()),
      });
    }

    try {
      const options: { shouldCreateUser: boolean; data?: { full_name?: string } } = {
        shouldCreateUser: mode === 'signup',
      };
      if (mode === 'signup' && name && name.trim()) {
        options.data = { full_name: name.trim() };
        if (__DEV__) {
          console.log('[auth] signInWithPhone - Capturing name for signup:', {
            hasName: true,
            phone: maskedPhone,
          });
        }
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone: trimmedPhone,
        options,
      });
      if (error) throw error;

      telemetry.capture('auth_phone_otp_send_succeeded', { mode });
      set({
        pendingOTPPhone: trimmedPhone,
        pendingOTPPhoneName: mode === 'signup' && name?.trim() ? name.trim() : null,
        pendingOTPPhoneMode: mode,
        otpSentSuccessfully: true,
        isLoading: false,
      });
    } catch (error: unknown) {
      telemetry.capture('auth_phone_otp_send_failed', { mode });
      const fallbackMessage =
        mode === 'signin'
          ? 'No account found for this phone number. If you already use email login, sign in with email and link phone from Settings.'
          : 'Failed to send verification code';
      set({
        errorMessage:
          mode === 'signup' && isOtpSignupDisabledError(error)
            ? 'Phone sign-up is currently disabled for this project. Enable OTP signups in Supabase Auth settings, or sign up with email and link your phone from Settings.'
            : getAuthErrorMessage(
                error,
                fallbackMessage,
                mode === 'signup' ? 'send_phone_otp' : 'send_phone_signin_otp',
              ),
        otpSentSuccessfully: false,
        isLoading: false,
      });
    }
  },

  // Verify phone OTP code
  verifyPhoneOTP: async (phone: string, code: string) => {
    const trimmedCode = code.trim();

    if (trimmedCode.length !== 6 || !/^\d+$/.test(trimmedCode)) {
      set({ errorMessage: 'Please enter a valid 6-digit code' });
      return;
    }

    const wasAuthenticated = get().isAuthenticated;
    set({ errorMessage: null, isLoading: true });
    telemetry.capture('auth_phone_otp_verify_started');

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: trimmedCode,
        type: 'sms',
      });

      if (error) throw error;

      if (data.user) {
        setSentryUser(data.user);
        telemetry.identify(data.user.id, {
          email_domain: getEmailDomain(data.user.email),
        });
        if (__DEV__) {
          console.log('[auth] verifyPhoneOTP - User metadata:', {
            user_id: data.user.id,
            metadata_present: Boolean(data.user.user_metadata),
            has_full_name: Boolean(data.user.user_metadata?.full_name),
            has_name_parts: Boolean(
              data.user.user_metadata?.first_name && data.user.user_metadata?.last_name,
            ),
            was_authenticated: wasAuthenticated,
          });
        }
      }
      telemetry.capture('auth_phone_otp_verify_succeeded');

      // Note: isNewUser is determined by metadata presence (full_name or first_name/last_name),
      // not by whether the user has ever signed in via phone before. This heuristic may:
      // - Re-prompt returning phone users whose metadata was cleared (by admin/migration)
      // - Not prompt users who previously authenticated via email OTP and have email in metadata
      // This is an intentional design trade-off for simplicity.
      const isNewUser = !hasCompletedProfileName(data.user);

      if (isNewUser) {
        const pendingSignupName = get().pendingOTPPhoneName;
        await upsertProfileNameFromAuthUserBestEffort(data.user, pendingSignupName || undefined);
        telemetry.capture('user_signed_up', { method: 'phone' });
        set({
          user: data.user,
          session: data.session,
          isAuthenticated: true,
          pendingOTPPhone: null,
          pendingOTPPhoneName: null,
          pendingOTPPhoneMode: null,
          otpSentSuccessfully: false,
          needsProfileCompletion: true,
          isLoading: false,
        });
      } else if (data.user) {
        await upsertProfileNameFromAuthUserBestEffort(data.user);
        telemetry.capture('user_logged_in', { method: 'phone' });
        set({
          user: data.user,
          session: data.session,
          isAuthenticated: true,
          pendingOTPPhone: null,
          pendingOTPPhoneName: null,
          pendingOTPPhoneMode: null,
          otpSentSuccessfully: false,
          needsProfileCompletion: false,
          isLoading: false,
        });
      }
    } catch (error: unknown) {
      telemetry.capture('auth_phone_otp_verify_failed');
      set({
        errorMessage: getAuthErrorMessage(
          error,
          'Invalid or expired code. Please try again.',
          'verify_phone_otp',
        ),
        isAuthenticated: wasAuthenticated,
        isLoading: false,
      });
    }
  },

  // Resend phone OTP
  resendPhoneOTP: async (mode: PhoneAuthMode = 'signin', phone?: string) => {
    const { pendingOTPPhone, pendingOTPPhoneName, pendingOTPPhoneMode, signInWithPhone } = get();
    const resendPhone = phone?.trim() || pendingOTPPhone;
    if (!resendPhone) {
      set({ errorMessage: 'Phone number is missing. Please enter it again.' });
      return;
    }
    await signInWithPhone(
      resendPhone,
      mode || pendingOTPPhoneMode || 'signin',
      pendingOTPPhoneName || undefined,
    );
  },

  // Cancel phone OTP flow
  cancelPhoneOTPFlow: () => {
    set({
      pendingOTPPhone: null,
      pendingOTPPhoneName: null,
      pendingOTPPhoneMode: null,
      otpSentSuccessfully: false,
      errorMessage: null,
    });
  },

  // Complete profile after phone auth sign-up
  completeProfile: async (data: { firstName: string; lastName: string; email?: string }) => {
    set({ errorMessage: null, isLoading: true });
    telemetry.capture('profile_completion_started');

    try {
      const firstName = data.firstName.trim();
      const lastName = data.lastName.trim();
      const email = data.email?.trim().toLowerCase();

      if (!firstName || !lastName) {
        set({
          errorMessage: 'Please enter first name and last name.',
          isLoading: false,
        });
        return;
      }

      if (email && !isValidEmail(email)) {
        set({
          errorMessage: 'Please enter a valid email address.',
          isLoading: false,
        });
        return;
      }

      if (email) {
        const currentUserId = get().user?.id;
        const query = supabase.from('profiles').select('id').eq('email', email);
        if (currentUserId) {
          query.neq('id', currentUserId);
        }
        const { data: existingProfiles, error: lookupError } = await query.limit(1);

        if (lookupError) {
          set({
            errorMessage: getErrorMessage(lookupError, 'Failed to validate email'),
            isLoading: false,
          });
          return;
        }

        if (existingProfiles && existingProfiles.length > 0) {
          set({
            errorMessage:
              'An account with this email already exists. Please sign in with your email first, then link your phone number from Settings.',
            isLoading: false,
          });
          return;
        }
      }

      const fullName = `${firstName} ${lastName}`.trim();
      const updateData: Record<string, string> = {
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
      };

      const updateUserPayload: { email?: string; data: Record<string, string> } = {
        data: updateData,
      };
      if (email) {
        updateUserPayload.email = email;
        updateUserPayload.data.email = email;
      }

      const { error } = await supabase.auth.updateUser(updateUserPayload);

      if (error) throw error;

      const currentUserId = get().user?.id;
      if (!currentUserId) {
        throw new Error('Missing authenticated user while completing profile');
      }

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: currentUserId,
          full_name: fullName,
          email: email ?? get().user?.email ?? null,
          area_unit_preference:
            get().user?.user_metadata?.area_unit === 'hectares' ? 'hectares' : 'acres',
        },
        { onConflict: 'id' },
      );
      if (profileError) throw profileError;

      const normalizedAreaUnit =
        get().user?.user_metadata?.area_unit === 'hectares' ? 'hectares' : 'acres';
      queryClient.setQueryData<Profile | null>(
        PROFILE_CURRENT_QUERY_KEY,
        (previous: Profile | null | undefined) => ({
          ...(previous ?? {}),
          id: currentUserId,
          full_name: fullName,
          email: email ?? get().user?.email ?? null,
          area_unit_preference: normalizedAreaUnit,
        }),
      );
      await queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });

      const {
        data: { user },
        error: getUserError,
      } = await supabase.auth.getUser();

      if (getUserError) {
        console.warn('getUser failed after updateUser:', getUserError);
      }

      telemetry.capture('profile_completion_succeeded');
      set({
        user: user ?? get().user,
        needsProfileCompletion: false,
        isLoading: false,
      });
    } catch (error: unknown) {
      telemetry.capture('profile_completion_failed');
      const duplicateEmailMessage =
        'An account with this email already exists. Please sign in with your email first, then link your phone number from Settings.';
      set({
        errorMessage: isDuplicateEmailError(error)
          ? duplicateEmailMessage
          : getAuthErrorMessage(error, 'Failed to update profile', 'profile_update'),
        isLoading: false,
      });
    }
  },

  linkPhoneNumber: async (phone: string) => {
    const trimmedPhone = phone.trim();

    if (!isValidPhone(trimmedPhone)) {
      set({ errorMessage: 'Please enter a valid phone number with country code' });
      return;
    }

    set({ errorMessage: null, phoneLinkingLoading: true });
    telemetry.capture('phone_linking_started');

    try {
      const { error } = await supabase.auth.updateUser({ phone: trimmedPhone });
      if (error) throw error;

      telemetry.capture('phone_linking_otp_sent');
      set({
        phoneLinkingPending: true,
        phoneLinkingNumber: trimmedPhone,
        phoneLinkingLoading: false,
      });
    } catch (error: unknown) {
      telemetry.capture('phone_linking_failed');
      set({
        errorMessage: getAuthErrorMessage(
          error,
          'Failed to send verification code',
          'link_phone_otp',
        ),
        phoneLinkingLoading: false,
      });
    }
  },

  verifyPhoneLinking: async (phone: string, code: string) => {
    const trimmedCode = code.trim();

    if (trimmedCode.length !== 6 || !/^\d+$/.test(trimmedCode)) {
      set({ errorMessage: 'Please enter a valid 6-digit code' });
      return;
    }

    set({ errorMessage: null, phoneLinkingLoading: true });
    telemetry.capture('phone_linking_verify_started');

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: trimmedCode,
        type: 'phone_change',
      });

      if (error) throw error;

      telemetry.capture('phone_linking_verify_succeeded');
      set({
        user: data.user,
        session: data.session,
        phoneLinkingPending: false,
        phoneLinkingNumber: null,
        phoneLinkingLoading: false,
      });
    } catch (error: unknown) {
      telemetry.capture('phone_linking_verify_failed');
      set({
        errorMessage: getAuthErrorMessage(
          error,
          'Invalid or expired code. Please try again.',
          'verify_phone_link_otp',
        ),
        phoneLinkingLoading: false,
      });
    }
  },

  cancelPhoneLinking: () => {
    set({
      phoneLinkingPending: false,
      phoneLinkingNumber: null,
      phoneLinkingLoading: false,
      errorMessage: null,
    });
  },

  // Clear error
  clearError: () => {
    set({ errorMessage: null });
  },

  // Set onboarding complete
  setHasSeenOnboarding: (value: boolean) => {
    set({ hasSeenOnboarding: value });
  },

  // Update user country
  updateUserCountry: async (country: string) => {
    if (!country) {
      set({ errorMessage: 'Country cannot be empty' });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        data: { country },
      });

      if (error) throw error;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      set({ user });
    } catch (error: unknown) {
      set({
        errorMessage: getAuthErrorMessage(error, 'Failed to update country', 'profile_update'),
      });
    }
  },

  // Update user area unit
  updateUserAreaUnit: async (areaUnit: 'hectares' | 'acres') => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { area_unit: areaUnit },
      });

      if (error) throw error;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      set({ user });
    } catch (error: unknown) {
      set({
        errorMessage: getAuthErrorMessage(error, 'Failed to update area unit', 'profile_update'),
      });
    }
  },
}));

// Subscribe to auth state changes - but avoid disrupting navigation
let authListener: { data: { subscription: { unsubscribe: () => void } } } | null = null;

export const initAuthListener = () => {
  // Prevent multiple listeners
  if (authListener) return;

  authListener = supabase.auth.onAuthStateChange((event, session) => {
    if (__DEV__) {
      console.log('Auth state change:', event, session?.user?.email);
    }
    // Only update state for significant auth events, not token refreshes during navigation
    if (event === 'SIGNED_IN' && session) {
      const currentState = useAuthStore.getState();
      const looksLikeNewPhoneUser =
        Boolean(currentState.pendingOTPPhone) && !hasCompletedProfileName(session.user);
      const hasName = hasCompletedProfileName(session.user);
      setSentryUser(session.user);
      telemetry.identify(session.user.id, { email_domain: getEmailDomain(session.user.email) });
      telemetry.capture('auth_state_changed', { event: 'SIGNED_IN' });
      if (__DEV__) {
        console.log('[auth] Auth state changed - SIGNED_IN', {
          user_id: session.user.id,
          has_name: hasName,
          pending_otp_phone: currentState.pendingOTPPhone,
          looks_like_new_phone_user: looksLikeNewPhoneUser,
          metadata_present: Boolean(session.user.user_metadata),
        });
      }
      useAuthStore.setState((state) => ({
        ...state,
        user: session.user,
        session,
        isAuthenticated: true,
        isLoading: false,
        pendingOTPEmail: null,
        pendingOTPPhone: null,
        pendingOTPPhoneName: null,
        pendingOTPPhoneMode: null,
        otpSentSuccessfully: false,
        needsProfileCompletion: state.needsProfileCompletion || looksLikeNewPhoneUser,
      }));
    } else if (event === 'SIGNED_OUT') {
      if (__DEV__) {
        console.log('SIGNED_OUT event received, clearing auth state');
      }
      setSentryUser(null);
      telemetry.capture('auth_state_changed', { event: 'SIGNED_OUT' });
      telemetry.reset();
      useAuthStore.setState({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        pendingOTPEmail: null,
        pendingOTPPhone: null,
        pendingOTPPhoneName: null,
        pendingOTPPhoneMode: null,
        otpSentSuccessfully: false,
        pendingOTPType: 'email',
        needsProfileCompletion: false,
        phoneLinkingPending: false,
        phoneLinkingNumber: null,
        phoneLinkingLoading: false,
      });
    } else if (event === 'TOKEN_REFRESHED' && session) {
      // Silently update session without triggering navigation changes
      const currentState = useAuthStore.getState();
      if (currentState.isAuthenticated) {
        useAuthStore.setState((state) => ({
          ...state,
          session,
          user: session.user,
        }));
      }
    }
  });
};

export const cleanupAuthListener = () => {
  if (authListener) {
    authListener.data.subscription.unsubscribe();
    authListener = null;
  }
};
