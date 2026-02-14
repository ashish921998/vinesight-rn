import { useEffect, useMemo, useRef } from 'react';
import { Stack, usePathname, useSegments } from 'expo-router';
import { Platform, Text, TextInput, type StyleProp, type TextStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import * as WebBrowser from 'expo-web-browser';
import { PostHogProvider } from 'posthog-react-native';
import {
  useAuthStore,
  initAuthListener,
  cleanupAuthListener,
  useLanguageStore,
  useNotificationStore,
  useThemeStore,
} from '@/stores';
import { ErrorBoundary } from '@/components/error-boundary';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { PowerSyncProviderWrapper } from '@/lib/powersync';
import i18n, { getDeviceLanguage, setAppLanguage } from '@/i18n';
import {
  cancelNotification,
  scheduleDailyWaterReminder,
  scheduleTaskDueReminder,
} from '@/services/notifications';
import { posthogClient, telemetry, telemetryEnabled } from '@/services/telemetry';
import { androidTextPadding } from '@/styles/theme';
import { useThemeTokens } from '@/styles/use-theme';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

interface DefaultPropsCarrier {
  defaultProps?: { style?: StyleProp<TextStyle> };
}

let androidTextPatched = false;

const normalizeRoutePart = (part: string) => {
  const trimmed = part.trim();
  if (!trimmed) return trimmed;
  if (/^\d+$/.test(trimmed)) return ':id';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return ':id';
  }
  if (trimmed.length >= 24 && /^[0-9a-z_-]+$/i.test(trimmed)) return ':id';
  return trimmed;
};

const normalizePath = (path: string) =>
  path
    .split('/')
    .map((p) => normalizeRoutePart(p))
    .join('/')
    .replace(/\/{2,}/g, '/');

if (Platform.OS === 'android' && !androidTextPatched) {
  androidTextPatched = true;

  const TextWithDefaults = Text as unknown as DefaultPropsCarrier;
  const TextInputWithDefaults = TextInput as unknown as DefaultPropsCarrier;

  TextWithDefaults.defaultProps = {
    ...(TextWithDefaults.defaultProps ?? {}),
    style: [
      {
        includeFontPadding: true,
        paddingBottom: androidTextPadding.bottom,
        paddingRight: androidTextPadding.right,
      },
      TextWithDefaults.defaultProps?.style,
    ],
  };

  TextInputWithDefaults.defaultProps = {
    ...(TextInputWithDefaults.defaultProps ?? {}),
    style: [
      {
        includeFontPadding: true,
        paddingBottom: androidTextPadding.bottom,
        paddingRight: androidTextPadding.right,
      },
      TextInputWithDefaults.defaultProps?.style,
    ],
  };
}

// Initialize Sentry (avoid crashing startup if env/config is missing)
try {
  Sentry.init({
    dsn: sentryDsn,
    enabled: !__DEV__ && Boolean(sentryDsn), // Only track errors in production when configured
    debug: __DEV__, // Show debug info in development
    tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
    integrations: [Sentry.reactNativeTracingIntegration()],
  });
} catch (error) {
  if (__DEV__) {
    console.error('Sentry initialization failed:', error);
  }
}

// Prevent auto-hide splash screen
void SplashScreen.preventAutoHideAsync().catch(() => null);
WebBrowser.maybeCompleteAuthSession();

// Create a client outside component to prevent recreation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

