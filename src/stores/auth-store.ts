import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { telemetry } from '@/services/telemetry';
import type { User, Session } from '@supabase/supabase-js';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
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
  otpSentSuccessfully: boolean;
  pendingOTPType: EmailOTPType;

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

  // Utility
  clearError: () => void;
  setHasSeenOnboarding: (value: boolean) => void;

  // Profile updates
  updateUserCountry: (country: string) => Promise<void>;
  updateUserAreaUnit: (unit: 'hectares' | 'acres') => Promise<void>;
}

// Email validation helper
const isValidEmail = (email: string): boolean => {
  const trimmed = email.trim();
  if (!trimmed) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
};

const getEmailDomain = (email: string | undefined | null) => {
  if (!email) return null;
  const [, domain] = email.split('@');
  return domain?.trim() || null;
};

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  // Initial state
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  errorMessage: null,
  pendingOTPEmail: null,
  otpSentSuccessfully: false,
  pendingOTPType: 'email',
  hasSeenOnboarding: false,

  // Initialize - check existing session
  initialize: async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (session) {
        telemetry.identify(session.user.id, { email_domain: getEmailDomain(session.user.email) });
        telemetry.capture('auth_session_restored', {
          provider: session.user.app_metadata?.provider ?? null,
        });
        set({
          user: session.user,
          session,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isLoading: false });
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

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
      telemetry.capture('auth_sign_in_failed', { method: 'password' });
      set({
        errorMessage: getErrorMessage(error, 'Sign in failed'),
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
        errorMessage: (error as { message?: string }).message || 'Sign up failed',
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
        errorMessage: (error as { message?: string }).message || 'Sign up failed',
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

      // Use consistent scheme registered in Google OAuth and Supabase
      const redirectUri = 'vinesight://auth/callback';

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL');
      }

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
          if (data.user) {
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
        errorMessage: getErrorMessage(error, 'Google sign-in failed'),
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
        errorMessage: getErrorMessage(error, 'Apple sign-in failed'),
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

      // Explicitly clear state
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        pendingOTPEmail: null,
        otpSentSuccessfully: false,
        pendingOTPType: 'email',
      });
      telemetry.reset();

      // Force clear any cached sessions from storage
      try {
        await supabase.auth.getSession();
      } catch (_e) {
        // Ignore errors when clearing cache
      }
    } catch (error: unknown) {
      if (__DEV__) {
        console.error('Sign out error:', error);
      }

      // Even if sign out fails, clear the local state to allow user to try again
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        pendingOTPEmail: null,
        otpSentSuccessfully: false,
        pendingOTPType: 'email',
      });
      telemetry.reset();
    }
  },

  // Delete account
  deleteAccount: async (deleteReason: string) => {
    set({ errorMessage: null, isLoading: true });

    try {
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

      // Clear state
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        pendingOTPEmail: null,
        otpSentSuccessfully: false,
        pendingOTPType: 'email',
      });

      if (__DEV__) {
        console.log('Account deletion request logged successfully');
      }
    } catch (error: unknown) {
      if (__DEV__) {
        console.error('Delete account error:', error);
      }

      // Preserve user state on error so they can retry
      set({
        isLoading: false,
        errorMessage: getErrorMessage(error, 'Failed to delete account'),
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
        errorMessage: getErrorMessage(error, 'Failed to send OTP'),
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
    } catch (_error: unknown) {
      telemetry.capture('auth_otp_verify_failed', { type: pendingOTPType });
      set({
        errorMessage: 'Invalid or expired code. Please try again.',
        isAuthenticated: false,
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
          errorMessage: getErrorMessage(error, 'Failed to resend code'),
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
      otpSentSuccessfully: false,
      pendingOTPType: 'email',
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
      set({ errorMessage: getErrorMessage(error, 'Failed to update country') });
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
        errorMessage: getErrorMessage(error, 'Failed to update area unit'),
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
      telemetry.identify(session.user.id, { email_domain: getEmailDomain(session.user.email) });
      telemetry.capture('auth_state_changed', { event: 'SIGNED_IN' });
      useAuthStore.setState({
        user: session.user,
        session,
        isAuthenticated: true,
        isLoading: false,
      });
    } else if (event === 'SIGNED_OUT') {
      if (__DEV__) {
        console.log('SIGNED_OUT event received, clearing auth state');
      }
      telemetry.capture('auth_state_changed', { event: 'SIGNED_OUT' });
      telemetry.reset();
      useAuthStore.setState({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        pendingOTPEmail: null,
        otpSentSuccessfully: false,
        pendingOTPType: 'email',
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
