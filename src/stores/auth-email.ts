import { getDataAccess } from '@/data-access';
import { telemetry } from '@/services/telemetry';
import i18n from '@/i18n';
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
import { initializeNewFarmerExperience } from './new-farmer-experience';

export const createEmailActions = (set: SetState, get: GetState) => ({
  signIn: async (email: string, password: string) => {
    set({ errorMessage: null, isLoading: true });
    telemetry.capture('auth_sign_in_started', { method: 'password' });

    try {
      const signInRequest = () =>
        getDataAccess().auth.signInWithPassword({
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

      const { data, error } = await getDataAccess().auth.signUp({
        email: email.trim(),
        password,
        options: { data: metadata },
      });

      if (error) throw error;

      await initializeNewFarmerExperience();

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
      set({ errorMessage: i18n.t('auth.validation.invalidEmail') });
      return;
    }

    if (password.length < 6) {
      set({ errorMessage: i18n.t('auth.validation.passwordTooShort') });
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

      const { data, error } = await getDataAccess().auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: metadata },
      });

      if (error) throw error;

      await initializeNewFarmerExperience();

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
      set({ errorMessage: i18n.t('auth.validation.invalidEmail') });
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
      const { error } = await getDataAccess().auth.signInWithOtp({ email: trimmedEmail });
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
      set({ errorMessage: i18n.t('auth.validation.invalidOtpCode') });
      return;
    }

    const wasAuthenticated = get().isAuthenticated;
    set({ errorMessage: null, isLoading: true });

    const { pendingOTPType } = get();
    telemetry.capture('auth_otp_verify_started', { type: pendingOTPType });

    try {
      const { data, error } = await getDataAccess().auth.verifyOtp({
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
        await initializeNewFarmerExperience();
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
        const { error } = await getDataAccess().auth.resend({
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

  resetPasswordForEmail: async (email: string) => {
    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      set({ errorMessage: i18n.t('auth.validation.invalidEmail') });
      return;
    }

    set({ errorMessage: null, isLoading: true, passwordResetEmailSent: false });
    telemetry.capture('auth_password_reset_requested');

    try {
      // PKCE flow: the recovery email links back to the app's auth callback
      // with a `code` to exchange. The `type=recovery` marker tells the
      // callback to route into the set-new-password screen instead of home.
      const { error } = await getDataAccess().auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: 'vinesight://auth/callback?type=recovery',
      });

      if (error) throw error;

      telemetry.capture('auth_password_reset_email_sent');
      set({ passwordResetEmailSent: true, isLoading: false });
    } catch (error: unknown) {
      telemetry.capture('auth_password_reset_failed');
      set({
        errorMessage: getAuthErrorMessage(error, 'Failed to send reset email', 'reset_password'),
        passwordResetEmailSent: false,
        isLoading: false,
      });
    }
  },

  updatePassword: async (newPassword: string) => {
    if (newPassword.length < 6) {
      set({ errorMessage: i18n.t('auth.validation.passwordTooShort') });
      return;
    }

    set({ errorMessage: null, isLoading: true });
    telemetry.capture('auth_password_update_started');

    try {
      const { data, error } = await getDataAccess().auth.updateUser({ password: newPassword });

      if (error) throw error;

      telemetry.capture('auth_password_update_succeeded');
      set({
        user: data.user ?? get().user,
        passwordResetEmailSent: false,
        isLoading: false,
      });
    } catch (error: unknown) {
      telemetry.capture('auth_password_update_failed');
      set({
        errorMessage: getAuthErrorMessage(error, 'Failed to update password', 'update_password'),
        isLoading: false,
      });
    }
  },

  clearPasswordResetState: () => {
    set({ passwordResetEmailSent: false, errorMessage: null });
  },
});
