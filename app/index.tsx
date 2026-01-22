import { View, Text, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores';
import { getConfigurationStatus } from '@/lib/supabase';

/**
 * Entry point of the app
 * Redirects to auth or main tabs based on authentication state
 */
export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const configStatus = getConfigurationStatus();

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <View className="items-center">
          {/* Logo */}
          <View className="w-24 h-24 bg-primary-100 rounded-3xl mb-6 items-center justify-center">
            <Ionicons name="leaf" size={48} color="#408059" />
          </View>

          <Text className="text-3xl font-bold text-surface-900 mb-2">Vinesight</Text>
          <Text className="text-surface-500 mb-8">Farm Management</Text>

          <ActivityIndicator size="large" color="#408059" />
        </View>
      </View>
    );
  }

  if (!configStatus.isConfigured) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <View className="items-center">
          <View className="w-20 h-20 rounded-3xl mb-6 items-center justify-center bg-red-50">
            <Ionicons name="warning-outline" size={44} color="#EF4444" />
          </View>

          <Text className="text-2xl font-bold text-surface-900 mb-2">App not configured</Text>
          <Text className="text-surface-600 text-center mb-6">
            This build is missing Supabase environment variables.
          </Text>

          <View className="bg-gray-50 rounded-2xl p-4 w-full max-w-md">
            <Text className="text-sm text-surface-700">
              EXPO_PUBLIC_SUPABASE_URL: {configStatus.hasUrl ? 'set' : 'missing'}
            </Text>
            <Text className="text-sm text-surface-700 mt-2">
              EXPO_PUBLIC_SUPABASE_ANON_KEY: {configStatus.hasKey ? 'set' : 'missing'}
            </Text>
            <Text className="text-xs text-surface-500 mt-4">
              Rebuild the app after setting these env vars (EAS secrets or your build profile).
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Redirect based on auth state
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
