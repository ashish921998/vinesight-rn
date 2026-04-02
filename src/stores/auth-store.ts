import { create } from 'zustand';
import * as Sentry from '@sentry/react-native';
import { supabase } from '@/lib/supabase';
import { telemetry } from '@/services/telemetry';
import {
  getEmailDomain,
  setSentryUser,
  hasCompletedProfileName,
  maskPhoneForLogs,
} from './auth-helpers';
import type { AuthState, AuthActions } from './auth-types';
import { createEmailActions } from './auth-email';
import { createPhoneActions } from './auth-phone';
import { createSocialActions } from './auth-social';
import { createAccountActions } from './auth-account';

const initialState: AuthState = {
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
};

// Shared signed-out state for use across auth store and account actions
export const signedOutState: AuthState = {
  ...initialState,
  isLoading: false,
};

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  ...initialState,

  initialize: async () => {
    let settled = false;
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

  refreshSession: async () => {
    const { pendingOTPEmail, isAuthenticated, isLoading } = get();

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
      console.log('Session refresh failed:', error);
    }
  },

  clearError: () => {
    set({ errorMessage: null });
  },

  setHasSeenOnboarding: (value: boolean) => {
    set({ hasSeenOnboarding: value });
  },

  ...createEmailActions(set, get),
  ...createPhoneActions(set, get),
  ...createSocialActions(set),
  ...createAccountActions(set, get),
}));

// Subscribe to auth state changes
let authListener: { data: { subscription: { unsubscribe: () => void } } } | null = null;

export const initAuthListener = () => {
  if (authListener) return;

  authListener = supabase.auth.onAuthStateChange((event, session) => {
    if (__DEV__) {
      console.log('Auth state change:', event, session?.user?.email);
    }
    if (event === 'SIGNED_IN' && session) {
      const currentState = useAuthStore.getState();
      const looksLikeNewPhoneUser =
        Boolean(currentState.pendingOTPPhone) && !hasCompletedProfileName(session.user);
      const hasName = hasCompletedProfileName(session.user);
      setSentryUser(session.user);
      telemetry.identify(session.user.id, { email_domain: getEmailDomain(session.user.email) });
      telemetry.capture('auth_state_changed', { event: 'SIGNED_IN' });
      if (__DEV__) {
        const maskedPendingOTPPhone = maskPhoneForLogs(currentState.pendingOTPPhone);
        console.log('[auth] Auth state changed - SIGNED_IN', {
          user_id: session.user.id,
          has_name: hasName,
          pending_otp_phone: maskedPendingOTPPhone,
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
      useAuthStore.setState(signedOutState);
    } else if (event === 'TOKEN_REFRESHED' && session) {
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
