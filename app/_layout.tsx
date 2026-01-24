import '../src/global.css';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore, initAuthListener, cleanupAuthListener } from '@/stores';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

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
    // Hide splash screen when auth is loaded
    if (!isLoading) {
      void SplashScreen.hideAsync().catch(() => null);
    }
  }, [isLoading]);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
});
