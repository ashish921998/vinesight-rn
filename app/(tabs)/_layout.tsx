import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { fontSize } from '@/styles/theme';
import { Redirect, Tabs, useRouter, useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useAppModeStore } from '@/stores';
import { useM3, useIsDark } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { isAndroid } from '@/hooks';
import { ComposeTabBar } from '@/components/navigation/compose-tab-bar';
import { DETAILED_TABS, baseTabLabelKey } from '@/components/navigation/tab-definitions';

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
        fontWeight: '600',
        fontSize: fontSize.lg,
        color: m3.colorScheme.onSurface,
      },
      headerTintColor: m3.colorScheme.primary,
      headerTransparent: false,
    }),
    [m3],
  );

  const sf = (name: string) => name as SFSymbol;

  const renderTabIcon = (
    sfDefault: SFSymbol,
    sfSelected: SFSymbol,
    ionDefault: ComponentProps<typeof Ionicons>['name'],
    ionSelected: ComponentProps<typeof Ionicons>['name'],
  ) => (
    <NativeTabs.Trigger.Icon
      sf={{ default: sfDefault, selected: sfSelected }}
      selectedColor={m3.colorScheme.primary}
      src={{
        default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name={ionDefault} />,
        selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name={ionSelected} />,
      }}
    />
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

  if (isAndroid) {
    // Bottom bar is @expo/ui's Material 3 NavigationBar (see ComposeTabBar).
    // We keep expo-router's <Tabs> for routing/screen mounting and only swap the
    // rendered bar via `tabBar`. All screens stay declared so they're navigable;
    // ComposeTabBar filters which get a button based on detailedMode.
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Tabs
          backBehavior="history"
          tabBar={(props) => <ComposeTabBar {...props} />}
          screenOptions={{
            headerStyle: defaultHeaderOptions.headerStyle,
            headerTitleStyle: defaultHeaderOptions.headerTitleStyle as never,
            headerTintColor: defaultHeaderOptions.headerTintColor,
            headerTransparent: defaultHeaderOptions.headerTransparent,
          }}
        >
          <Tabs.Screen name="index" options={{ title: t('tabs.dashboard'), headerShown: false }} />
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

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NativeTabs
        tintColor={m3.colorScheme.primary}
        iconColor={{
          default: m3.colorScheme.onSurfaceVariant,
          selected: m3.colorScheme.primary,
        }}
        labelStyle={{
          default: {
            fontSize: fontSize.xs,
            fontWeight: '500',
            color: m3.colorScheme.onSurfaceVariant,
          },
          selected: {
            color: m3.colorScheme.primary,
            fontWeight: '600',
          },
        }}
        backgroundColor={m3.surface.surfaceContainerLow}
        shadowColor={colorWithOpacity(m3.colorScheme.shadow, isDark ? 0.6 : 0.05)}
      >
        <NativeTabs.Trigger name="index">
          {renderTabIcon(sf('square.grid.2x2'), sf('square.grid.2x2.fill'), 'grid-outline', 'grid')}
          <NativeTabs.Trigger.Label>
            {t(baseTabLabelKey('index', detailedMode, 'tabs.dashboard'))}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="explore">
          <NativeTabs.Trigger.Icon
            sf={{ default: sf('house'), selected: sf('house.fill') }}
            selectedColor={m3.colorScheme.primary}
            src={{
              default: (
                <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="barn" />
              ),
              selected: (
                <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="barn" />
              ),
            }}
          />
          <NativeTabs.Trigger.Label>
            {t(baseTabLabelKey('explore', detailedMode, 'tabs.explore'))}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        {detailedMode &&
          DETAILED_TABS.map((tab) => (
            <NativeTabs.Trigger key={tab.name} name={tab.name}>
              {renderTabIcon(sf(tab.sf[0]), sf(tab.sf[1]), tab.ion[0], tab.ion[1])}
              <NativeTabs.Trigger.Label>{t(tab.titleKey)}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
          ))}
      </NativeTabs>
    </>
  );
}
