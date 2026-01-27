import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useAuthStore } from '@/stores';

export default function TabLayout() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [hasRedirected, setHasRedirected] = useState(false);
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

  return (
    <>
      <StatusBar style="dark" />
      <NativeTabs
        tintColor="#408059"
        iconColor="#9CA3AF"
        labelStyle={{ fontSize: 11, fontWeight: '500' }}
        backgroundColor="#FFFFFF"
        shadowColor="rgba(0, 0, 0, 0.05)"
      >
        <NativeTabs.Trigger name="index" options={{ ...defaultHeaderOptions, title: 'Dashboard' }}>
          {renderTabIcon(sf('square.grid.2x2'), sf('square.grid.2x2.fill'), 'grid-outline', 'grid')}
          <Label>Dashboard</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="explore" options={{ ...defaultHeaderOptions, title: 'Explore' }}>
          {renderTabIcon(sf('compass'), sf('compass.fill'), 'compass-outline', 'compass')}
          <Label>Explore</Label>
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
        <NativeTabs.Trigger
          name="workers"
          hidden
          options={{ ...defaultHeaderOptions, title: 'Workers' }}
        >
          {renderTabIcon(sf('person.2'), sf('person.2.fill'), 'people-outline', 'people')}
          <Label>Workers</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
