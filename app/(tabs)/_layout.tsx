import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { fontSize } from '@/styles/theme';
import { Redirect, Tabs, useRouter, useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useAppModeStore } from '@/stores';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useM3, useIsDark } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { isAndroid } from '@/hooks';
import { getAndroidBottomSystemInset } from '@/utils/android-system-bars';

/**
 * Tabs gated behind "Detailed mode". Defined once so the Android and iOS tab
 * bars stay in sync — add/remove a tab here and both render paths update.
 */
const DETAILED_TABS = [
  {
    name: 'workers',
    titleKey: 'tabs.workers',
    android: 'person.2',
    sf: ['person.2', 'person.2.fill'] as const,
    ion: ['people-outline', 'people'] as const,
  },
  {
    name: 'tools',
    titleKey: 'tabs.tools',
    android: 'wrench.and.screwdriver',
    sf: ['wrench.and.screwdriver', 'wrench.and.screwdriver.fill'] as const,
    ion: ['build-outline', 'build'] as const,
  },
  {
    name: 'assistant',
    titleKey: 'tabs.aiAssistant',
    android: 'brain',
    sf: ['brain', 'brain.fill'] as const,
    ion: ['sparkles-outline', 'sparkles'] as const,
  },
] as const;

export default function TabLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const detailedMode = useAppModeStore((state) => state.detailedMode);
  const appModeHydrated = useAppModeStore((state) => state.hydrated);
  const segments = useSegments();
  const [hasRedirected, setHasRedirected] = useState(false);
  const insets = useSafeAreaInsets();
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

  // Wait for persisted mode before deciding whether this route is allowed.
  // Redirect during render so detailed-only screens never mount in Simplified mode.
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
    const bottomSystemInset = getAndroidBottomSystemInset(insets.bottom);
    const renderAndroidTabIcon = (name: string, focused: boolean) => {
      const scaleMap: Record<string, number> = {
        house: 1.1,
        'house.fill': 1.1,
        'wrench.and.screwdriver': 0.9,
        'wrench.and.screwdriver.fill': 0.9,
      };
      const iconName = focused ? name + '.fill' : name;
      const scale = scaleMap[iconName] ?? 1;
      return (
        <SymbolIcon
          name={iconName}
          size={24}
          color={focused ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant}
          style={{ transform: [{ scale }] }}
        />
      );
    };

    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Tabs
          backBehavior="history"
          screenOptions={{
            tabBarActiveTintColor: m3.colorScheme.primary,
            tabBarInactiveTintColor: m3.colorScheme.onSurfaceVariant,
            tabBarStyle: {
              backgroundColor: m3.surface.surfaceContainerLow,
              borderTopColor: m3.colorScheme.outline,
              borderTopWidth: 1,
              paddingTop: 8,
              paddingBottom: bottomSystemInset + 8,
              height: 64 + bottomSystemInset,
            },
            tabBarLabelStyle: {
              fontSize: fontSize.xs,
              fontWeight: '600',
              marginTop: 4,
            },
            headerStyle: defaultHeaderOptions.headerStyle,
            headerTitleStyle: defaultHeaderOptions.headerTitleStyle as never,
            headerTintColor: defaultHeaderOptions.headerTintColor,
            headerTransparent: defaultHeaderOptions.headerTransparent,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: t('tabs.dashboard'),
              headerShown: false,
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('square.grid.2x2', focused),
            }}
          />
          <Tabs.Screen
            name="explore"
            options={{
              title: t('tabs.explore'),
              headerShown: false,
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('house', focused),
            }}
          />
          {/* On Android the `Tabs` navigator auto-discovers a tab for every route
            file under app/(tabs)/, so simply omitting <Tabs.Screen> does NOT hide
            the tab — it renders via auto-discovery with default styling. The way to
            actually suppress the tab bar entry is `options.href = null` (expo-router
            maps that to tabBarItemStyle { display: 'none' } + a no-op button), so we
            always render the Screen and toggle href with detailedMode. */}
          {DETAILED_TABS.map((tab) => (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              options={{
                href: detailedMode ? undefined : null,
                title: t(tab.titleKey),
                headerShown: false,
                tabBarIcon: ({ focused }) => renderAndroidTabIcon(tab.android, focused),
              }}
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
          <NativeTabs.Trigger.Label>{t('tabs.dashboard')}</NativeTabs.Trigger.Label>
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
          <NativeTabs.Trigger.Label>{t('tabs.explore')}</NativeTabs.Trigger.Label>
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
