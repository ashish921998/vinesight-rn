import { openAuthSessionAsync } from 'expo-web-browser';
import { getDataAccess } from '@/data-access';
import { telemetry } from '@/services/telemetry';
import {
  getAuthErrorMessage,
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
});
