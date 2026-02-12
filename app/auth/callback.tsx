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
    let cancelled = false;

    const handleCallback = async () => {
      if (error) {
        if (!cancelled) router.replace('/(auth)/login');
        return;
      }

      const url = await Linking.getInitialURL();
      if (cancelled) return;

      const hashParams = url ? new URLSearchParams(url.split('#')[1] || '') : null;
      const tokenFromHash = hashParams?.get('access_token');
      const refreshFromHash = hashParams?.get('refresh_token');

      const resolvedAccessToken = tokenFromHash || access_token;
      const resolvedRefreshToken = refreshFromHash || refresh_token || '';

      if (code) {
        try {
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (sessionError) throw sessionError;
          if (data.session) {
            router.replace('/(tabs)');
            return;
          }
        } catch (err) {
          if (__DEV__) {
            console.error('Auth callback exchange error:', err);
          }
          if (!cancelled) router.replace('/(auth)/login');
        }
        return;
      }

      if (resolvedAccessToken) {
        if (!resolvedRefreshToken) {
          if (!cancelled) router.replace('/(auth)/login');
          return;
        }

        try {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: resolvedAccessToken,
            refresh_token: resolvedRefreshToken,
          });
          if (cancelled) return;

          if (sessionError) throw sessionError;

          if (data.session) {
            router.replace('/(tabs)');
          } else {
            router.replace('/(auth)/login');
          }
        } catch (err) {
          if (__DEV__) {
            console.error('Auth callback error:', err);
          }
          if (!cancelled) router.replace('/(auth)/login');
        }
      } else {
        if (error_description && __DEV__) {
          console.warn('Auth callback error:', error_description);
        }
        if (!cancelled) router.replace('/(auth)/login');
      }
    };

    handleCallback();

    return () => {
      cancelled = true;
    };
  }, [access_token, refresh_token, code, error, error_description, router]);

  return null;
}
