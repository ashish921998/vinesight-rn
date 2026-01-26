import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores';
import { Symbol } from '@/components/ui/Symbol';

// Tab icon component
function TabBarIcon({ name, color }: { name: string; color: string }) {
  return <Symbol name={name} size={24} color={color} />;
}

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [hasRedirected, setHasRedirected] = useState(false);

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
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#408059',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#F3F4F6',
            borderTopWidth: 1,
            paddingTop: 8,
            paddingBottom: process.env.EXPO_OS === 'ios' ? 36 : Math.max(insets.bottom + 12, 20),
            height: process.env.EXPO_OS === 'ios' ? 96 : Math.max(insets.bottom + 64, 76),
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginTop: 4,
          },
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
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? 'square.grid.2x2.fill' : 'square.grid.2x2'}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'compass.fill' : 'compass'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tools"
          options={{
            title: 'Tools',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? 'wrench.and.screwdriver.fill' : 'wrench.and.screwdriver'}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'gearshape.fill' : 'gearshape'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="farms"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="workers"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}
