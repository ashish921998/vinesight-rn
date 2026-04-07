import { supabase } from '@/lib/supabase';
import { telemetry } from '@/services/telemetry';
import {
  isNetworkTimeoutError,
  getAuthErrorMessage,
  isValidEmail,
  getEmailDomain,
  setSentryUser,
  sleep,
  upsertProfileNameFromAuthUserBestEffort,
} from './auth-helpers';
import type { SetState, GetState } from './auth-types';

export const createEmailActions = (set: SetState, get: GetState) => ({
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
        set({
          user: data.user,
          session: data.session,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        telemetry.capture('auth_sign_up_succeeded', { method: 'otp', confirmed: false });
        telemetry.capture('user_signed_up', { method: 'otp', confirmed: false });
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
});
