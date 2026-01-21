import '../src/global.css';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore, initAuthListener, cleanupAuthListener } from '@/stores';

// Prevent auto-hide splash screen
SplashScreen.preventAutoHideAsync();

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

export default function RootLayout() {
  const initialize = useAuthStore(state => state.initialize);
  const isLoading = useAuthStore(state => state.isLoading);

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
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
