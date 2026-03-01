import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const { access_token, refresh_token, code, error, error_description } = useLocalSearchParams<{
    access_token?: string;
    refresh_token?: string;
    code?: string;
    error?: string;
    error_description?: string;
  }>();

  useEffect(() => {
    const handleCallback = async () => {
      if (error) {
        router.replace('/(auth)/phone-login');
        return;
      }

      const url = await Linking.getInitialURL();
      const hashParams = url ? new URLSearchParams(url.split('#')[1] || '') : null;
      const tokenFromHash = hashParams?.get('access_token');
      const refreshFromHash = hashParams?.get('refresh_token');

      const resolvedAccessToken = tokenFromHash || access_token;
      const resolvedRefreshToken = refreshFromHash || refresh_token || '';

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
          router.replace('/(auth)/phone-login');
        }
        return;
      }

      if (resolvedAccessToken) {
        if (!resolvedRefreshToken) {
          router.replace('/(auth)/phone-login');
          return;
        }

        try {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: resolvedAccessToken,
            refresh_token: resolvedRefreshToken,
          });

          if (sessionError) throw sessionError;

          if (data.session) {
            router.replace('/');
          } else {
            router.replace('/(auth)/phone-login');
          }
        } catch (err) {
          console.error('Auth callback error:', err);
          router.replace('/(auth)/phone-login');
        }
      } else {
        if (error_description && __DEV__) {
          console.warn('Auth callback error:', error_description);
        }
        router.replace('/(auth)/phone-login');
      }
    };

    handleCallback();
  }, [access_token, refresh_token, code, error, error_description, router]);

  return null;
}