export default Sentry.wrap(function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);
  const themeHydrated = useThemeStore((state) => state.hasHydrated);
  const { isDark, m3 } = useThemeTokens();

  const pathname = usePathname();
  const segments = useSegments();
  const screenName = useMemo(() => {
    const normalizedSegments = segments.filter(Boolean).map(normalizeRoutePart).join('/');
    const normalizedPath = pathname?.trim() ? normalizePath(pathname) : '/';
    return normalizedSegments ? `${normalizedPath} (${normalizedSegments})` : normalizedPath;
  }, [pathname, segments]);

  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const languageHydrated = useLanguageStore((s) => s.hasHydrated);

  const notificationsHydrated = useNotificationStore((s) => s.hasHydrated);
  const prevLanguageRef = useRef<string | null>(null);
  const reschedulePromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    // Initialize auth state
    const init = async () => {
      await initialize();
      // Initialize auth listener AFTER navigation is set up
      initAuthListener();
    };

    init();

    // Cleanup listener on unmount
    return () => {
      cleanupAuthListener();
    };
  }, [initialize]);

  useEffect(() => {
    if (!screenName) return;
    telemetry.screen(screenName);
  }, [screenName]);

  useEffect(() => {
    if (!languageHydrated) return;

    const effective = language ?? getDeviceLanguage();
    if (!language) {
      setLanguage(effective);
      prevLanguageRef.current = effective;
    }
    setAppLanguage(effective);
  }, [language, languageHydrated, setLanguage]);

  useEffect(() => {
    if (!languageHydrated || !notificationsHydrated) return;

    // Only run when language actually changes.
    if (prevLanguageRef.current === language) return;

    // Skip initial mount after hydration
    if (prevLanguageRef.current === null) {
      prevLanguageRef.current = language;
      return;
    }

    // Guard against overlapping reschedules
    if (reschedulePromiseRef.current !== null) return;

    const reschedule = async () => {
      const state = useNotificationStore.getState();

      try {
        if (state.dailyWaterReminderEnabled) {
          try {
            if (state.dailyWaterReminderNotificationId) {
              await cancelNotification(state.dailyWaterReminderNotificationId);
            }
            const nextId = await scheduleDailyWaterReminder();
            if (nextId) {
              useNotificationStore.setState({ dailyWaterReminderNotificationId: nextId });
            }
          } catch (error) {
            if (__DEV__) {
              console.error('Failed to reschedule daily water reminder:', error);
            }
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Failed to access daily water reminder state:', error);
        }
      }

      try {
        if (state.taskRemindersEnabled) {
          try {
            const entries = Object.entries(state.taskSchedules);
            for (const [taskId, schedule] of entries) {
              try {
                if (schedule.notificationId) {
                  await cancelNotification(schedule.notificationId);
                }
                const nextId = await scheduleTaskDueReminder(taskId, schedule.dueDate);
                if (nextId) {
                  useNotificationStore.getState().upsertTaskSchedule(taskId, {
                    notificationId: nextId,
                    dueDate: schedule.dueDate,
                  });
                } else {
                  useNotificationStore.getState().removeTaskSchedule(taskId);
                }
              } catch (error) {
                if (__DEV__) {
                  console.error(`Failed to reschedule task ${taskId}:`, error);
                }
              }
            }
          } catch (error) {
            if (__DEV__) {
              console.error('Failed to iterate task schedules:', error);
            }
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Failed to access task reminders state:', error);
        }
      } finally {
        reschedulePromiseRef.current = null;
      }
    };

    prevLanguageRef.current = language;
    reschedulePromiseRef.current = reschedule();

    return () => {
      reschedulePromiseRef.current = null;
    };
  }, [language, languageHydrated, notificationsHydrated]);

  useEffect(() => {
    // Hide splash screen when auth + language are loaded
    if (!isLoading && languageHydrated && themeHydrated) {
      void SplashScreen.hideAsync().catch(() => null);
    }
  }, [isLoading, languageHydrated, themeHydrated]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    document.body.style.backgroundColor = m3.colorScheme.background;
    document.body.style.color = m3.colorScheme.onBackground;
  }, [m3]);

  if (!themeHydrated) return null;

  const content = (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <PowerSyncProviderWrapper>
            <I18nextProvider i18n={i18n}>
              <StatusBar style={isDark ? 'light' : 'dark'} />
              <OfflineBanner />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: m3.colorScheme.background },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="add-activity" options={{ presentation: 'modal' }} />
                <Stack.Screen name="add-entry" options={{ presentation: 'modal' }} />
                <Stack.Screen name="add-task" options={{ presentation: 'modal' }} />
                <Stack.Screen name="add-worker" options={{ presentation: 'modal' }} />
                <Stack.Screen name="add-soil-profile" options={{ presentation: 'modal' }} />
                <Stack.Screen name="add-stock" options={{ presentation: 'modal' }} />
                <Stack.Screen
                  name="add-warehouse-item"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen name="add-lab-test" options={{ presentation: 'modal' }} />
                <Stack.Screen name="water-level" options={{ presentation: 'modal' }} />
                <Stack.Screen name="log-entry/add" options={{ presentation: 'modal' }} />
                <Stack.Screen name="log-entry/edit/[id]" options={{ presentation: 'modal' }} />
                <Stack.Screen name="edit-activity/[id]" options={{ presentation: 'modal' }} />
              </Stack>
            </I18nextProvider>
            </PowerSyncProviderWrapper>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );

  if (!telemetryEnabled || Platform.OS === 'web' || !posthogClient) return content;

  return (
    <PostHogProvider
      client={posthogClient}
      autocapture={{
        captureScreens: false,
        captureTouches: true,
      }}
      debug={__DEV__}
    >
      {content}
    </PostHogProvider>
  );
});
