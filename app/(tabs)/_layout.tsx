import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Pressable } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useThemeTokens } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { spacing } from '@/styles/theme';
import { isAndroid } from '@/hooks';

export default function TabLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [hasRedirected, setHasRedirected] = useState(false);
  const insets = useSafeAreaInsets();
  const { m3, isDark } = useThemeTokens();
  const defaultHeaderOptions = useMemo(
    () => ({
      headerStyle: {
        backgroundColor: m3.colorScheme.surface,
        borderBottomWidth: 0,
      },
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
        color: m3.colorScheme.onSurface,
      },
      headerTintColor: m3.colorScheme.primary,
      headerTransparent: false,
    }),
    [m3],
  );

  const sf = (name: string) => name as SFSymbol;

  // Settings button rendered in Dashboard header right position
  const renderSettingsHeaderButton = () => (
    <Pressable
      onPress={() => router.push('/(tabs)/settings')}
      accessibilityRole="button"
      accessibilityLabel={t('assistant.settingsButtonA11y')}
      style={{ marginRight: spacing[4] }}
    >
      <SymbolIcon name="gearshape" size={24} color={m3.colorScheme.onSurface} />
    </Pressable>
  );

  // Spread this variable into NativeTabs options to avoid TS excess-property error
  // (headerRight is not in NativeTabOptions typings but is supported at runtime)
  const dashboardHeaderRight = { headerRight: renderSettingsHeaderButton };

  const renderTabIcon = (
    sfDefault: SFSymbol,
    sfSelected: SFSymbol,
    ionDefault: ComponentProps<typeof Ionicons>['name'],
    ionSelected: ComponentProps<typeof Ionicons>['name'],
  ) => (
    <Icon
      sf={{ default: sfDefault, selected: sfSelected }}
      selectedColor={m3.colorScheme.primary}
      androidSrc={{
        default: <VectorIcon family={Ionicons} name={ionDefault} />,
        selected: <VectorIcon family={Ionicons} name={ionSelected} />,
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

  if (isAndroid) {
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
              backgroundColor: m3.surface.surfaceContainer,
              borderTopColor: m3.colorScheme.outlineVariant,
              borderTopWidth: 1,
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom + 12, 20),
              height: Math.max(insets.bottom + 64, 76),
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '500',
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
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('square.grid.2x2', focused),
              headerRight: renderSettingsHeaderButton,
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
          <Tabs.Screen
            name="workers"
            options={{
              title: t('tabs.workers'),
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('person.2', focused),
            }}
          />
          <Tabs.Screen
            name="tools"
            options={{
              title: t('tabs.tools'),
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('wrench.and.screwdriver', focused),
            }}
          />
          <Tabs.Screen
            name="assistant"
            options={{
              title: t('tabs.aiAssistant'),
              headerShown: false,
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('brain', focused),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="farms"
            options={{
              href: null,
            }}
          />
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
            fontSize: 11,
            fontWeight: '500',
            color: m3.colorScheme.onSurfaceVariant,
          },
          selected: {
            color: m3.colorScheme.primary,
          },
        }}
        backgroundColor={m3.surface.surfaceContainer}
        shadowColor={colorWithOpacity(m3.colorScheme.shadow, isDark ? 0.6 : 0.05)}
      >
        <NativeTabs.Trigger
          name="index"
          options={{ ...defaultHeaderOptions, ...dashboardHeaderRight, title: t('tabs.dashboard') }}
        >
          {renderTabIcon(sf('square.grid.2x2'), sf('square.grid.2x2.fill'), 'grid-outline', 'grid')}
          <Label>{t('tabs.dashboard')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="explore"
          options={{ ...defaultHeaderOptions, title: t('tabs.explore') }}
        >
          <Icon
            sf={{ default: sf('house'), selected: sf('house.fill') }}
            selectedColor={m3.colorScheme.primary}
            androidSrc={{
              default: <VectorIcon family={MaterialCommunityIcons} name="barn" />,
              selected: <VectorIcon family={MaterialCommunityIcons} name="barn" />,
            }}
          />
          <Label>{t('tabs.explore')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="workers"
          options={{ ...defaultHeaderOptions, title: t('tabs.workers') }}
        >
          {renderTabIcon(sf('person.2'), sf('person.2.fill'), 'people-outline', 'people')}
          <Label>{t('tabs.workers')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="tools"
          options={{ ...defaultHeaderOptions, title: t('tabs.tools') }}
        >
          {renderTabIcon(
            sf('wrench.and.screwdriver'),
            sf('wrench.and.screwdriver.fill'),
            'build-outline',
            'build',
          )}
          <Label>{t('tabs.tools')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="assistant"
          options={{ ...defaultHeaderOptions, headerShown: false, title: t('tabs.aiAssistant') }}
        >
          {renderTabIcon(sf('brain'), sf('brain.fill'), 'sparkles-outline', 'sparkles')}
          <Label>{t('tabs.aiAssistant')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="settings"
          hidden
          options={{ ...defaultHeaderOptions, title: t('tabs.settings') }}
        >
          {renderTabIcon(sf('gearshape'), sf('gearshape.fill'), 'settings-outline', 'settings')}
          <Label>{t('tabs.settings')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="farms"
          hidden
          options={{ ...defaultHeaderOptions, title: t('tabs.farms') }}
        >
          {renderTabIcon(sf('leaf'), sf('leaf.fill'), 'leaf-outline', 'leaf')}
          <Label>{t('tabs.farms')}</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
