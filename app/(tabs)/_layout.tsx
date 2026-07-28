import { useEffect, useMemo, useState } from 'react';
import { fontSize } from '@/styles/theme';
import { Redirect, Tabs, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useAppModeStore } from '@/stores';
import { useM3, useIsDark } from '@/styles/use-theme';
import { GlassTabBar } from '@/components/navigation/glass-tab-bar';
import { DETAILED_TABS } from '@/components/navigation/tab-definitions';

export default function TabLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const detailedMode = useAppModeStore((state) => state.detailedMode);
  const appModeHydrated = useAppModeStore((state) => state.hydrated);
  const segments = useSegments();
  const [hasRedirected, setHasRedirected] = useState(false);
  const m3 = useM3();
  const isDark = useIsDark();
  const defaultHeaderOptions = useMemo(
    () => ({
      headerStyle: {
        backgroundColor: m3.colorScheme.surface,
        borderBottomWidth: 0,
      },
      headerTitleStyle: {
        fontWeight: '600' as const,
        fontSize: fontSize.lg,
        color: m3.colorScheme.onSurface,
      },
      headerTintColor: m3.colorScheme.primary,
      headerTransparent: false,
    }),
    [m3],
  );

  useEffect(() => {
    if (isLoading) return;
    if (__DEV__) {
      console.log(
        'TabLayout: isAuthenticated =',
        isAuthenticated,
        'hasRedirected =',
        hasRedirected,
      );
    }
    if (!isAuthenticated && !hasRedirected) {
      if (__DEV__) {
        console.log('TabLayout: Redirecting to login');
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasRedirected(true);
      router.replace({ pathname: '/(auth)/phone-login', params: { mode: 'signin' } });
    }
    // Reset redirect flag when authenticated (regardless of previous hasRedirected state)
    if (isAuthenticated) {
      setHasRedirected(false);
    }
  }, [isAuthenticated, isLoading, router, hasRedirected]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  if (!appModeHydrated) {
    return null;
  }
  const activeTab = (segments as readonly string[])[1];
  if (
    !detailedMode &&
    typeof activeTab === 'string' &&
    DETAILED_TABS.some((tab) => tab.name === activeTab)
  ) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tabs
        backBehavior="history"
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{
          headerStyle: defaultHeaderOptions.headerStyle,
          headerTitleStyle: defaultHeaderOptions.headerTitleStyle,
          headerTintColor: defaultHeaderOptions.headerTintColor,
          headerTransparent: defaultHeaderOptions.headerTransparent,
        }}
      >
        <Tabs.Screen name="index" options={{ title: t('tabs.home'), headerShown: false }} />
        <Tabs.Screen name="explore" options={{ title: t('tabs.explore'), headerShown: false }} />
        {DETAILED_TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{ title: t(tab.titleKey), headerShown: false }}
          />
        ))}
      </Tabs>
    </>
  );
}
