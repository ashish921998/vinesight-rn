import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Sentry from '@sentry/react-native';
import { getDataAccess } from '@/data-access';

export default function AuthCallback() {
  const router = useRouter();
  const { code, error, error_description, type } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
    type?: string;
  }>();

  useEffect(() => {
    const handleCallback = async () => {
      const isRecovery = type === 'recovery';

      if (error) {
        if (isRecovery) {
          router.replace('/(auth)/login');
          return;
        }
        router.replace({ pathname: '/(auth)/phone-login', params: { mode: 'signin' } });
        return;
      }

      if (code) {
        try {
          const { data, error: sessionError } =
            await getDataAccess().auth.exchangeCodeForSession(code);
          if (sessionError) throw sessionError;
          if (data.session) {
            // Password recovery links sign the user in with a temporary session;
            // route them to set a new password instead of the main app.
            router.replace(isRecovery ? '/(auth)/reset-password' : '/');
            return;
          }
        } catch (err) {
          console.error('Auth callback exchange error:', err);
          if (isRecovery) {
            router.replace('/(auth)/login');
            return;
          }
          router.replace({ pathname: '/(auth)/phone-login', params: { mode: 'signin' } });
        }
        return;
      }

      const url = await Linking.getInitialURL();
      const hashParams = url ? new URLSearchParams(url.split('#')[1] || '') : null;
      const tokenOnlyCallback =
        hashParams?.has('access_token') ||
        hashParams?.has('refresh_token') ||
        url?.includes('access_token=') ||
        url?.includes('refresh_token=');

      if (tokenOnlyCallback) {
        if (__DEV__) {
          console.warn('Rejected token-based auth callback. OAuth code exchange is required.');
        } else {
          Sentry.captureMessage('Rejected token-based OAuth callback', 'warning');
        }
      }

      if (error_description && __DEV__) {
        console.warn('Auth callback error:', error_description);
      }
      router.replace({ pathname: '/(auth)/phone-login', params: { mode: 'signin' } });
    };

    handleCallback();
  }, [code, error, error_description, type, router]);

  return null;
}
