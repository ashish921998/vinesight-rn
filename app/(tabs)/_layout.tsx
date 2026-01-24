import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores';

// Tab icon component
function TabBarIcon({ name, color }: { name: keyof typeof Ionicons.glyphMap; color: string }) {
  return <Ionicons name={name} size={24} color={color} />;
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
      <StatusBar barStyle="dark-content" />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#408059',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#F3F4F6',
            borderTopWidth: 1,
            paddingTop: 8,
            paddingBottom: Platform.OS === 'ios' ? 36 : Math.max(insets.bottom + 12, 20),
            height: Platform.OS === 'ios' ? 96 : Math.max(insets.bottom + 64, 76),
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginTop: 4,
          },
          headerStyle: {
            backgroundColor: '#FFFFFF',
            elevation: 0,
            shadowOpacity: 0,
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
              <TabBarIcon name={focused ? 'grid' : 'grid-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="farms"
          options={{
            title: 'Farms',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'leaf' : 'leaf-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="workers"
          options={{
            title: 'Workers',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'people' : 'people-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tools"
          options={{
            title: 'Tools',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'calculator' : 'calculator-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'settings' : 'settings-outline'} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
