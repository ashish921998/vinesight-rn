/**
 * Push Token Hook for Vinesight
 * Handles device push token registration with Supabase
 */

import { useEffect, useCallback } from 'react';
import { getExpoPushToken, registerPushToken, unregisterPushToken } from '@/services/notifications';
import { useAuthStore } from '@/stores';

export const PUSH_TOKEN_KEY = 'vinesight_push_token_registered';

/**
 * Hook to register the device push token on app startup
 * Should be called in the root layout or auth context
 */
export function usePushTokenRegistration() {
  const user = useAuthStore((state) => state.user);

  const registerToken = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const token = await getExpoPushToken();
      if (token) {
        await registerPushToken(user.id, token);
        if (__DEV__) {
          console.log('Push token registered successfully');
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Error registering push token:', error);
      }
    }
  }, [user]);

  const unregisterToken = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      await unregisterPushToken(user.id);
      if (__DEV__) {
        console.log('Push token unregistered successfully');
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Error unregistering push token:', error);
      }
    }
  }, [user]);

  // Register token when user is available
  useEffect(() => {
    if (user) {
      registerToken();
    }
  }, [user, registerToken]);

  return {
    registerToken,
    unregisterToken,
  };
}
