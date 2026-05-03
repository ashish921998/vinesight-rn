import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/query-cache';
import { telemetry } from '@/services/telemetry';
import type { Profile } from '@/types';
import {
  getErrorMessage,
  isOtpSignupDisabledError,
  isDuplicateEmailError,
  getAuthErrorMessage,
  isValidEmail,
  isValidPhone,
  sendPhoneOtpPreferringWhatsApp,
  getEmailDomain,
  setSentryUser,
  hasCompletedProfileName,
  upsertProfileNameFromAuthUserBestEffort,
  PROFILE_QUERY_KEY,
  PROFILE_CURRENT_QUERY_KEY,
} from './auth-helpers';
import type { SetState, GetState } from './auth-types';

export const createPhoneActions = (set: SetState, get: GetState) => ({
  signInWithPhone: async (phone: string, mode: 'signin' | 'signup' = 'signin', name?: string) => {
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

      await sendPhoneOtpPreferringWhatsApp(trimmedPhone, options);

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

  /**
   * Unified phone auth: tries signup first (creates user if new), falls back
   * to signin if the user already exists. Farmers never see login vs signup.
   */
  signInWithPhoneAuto: async (phone: string, name?: string) => {
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
    telemetry.capture('auth_phone_otp_send_started', { mode: 'auto' });
    if (__DEV__) {
      console.log('[auth] signInWithPhoneAuto', { phone: maskedPhone });
    }

    try {
      // Try signup first — Supabase sends OTP for both new and existing users
      // when shouldCreateUser is true.
      const signupOptions: { shouldCreateUser: boolean; data?: { full_name?: string } } = {
        shouldCreateUser: true,
      };
      if (name?.trim()) {
        signupOptions.data = { full_name: name.trim() };
      }

      let effectiveMode: 'signup' | 'signin' = 'signup';

      try {
        await sendPhoneOtpPreferringWhatsApp(trimmedPhone, signupOptions);
      } catch (error: unknown) {
        // If OTP signups are disabled, fall back to signin-only mode
        if (isOtpSignupDisabledError(error)) {
          if (__DEV__) {
            console.log('[auth] signInWithPhoneAuto - signup disabled, falling back to signin');
          }
          await sendPhoneOtpPreferringWhatsApp(trimmedPhone, { shouldCreateUser: false });
          effectiveMode = 'signin';
        } else {
          throw error;
        }
      }
      telemetry.capture('auth_phone_otp_send_succeeded', { mode: 'auto' });
      set({
        pendingOTPPhone: trimmedPhone,
        pendingOTPPhoneName: name?.trim() ? name.trim() : null,
        pendingOTPPhoneMode: effectiveMode,
        otpSentSuccessfully: true,
        isLoading: false,
      });
    } catch (error: unknown) {
      telemetry.capture('auth_phone_otp_send_failed', { mode: 'auto' });
      set({
        errorMessage: getAuthErrorMessage(
          error,
          'Failed to send verification code. Please try again.',
          'send_phone_otp',
        ),
        otpSentSuccessfully: false,
        isLoading: false,
      });
    }
  },

  verifyPhoneOTP: async (phone: string, code: string) => {
    const trimmedCode = code.trim();

    if (trimmedCode.length !== 6 || !/^\d+$/.test(trimmedCode)) {
      set({ errorMessage: 'Please enter a valid 6-digit code' });
      return;
    }

    const wasAuthenticated = get().isAuthenticated;
    const pendingSignupName = get().pendingOTPPhoneName;
    const pendingPhoneMode = get().pendingOTPPhoneMode;
    set({ errorMessage: null, isLoading: true });
    telemetry.capture('auth_phone_otp_verify_started');

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: trimmedCode,
        type: 'sms',
      });

      if (error) throw error;

      const isSignup = pendingPhoneMode === 'signup';
      const needsProfileCompletion = !hasCompletedProfileName(data.user);

      // Set auth state FIRST before any side-effects that could throw
      if (isSignup && data.user) {
        set({
          user: data.user,
          session: data.session,
          isAuthenticated: true,
          pendingOTPPhone: null,
          pendingOTPPhoneName: null,
          pendingOTPPhoneMode: null,
          otpSentSuccessfully: false,
          needsProfileCompletion,
          isLoading: false,
        });
      } else {
        set({
          user: data.user,
          session: data.session,
          isAuthenticated: Boolean(data.user),
          pendingOTPPhone: null,
          pendingOTPPhoneName: null,
          pendingOTPPhoneMode: null,
          otpSentSuccessfully: false,
          needsProfileCompletion,
          isLoading: false,
        });
      }

      // Run side-effects in isolated try/catch so failures don't rollback auth state
      try {
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

        if (isSignup && data.user) {
          await upsertProfileNameFromAuthUserBestEffort(data.user, pendingSignupName || undefined);
          telemetry.capture('user_signed_up', {
            method: 'phone',
            has_signup_name: Boolean(pendingSignupName),
          });
        } else if (data.user) {
          await upsertProfileNameFromAuthUserBestEffort(data.user);
          telemetry.capture('user_logged_in', { method: 'phone' });
        }
      } catch (sideEffectError) {
        if (__DEV__) {
          console.error('verifyOtp side-effects error:', sideEffectError);
        }
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

  resendPhoneOTP: async (mode?: 'signin' | 'signup', phone?: string) => {
    const { pendingOTPPhone, pendingOTPPhoneName, pendingOTPPhoneMode, signInWithPhone } = get();
    const resendPhone = phone?.trim() || pendingOTPPhone;
    if (!resendPhone) {
      set({ errorMessage: 'Phone number is missing. Please enter it again.' });
      return;
    }
    await signInWithPhone(
      resendPhone,
      pendingOTPPhoneMode ?? mode ?? 'signin',
      pendingOTPPhoneName || undefined,
    );
  },

  cancelPhoneOTPFlow: () => {
    set({
      pendingOTPPhone: null,
      pendingOTPPhoneName: null,
      pendingOTPPhoneMode: null,
      otpSentSuccessfully: false,
      errorMessage: null,
    });
  },

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
        let query = supabase.from('profiles').select('id').eq('email', email);
        if (currentUserId) {
          query = query.neq('id', currentUserId);
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
        if (__DEV__) {
          console.warn('getUser failed after updateUser:', getUserError);
        }
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
});
