import { openAuthSessionAsync } from 'expo-web-browser';
import { getDataAccess } from '@/data-access';
import { telemetry } from '@/services/telemetry';
import {
  getAuthErrorMessage,
  getErrorMessage,
  getEmailDomain,
  setSentryUser,
  upsertProfileNameFromAuthUserBestEffort,
} from './auth-helpers';
import type { SetState } from './auth-types';

export const createSocialActions = (set: SetState) => ({
  signInWithGoogle: async () => {
    set({ errorMessage: null, isLoading: true });
    telemetry.capture('auth_sign_in_started', { method: 'google' });

    try {
      const redirectUri = 'vinesight://auth/callback';

      const { data: oauthData, error: oauthError } = await getDataAccess().auth.signInWithOAuth({
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

        try {
          url = new URL(result.url);
          code = url.searchParams.get('code');
          queryError = url.searchParams.get('error');
        } catch (error) {
          throw new Error(`Failed to parse OAuth URL: ${result.url}. ${error}`);
        }

        if (queryError) {
          throw new Error(queryError);
        }

        if (code) {
          const { data, error } = await getDataAccess().auth.exchangeCodeForSession(code);
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
        } else {
          throw new Error('OAuth callback missing authorization code');
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

      const { data, error } = await getDataAccess().auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;

      // Apple provides fullName/email in the credential on the FIRST
      // authorization only — they are NOT included in the JWT identity token,
      // so Supabase's signInWithIdToken does not know them. We must persist
      // them to user_metadata via auth.updateUser immediately so the user is
      // not asked for name/email again on the profile-completion screen (App
      // Store Guideline 4 — Sign in with Apple).
      const givenName = credential.fullName?.givenName?.trim();
      const familyName = credential.fullName?.familyName?.trim();
      const appleEmail = credential.email?.trim();

      let effectiveUser = data.user;

      const fullName = [givenName, familyName].filter(Boolean).join(' ').trim();

      if (fullName) {
        const updatePayload = {
          data: {
            full_name: fullName,
            first_name: givenName,
            ...(familyName ? { last_name: familyName } : {}),
          },
          ...(appleEmail && !effectiveUser.email ? { email: appleEmail } : {}),
        };

        const { data: updateData, error: updateError } =
          await getDataAccess().auth.updateUser(updatePayload);
        if (updateError) {
          telemetry.capture('apple_metadata_update_failed', {
            user_id: effectiveUser.id,
            error: getErrorMessage(updateError, 'updateUser failed'),
          });
        } else if (updateData.user) {
          effectiveUser = updateData.user;
        }
      }

      await upsertProfileNameFromAuthUserBestEffort(effectiveUser, fullName || null);
      setSentryUser(effectiveUser);
      telemetry.identify(effectiveUser.id, {
        email_domain: getEmailDomain(effectiveUser.email),
      });
      telemetry.capture('auth_sign_in_succeeded', { method: 'apple' });
      telemetry.capture('user_logged_in', { method: 'apple' });
      set({
        user: effectiveUser,
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
});
