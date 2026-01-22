import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
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
  signOut: () => Promise<void>;

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

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      set({
        user: data.user,
        session: data.session,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: unknown) {
      set({
        errorMessage: getErrorMessage(error, 'Sign up failed'),
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // Sign up with email/password (direct)
  signUp: async (email: string, password: string, name?: string) => {
    set({ errorMessage: null, isLoading: true });

    try {
      const metadata = name ? { full_name: name } : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: metadata },
      });

      if (error) throw error;

      if (data.session) {
        set({
          user: data.user,
          session: data.session,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        // Email confirmation required
        set({
          pendingOTPEmail: email.trim(),
          isLoading: false,
        });
      }
    } catch (error: unknown) {
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

    try {
      const metadata = name ? { full_name: name } : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: metadata },
      });

      if (error) throw error;

      if (data.session) {
        // Email confirmation disabled, user is authenticated
        set({
          user: data.user,
          session: data.session,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        // OTP sent for email verification
        set({
          pendingOTPEmail: trimmedEmail,
          otpSentSuccessfully: true,
          isLoading: false,
        });
      }
    } catch (error: unknown) {
      set({
        errorMessage: (error as { message?: string }).message || 'Sign up failed',
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // Sign out
  signOut: async () => {
    set({ errorMessage: null, isLoading: true });

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        pendingOTPEmail: null,
        otpSentSuccessfully: false,
        pendingOTPType: 'email',
      });
    } catch (error: unknown) {
      set({
        errorMessage: getErrorMessage(error, 'Sign out failed'),
        isLoading: false,
      });
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

    try {
      const { error } = await supabase.auth.signInWithOtp({ email: trimmedEmail });
      if (error) throw error;

      set({
        pendingOTPEmail: trimmedEmail,
        otpSentSuccessfully: true,
        isLoading: false,
      });
    } catch (error: unknown) {
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

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: trimmedCode,
        type: pendingOTPType,
      });

      if (error) throw error;

      set({
        user: data.user,
        session: data.session,
        isAuthenticated: true,
        pendingOTPEmail: null,
        otpSentSuccessfully: false,
        isLoading: false,
      });
    } catch (_error: unknown) {
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
    // Only update state for significant auth events, not token refreshes during navigation
    if (event === 'SIGNED_IN' && session) {
      useAuthStore.setState({
        user: session.user,
        session,
        isAuthenticated: true,
        isLoading: false,
      });
    } else if (event === 'SIGNED_OUT') {
      useAuthStore.setState({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
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
