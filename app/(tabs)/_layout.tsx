import { useEffect, useMemo, useRef, type ComponentProps } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useThemeTokens } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { isAndroid } from '@/hooks';
import { tapLight } from '@/lib/haptics';

export default function TabLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const hasRedirectedRef = useRef(false);
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
    if (!isAuthenticated && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      router.replace('/(auth)/phone-login');
    }
    if (isAuthenticated) hasRedirectedRef.current = false;
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return null;

  if (isAndroid) {
    const renderAndroidTabIcon = (name: string, focused: boolean) => (
      <SymbolIcon
        name={focused ? `${name}.fill` : name}
        size={24}
        color={focused ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant}
      />
    );

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
              title: t('tabs.home'),
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('house', focused),
            }}
            listeners={{ tabPress: () => tapLight() }}
          />
          <Tabs.Screen
            name="assistant"
            options={{
              title: t('tabs.assistant'),
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('message', focused),
            }}
            listeners={{ tabPress: () => tapLight() }}
          />
          <Tabs.Screen
            name="activity"
            options={{
              title: t('tabs.activity'),
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('plus.circle', focused),
            }}
            listeners={{ tabPress: () => tapLight() }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t('tabs.profile'),
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('person', focused),
            }}
            listeners={{ tabPress: () => tapLight() }}
          />

          {/* Legacy tabs hidden but still routable */}
          <Tabs.Screen name="explore" options={{ href: null }} />
          <Tabs.Screen name="workers" options={{ href: null }} />
          <Tabs.Screen name="tools" options={{ href: null }} />
          <Tabs.Screen name="settings" options={{ href: null }} />
          <Tabs.Screen name="farms" options={{ href: null }} />
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
        <NativeTabs.Trigger name="index" options={{ title: t('tabs.home') }}>
          {renderTabIcon(sf('house'), sf('house.fill'), 'home-outline', 'home')}
          <Label>{t('tabs.home')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="assistant" options={{ title: t('tabs.assistant') }}>
          {renderTabIcon(
            sf('bubble.left.and.bubble.right'),
            sf('bubble.left.and.bubble.right.fill'),
            'chatbubble-ellipses-outline',
            'chatbubble-ellipses',
          )}
          <Label>{t('tabs.assistant')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="activity" options={{ title: t('tabs.activity') }}>
          {renderTabIcon(
            sf('plus.circle'),
            sf('plus.circle.fill'),
            'add-circle-outline',
            'add-circle',
          )}
          <Label>{t('tabs.activity')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile" options={{ title: t('tabs.profile') }}>
          {renderTabIcon(sf('person'), sf('person.fill'), 'person-outline', 'person')}
          <Label>{t('tabs.profile')}</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="explore" hidden options={{ title: t('tabs.farms') }}>
          {renderTabIcon(sf('leaf'), sf('leaf.fill'), 'leaf-outline', 'leaf')}
          <Label>{t('tabs.farms')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="workers" hidden options={{ title: t('tabs.workers') }}>
          {renderTabIcon(sf('person.2'), sf('person.2.fill'), 'people-outline', 'people')}
          <Label>{t('tabs.workers')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="tools" hidden options={{ title: t('tabs.tools') }}>
          {renderTabIcon(
            sf('wrench.and.screwdriver'),
            sf('wrench.and.screwdriver.fill'),
            'build-outline',
            'build',
          )}
          <Label>{t('tabs.tools')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings" hidden options={{ title: t('tabs.settings') }}>
          {renderTabIcon(sf('gearshape'), sf('gearshape.fill'), 'settings-outline', 'settings')}
          <Label>{t('tabs.settings')}</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
