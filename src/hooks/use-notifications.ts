import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import type { Subscription } from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  setupNotificationChannel,
  parseNotificationPayload,
  registerPushToken,
  resetBadgeCount,
  incrementBadgeCount,
} from '@/services/notifications';
import type { ParsedNotification } from '@/types';

/**
 * Sets up foreground/background notification listeners and deep linking.
 * Should be called once in the root layout after auth is confirmed.
 */
export function useNotificationHandlers(isAuthenticated: boolean): void {
  const router = useRouter();
  const notificationListener = useRef<Subscription | null>(null);
  const responseListener = useRef<Subscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;

    let mounted = true;

    async function setup() {
      const Notifications = await import('expo-notifications');

      // Set up Android channel
      await setupNotificationChannel();

      // Handle foreground notifications — increment badge
      notificationListener.current = Notifications.addNotificationReceivedListener(() => {
        if (mounted) {
          void incrementBadgeCount();
        }
      });

      // Handle notification tap — deep link to correct screen
      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          if (!mounted) return;
          const parsed: ParsedNotification = parseNotificationPayload(response);
          if (parsed.route) {
            // Use setTimeout to ensure navigation is ready
            setTimeout(() => {
              if (parsed.entityId) {
                router.push({
                  pathname: parsed.route as string,
                  params: { id: parsed.entityId },
                });
              } else {
                router.push(parsed.route as string);
              }
            }, 100);
          }
        },
      );

      // Register push token with backend
      await registerPushToken();
    }

    void setup();

    return () => {
      mounted = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated, router]);

  // Reset badge count when app comes to foreground
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void resetBadgeCount();
      }
    });

    // Also reset on mount (app open)
    void resetBadgeCount();

    return () => subscription.remove();
  }, []);
}
