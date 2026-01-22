import { View, Text, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores';

/**
 * Entry point of the app
 * Redirects to auth or main tabs based on authentication state
 */
export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();

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

  // Redirect based on auth state
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
