import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores';
import { Symbol } from '@/components/ui/symbol';

export default function TabLayout() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [hasRedirected, setHasRedirected] = useState(false);
  const insets = useSafeAreaInsets();
  const isAndroid = process.env.EXPO_OS === 'android';
  const defaultHeaderOptions = useMemo(
    () => ({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        boxShadow: 'none',
        borderBottomWidth: 0,
      },
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
        color: '#111827',
      },
      headerTintColor: '#408059',
      headerTransparent: false,
    }),
    [],
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
      selectedColor="#408059"
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
      router.replace('/(auth)/login');
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
        compass: 1.1,
        'compass.fill': 1.1,
        'wrench.and.screwdriver': 0.9,
        'wrench.and.screwdriver.fill': 0.9,
      };
      const iconName = focused ? name + '.fill' : name;
      const scale = scaleMap[iconName] ?? 1;
      return (
        <Symbol
          name={iconName}
          size={24}
          color={focused ? '#408059' : '#9CA3AF'}
          style={{ transform: [{ scale }] }}
        />
      );
    };

    return (
      <>
        <StatusBar style="dark" />
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: '#408059',
            tabBarInactiveTintColor: '#9CA3AF',
            tabBarStyle: {
              backgroundColor: '#FFFFFF',
              borderTopColor: '#F3F4F6',
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
              title: 'Dashboard',
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('square.grid.2x2', focused),
            }}
          />
          <Tabs.Screen
            name="explore"
            options={{
              title: 'Explore',
              headerShown: false,
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('compass', focused),
            }}
          />
          <Tabs.Screen
            name="workers"
            options={{
              title: 'Workers',
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('person.2', focused),
            }}
          />
          <Tabs.Screen
            name="tools"
            options={{
              title: 'Tools',
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('wrench.and.screwdriver', focused),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
              tabBarIcon: ({ focused }) => renderAndroidTabIcon('gearshape', focused),
            }}
          />
          <Tabs.Screen name="farms" options={{ href: null }} />
        </Tabs>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <NativeTabs
        tintColor="#408059"
        iconColor={{ default: '#9CA3AF', selected: '#408059' }}
        labelStyle={{ fontSize: 11, fontWeight: '500' }}
        backgroundColor="#FFFFFF"
        shadowColor="rgba(0, 0, 0, 0.05)"
      >
        <NativeTabs.Trigger name="index" options={{ ...defaultHeaderOptions, title: 'Dashboard' }}>
          {renderTabIcon(sf('square.grid.2x2'), sf('square.grid.2x2.fill'), 'grid-outline', 'grid')}
          <Label>Dashboard</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="explore" options={{ ...defaultHeaderOptions, title: 'Explore' }}>
          {renderTabIcon(sf('safari'), sf('safari.fill'), 'compass-outline', 'compass')}
          <Label>Explore</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="workers" options={{ ...defaultHeaderOptions, title: 'Workers' }}>
          {renderTabIcon(sf('person.2'), sf('person.2.fill'), 'people-outline', 'people')}
          <Label>Workers</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="tools" options={{ ...defaultHeaderOptions, title: 'Tools' }}>
          {renderTabIcon(
            sf('wrench.and.screwdriver'),
            sf('wrench.and.screwdriver.fill'),
            'build-outline',
            'build',
          )}
          <Label>Tools</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="settings"
          options={{ ...defaultHeaderOptions, title: 'Settings' }}
        >
          {renderTabIcon(sf('gearshape'), sf('gearshape.fill'), 'settings-outline', 'settings')}
          <Label>Settings</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="farms"
          hidden
          options={{ ...defaultHeaderOptions, title: 'Farms' }}
        >
          {renderTabIcon(sf('leaf'), sf('leaf.fill'), 'leaf-outline', 'leaf')}
          <Label>Farms</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
