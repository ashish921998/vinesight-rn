import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Sentry from '@sentry/react-native';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const { code, error, error_description } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();

  useEffect(() => {
    const handleCallback = async () => {
      if (error) {
        router.replace({ pathname: '/(auth)/phone-login', params: { mode: 'signin' } });
        return;
      }

      if (code) {
        try {
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) throw sessionError;
          if (data.session) {
            router.replace('/');
            return;
          }
        } catch (err) {
          console.error('Auth callback exchange error:', err);
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
        }
        Sentry.captureMessage('Rejected token-based OAuth callback', 'warning');
      }

      if (error_description && __DEV__) {
        console.warn('Auth callback error:', error_description);
      }
      router.replace({ pathname: '/(auth)/phone-login', params: { mode: 'signin' } });
    };

    handleCallback();
  }, [code, error, error_description, router]);

  return null;
}
