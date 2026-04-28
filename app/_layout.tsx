import { useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { Platform, Text, TextInput, type StyleProp, type TextStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
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
import i18n, { getDeviceLanguage, setAppLanguage } from '@/i18n';
import {
  cancelNotification,
  scheduleDailyWaterReminder,
  schedulePetioleTestReminder,
  scheduleTaskDueReminder,
} from '@/services/notifications';
import { addDays } from '@/utils/date';
import { usePetioleTestReminders } from '@/hooks/use-petiole-reminders';
import { posthogClient, telemetry, telemetryEnabled } from '@/services/telemetry';
import { androidTextPadding } from '@/styles/theme';
import { useThemeTokens } from '@/styles/use-theme';
import { queryClient, queryPersister, QUERY_CACHE_MAX_AGE_MS } from '@/lib/query-cache';
import { GuidedTourController, guidedTourEmit } from '@/features/guided-tour';
import { syncPushDeviceRegistration } from '@/features/guided-tour/service';
import { resolveFeatureOverviewRoute } from '@/services/feature-overview-notifications';

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
  const tracesSampleRateEnv = Number.parseFloat(
    process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '',
  );
  const tracesSampleRate = Number.isFinite(tracesSampleRateEnv) ? tracesSampleRateEnv : 0.7;
  Sentry.init({
    dsn: sentryDsn,
    enabled: !__DEV__ && Boolean(sentryDsn), // Only track errors in production when configured
    debug: __DEV__, // Show debug info in development
    tracesSampleRate,
    integrations: [Sentry.reactNativeTracingIntegration()],
  });
} catch (error) {
  if (__DEV__) {
    console.error('Sentry initialization failed:', error);
  }
}

// Prevent auto-hide splash screen
const splashKey = '@@vinesight-splash-prevented';
const globalThisWithSplash = globalThis as typeof globalThis & { [key: string]: boolean };
if (globalThisWithSplash[splashKey] !== true) {
  void SplashScreen.preventAutoHideAsync().catch(() => null);
  globalThisWithSplash[splashKey] = true;
}
WebBrowser.maybeCompleteAuthSession();

function PetioleReminderSync() {
  usePetioleTestReminders();
  return null;
}

export default Sentry.wrap(function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const needsProfileCompletion = useAuthStore((state) => state.needsProfileCompletion);
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
  const setDetectedLanguage = useLanguageStore((s) => s.setDetectedLanguage);
  const languageHydrated = useLanguageStore((s) => s.hasHydrated);

  const notificationsHydrated = useNotificationStore((s) => s.hasHydrated);
  const notificationPermissionPrompted = useNotificationStore(
    (s) => s.notificationPermissionPrompted,
  );
  const setNotificationPermissionPrompted = useNotificationStore(
    (s) => s.setNotificationPermissionPrompted,
  );
  const prevLanguageRef = useRef<string | null>(null);
  const reschedulePromiseRef = useRef<Promise<void> | null>(null);
  const router = useRouter();
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  });

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
    if (Platform.OS === 'web') return;
    if (
      isLoading ||
      !themeHydrated ||
      !languageHydrated ||
      !notificationsHydrated ||
      !isAuthenticated ||
      needsProfileCompletion ||
      notificationPermissionPrompted
    ) {
      return;
    }
    if (!pathname || pathname === '/') return;
    if (pathname === '/onboarding' || segments[0] === 'onboarding') return;
    if (segments[0] === '(auth)') return;

    let cancelled = false;
    let languageUnsub: (() => void) | null = null;

    const subscribeAndSyncLanguage = () => {
      languageUnsub = useLanguageStore.subscribe((state) => {
        if (cancelled) {
          languageUnsub?.();
          return;
        }
        if (state.language === 'en' || state.language === 'hi' || state.language === 'mr') {
          const notificationState = useNotificationStore.getState();
          syncPushDeviceRegistration(state.language, {
            notificationsEnabled: true,
            featureOverviewEnabled: notificationState.featureOverviewEnabled,
          })
            .then(() => {
              if (!cancelled) languageUnsub?.();
            })
            .catch(() => {
              if (!cancelled) languageUnsub?.();
            });
        }
      });
    };

    const requestNotificationPermission = async () => {
      try {
        const Notifications = await import('expo-notifications');
        const permission = await Notifications.getPermissionsAsync();
        if (cancelled) return;

        if (permission.status === 'granted') {
          if (language) {
            const notificationState = useNotificationStore.getState();
            await syncPushDeviceRegistration(language, {
              notificationsEnabled: true,
              featureOverviewEnabled: notificationState.featureOverviewEnabled,
            });
          } else {
            subscribeAndSyncLanguage();
          }
          setNotificationPermissionPrompted(true);
          return;
        }

        if (!permission.canAskAgain && permission.status !== 'undetermined') {
          setNotificationPermissionPrompted(true);
          return;
        }

        const requested = await Notifications.requestPermissionsAsync();
        if (cancelled) return;

        if (requested.status === 'granted') {
          if (language) {
            const notificationState = useNotificationStore.getState();
            await syncPushDeviceRegistration(language, {
              notificationsEnabled: true,
              featureOverviewEnabled: notificationState.featureOverviewEnabled,
            });
          } else {
            subscribeAndSyncLanguage();
          }
        }
        setNotificationPermissionPrompted(true);
      } catch (error) {
        if (__DEV__) {
          console.warn('Failed to request notification permissions on first app open:', error);
        }
      }
    };

    void requestNotificationPermission();

    return () => {
      cancelled = true;
      languageUnsub?.();
    };
  }, [
    isAuthenticated,
    isLoading,
    language,
    languageHydrated,
    needsProfileCompletion,
    notificationPermissionPrompted,
    notificationsHydrated,
    pathname,
    segments,
    setNotificationPermissionPrompted,
    themeHydrated,
  ]);

  useEffect(() => {
    if (!languageHydrated) return;

    const effective = language ?? getDeviceLanguage();
    if (!language) {
      setDetectedLanguage(effective);
      prevLanguageRef.current = effective;
    }
    setAppLanguage(effective);
  }, [language, languageHydrated, setDetectedLanguage]);

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

      if (language === 'en' || language === 'hi' || language === 'mr') {
        try {
          await syncPushDeviceRegistration(language, {
            notificationsEnabled: true,
            featureOverviewEnabled: state.featureOverviewEnabled,
          });
        } catch (error) {
          if (__DEV__) {
            console.error('Failed to sync push device metadata:', error);
          }
        }
      }

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
                const legacy = schedule as {
                  notificationIds?: string[];
                  notificationId?: string;
                  dueDate: string;
                };
                const oldIds = Array.isArray(legacy.notificationIds)
                  ? legacy.notificationIds
                  : legacy.notificationId
                    ? [legacy.notificationId]
                    : [];
                await Promise.allSettled(oldIds.map((id) => cancelNotification(id)));
                const nextIds = await scheduleTaskDueReminder(taskId, schedule.dueDate, {
                  allowImmediateToday: false,
                });
                if (nextIds.length > 0) {
                  useNotificationStore.getState().upsertTaskSchedule(taskId, {
                    notificationIds: nextIds,
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
      }

      try {
        if (state.petioleTestRemindersEnabled) {
          try {
            const petioleEntries = Object.entries(state.petioleTestSchedules);
            for (const [farmId, schedule] of petioleEntries) {
              const MILESTONES = [30, 60, 90, 120] as const;
              await Promise.allSettled(
                schedule.notificationIds.map((id) => cancelNotification(id)),
              );
              const pruningDate = schedule.pruningDate;
              const farmName = schedule.farmName ?? farmId;
              const newIds: string[] = [];
              for (const day of MILESTONES) {
                const targetDateStr = addDays(pruningDate, day);
                if (!targetDateStr) continue;
                const notifId = await schedulePetioleTestReminder(
                  farmName,
                  farmId,
                  day,
                  targetDateStr,
                );
                if (notifId) newIds.push(notifId);
              }
              if (newIds.length > 0) {
                useNotificationStore.getState().upsertPetioleTestSchedule(farmId, {
                  notificationIds: newIds,
                  pruningDate,
                  farmName,
                });
              } else {
                useNotificationStore.getState().removePetioleTestSchedule(farmId);
              }
            }
          } catch (error) {
            if (__DEV__) {
              console.error('Failed to reschedule petiole test reminders:', error);
            }
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Failed to access petiole test reminders state:', error);
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

  // Configure foreground notification display + Android channel
  useEffect(() => {
    let disposed = false;
    const setup = async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (disposed) return;
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        if (Platform.OS === 'android') {
          type AndroidChannelInput = Parameters<
            typeof Notifications.setNotificationChannelAsync
          >[1];
          const channelConfig: AndroidChannelInput = {
            name: 'Farm Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
          };
          await Notifications.setNotificationChannelAsync('vinesight-reminders', channelConfig);
        }
      } catch {
        // ignore
      }
    };
    void setup();
    return () => {
      disposed = true;
    };
  }, []);

  // Handle notification taps → deep-link to the appropriate screen
  useEffect(() => {
    let cleanup: null | (() => void) = null;
    let disposed = false;

    const handleNotificationResponse = (response: {
      notification: { request: { content: { data: unknown } } };
    }) => {
      const data = response.notification.request.content.data as {
        type?: string;
        sequence?: number;
        route?: string;
        campaign?: string;
        day?: number;
      };
      const currentRouter = routerRef.current;
      if (!currentRouter) return;

      if (data?.type === 'guided_tour_reminder') {
        const sequence = data.sequence === 2 ? 2 : 1;
        guidedTourEmit('guidedTour.notificationOpened', { sequence });
      } else if (data?.type === 'feature_overview') {
        const route = resolveFeatureOverviewRoute(data);
        if (!route) {
          telemetry.capture('feature_overview_notification_invalid_route', {
            route: data.route ?? null,
            campaign: data.campaign ?? null,
            day: data.day ?? null,
          });
          return;
        }
        currentRouter.push(route);
      } else if (
        data?.type === 'task_due' ||
        data?.type === 'task_due_tomorrow' ||
        data?.type === 'task_overdue'
      ) {
        currentRouter.push('/tasks');
      } else if (data?.type === 'low_water') {
        currentRouter.push('/(tabs)');
      } else if (data?.type === 'warehouse_reorder') {
        currentRouter.push('/warehouse');
      } else if (data?.type === 'petiole_test') {
        currentRouter.push('/(tabs)');
      } else if (data?.type === 'custom') {
        // Custom notifications have no navigation target
      }
    };

    const setup = async () => {
      try {
        const Notifications = await import('expo-notifications');

        // Handle cold-start notification tap
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          handleNotificationResponse(lastResponse);
          await Notifications.clearLastNotificationResponseAsync();
        }

        const sub = Notifications.addNotificationResponseReceivedListener((response) => {
          handleNotificationResponse(response);
        });
        if (disposed) {
          sub.remove();
          return;
        }
        cleanup = () => sub.remove();
      } catch {
        cleanup = null;
      }
    };

    void setup();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  // Safety timeout: if initialization hangs (e.g. SecureStore on Android),
  // force-complete all conditions so the app doesn't stay on splash forever.
  useEffect(() => {
    const INIT_TIMEOUT_MS = 8_000;
    const timeout = setTimeout(() => {
      const authStillLoading = useAuthStore.getState().isLoading;
      const themeStillPending = !useThemeStore.getState().hasHydrated;
      const langStillPending = !useLanguageStore.getState().hasHydrated;

      if (authStillLoading || themeStillPending || langStillPending) {
        const context = {
          authStillLoading,
          themeHydrated: !themeStillPending,
          languageHydrated: !langStillPending,
        };
        if (__DEV__) {
          console.warn(
            `[Vinesight] App init timed out after ${INIT_TIMEOUT_MS}ms — ` +
              `auth loading: ${authStillLoading}, ` +
              `theme hydrated: ${!themeStillPending}, ` +
              `language hydrated: ${!langStillPending}. Forcing splash hide.`,
          );
        }
        Sentry.captureMessage('App init timed out — forcing splash hide', {
          level: 'warning',
          extra: { timeoutMs: INIT_TIMEOUT_MS, ...context },
        });
        if (authStillLoading) {
          useAuthStore.setState({ isLoading: false });
        }
        if (themeStillPending) {
          AsyncStorage.getItem('vinesight-theme')
            .then((data) => {
              if (data) {
                const parsed = JSON.parse(data);
                const state = parsed.state ?? parsed;
                useThemeStore.setState(state);
              }
            })
            .catch(() => {})
            .finally(() => useThemeStore.setState({ hasHydrated: true }));
        }
        if (langStillPending) {
          AsyncStorage.getItem('vinesight-language')
            .then((data) => {
              if (data) {
                const parsed = JSON.parse(data);
                const state = parsed.state ?? parsed;
                useLanguageStore.setState(state);
              }
            })
            .catch(() => {})
            .finally(() => useLanguageStore.setState({ hasHydrated: true }));
        }
      }
    }, INIT_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    // Hide splash screen when auth + language are loaded
    if (!isLoading && languageHydrated && themeHydrated) {
      SplashScreen.hideAsync().catch((error) => {
        if (__DEV__) {
          console.warn('Failed to hide splash screen (safe to ignore during hot reload):', error);
        }
      });
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
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: queryPersister,
              maxAge: QUERY_CACHE_MAX_AGE_MS,
            }}
          >
            <PetioleReminderSync />
            <I18nextProvider i18n={i18n}>
              <StatusBar style={isDark ? 'light' : 'dark'} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: m3.colorScheme.background },
                  headerStyle: {
                    backgroundColor: m3.colorScheme.surface,
                  },
                  headerTitleStyle: {
                    color: m3.colorScheme.onSurface,
                    fontWeight: '600',
                    fontSize: 18,
                  },
                  headerTintColor: m3.colorScheme.primary,
                  headerShadowVisible: false,
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen
                  name="language-selection"
                  options={{ headerShown: false, gestureEnabled: false }}
                />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="add-activity"
                  options={{ presentation: 'fullScreenModal', headerShown: false }}
                />
                <Stack.Screen
                  name="add-entry"
                  options={{ presentation: 'fullScreenModal', headerShown: false }}
                />
                <Stack.Screen
                  name="add-task"
                  options={{ presentation: 'fullScreenModal', headerShown: false }}
                />
                <Stack.Screen
                  name="add-worker"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen
                  name="add-soil-profile"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen
                  name="add-stock"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen
                  name="add-warehouse-item"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen
                  name="add-lab-test"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen
                  name="water-level"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen
                  name="log-entry/add"
                  options={{ presentation: 'fullScreenModal', headerShown: false }}
                />
                <Stack.Screen
                  name="log-entry/edit/[id]"
                  options={{ presentation: 'fullScreenModal', headerShown: false }}
                />
                <Stack.Screen
                  name="edit-activity/[id]"
                  options={{ presentation: 'fullScreenModal', headerShown: false }}
                />
                <Stack.Screen name="add-note" options={{ headerShown: false }} />
                <Stack.Screen name="analytics" options={{ headerShown: true }} />
                <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
                <Stack.Screen name="calculator" options={{ headerShown: false }} />
                <Stack.Screen name="farm/add" options={{ headerShown: false }} />
                <Stack.Screen name="farm/[id]" options={{ headerShown: true }} />
                <Stack.Screen name="farm/[id]/edit" options={{ headerShown: false }} />
                <Stack.Screen
                  name="farms"
                  options={{
                    headerShown: true,
                    title: i18n.t('tabs.farms'),
                    headerBackTitle: i18n.t('common.back'),
                  }}
                />
                <Stack.Screen name="fertilizer-plans" options={{ headerShown: true }} />
                <Stack.Screen name="lab-tests" options={{ headerShown: true }} />
                <Stack.Screen name="logs" options={{ headerShown: true }} />
                <Stack.Screen
                  name="onboarding"
                  options={{ headerShown: false, gestureEnabled: false }}
                />
                <Stack.Screen name="petiole-trends" options={{ headerShown: true }} />
                <Stack.Screen name="reports" options={{ headerShown: true }} />
                <Stack.Screen name="soil-profiling" options={{ headerShown: true }} />
                <Stack.Screen name="soil-trends" options={{ headerShown: true }} />
                <Stack.Screen name="spray-catalog" options={{ headerShown: true }} />
                <Stack.Screen name="spray-safe-checker" options={{ headerShown: true }} />
                <Stack.Screen name="tasks" options={{ headerShown: true }} />
                <Stack.Screen name="warehouse" options={{ headerShown: true }} />
                <Stack.Screen name="weather" options={{ headerShown: true }} />
                <Stack.Screen
                  name="app-settings"
                  options={{
                    headerShown: true,
                    title: i18n.t('tabs.settings'),
                    headerBackTitle: i18n.t('common.back'),
                  }}
                />
                <Stack.Screen name="widget-configuration" options={{ headerShown: true }} />
                <Stack.Screen name="widgets-showcase" options={{ headerShown: true }} />
                <Stack.Screen name="worker-analytics/[id]" options={{ headerShown: true }} />
              </Stack>
              <GuidedTourController />
            </I18nextProvider>
          </PersistQueryClientProvider>
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
