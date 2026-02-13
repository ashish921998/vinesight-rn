import { useEffect } from 'react';
import { Alert } from 'react-native';
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
    const redirectToLogin = (errorMessage?: string) => {
      if (errorMessage) {
        Alert.alert('Authentication Error', errorMessage, [
          { text: 'OK', onPress: () => router.replace('/(auth)/login') },
        ]);
      } else {
        router.replace('/(auth)/login');
      }
    };

    const handleCallback = async () => {
      if (error) {
        redirectToLogin(error_description || 'Authentication failed. Please try again.');
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
            router.replace('/(tabs)');
            return;
          }
        } catch (err) {
          if (__DEV__) {
            console.error('Auth callback exchange error:', err);
          }
          redirectToLogin('Failed to complete sign in. Please try again.');
        }
        return;
      }

      if (resolvedAccessToken) {
        if (!resolvedRefreshToken) {
          redirectToLogin('Invalid authentication response. Please try again.');
          return;
        }

        try {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: resolvedAccessToken,
            refresh_token: resolvedRefreshToken,
          });

          if (sessionError) throw sessionError;

          if (data.session) {
            router.replace('/(tabs)');
          } else {
            redirectToLogin();
          }
        } catch (err) {
          if (__DEV__) {
            console.error('Auth callback error:', err);
          }
          redirectToLogin('Failed to complete sign in. Please try again.');
        }
      } else {
        if (__DEV__ && error_description) {
          console.warn('Auth callback error:', error_description);
        }
        redirectToLogin();
      }
    };

    handleCallback();
  }, [access_token, refresh_token, code, error, error_description, router]);

  return null;
}
