import { View, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores';
import { getConfigurationStatus } from '@/lib/supabase';
import { AnimatedSplash } from '@/components/animated-splash';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

/**
 * Entry point of the app
 * Redirects to auth or main tabs based on authentication state
 */
export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const configStatus = getConfigurationStatus();

  // Show animated splash screen while checking auth
  if (isLoading) {
    return <AnimatedSplash duration={2500} />;
  }

  if (!configStatus.isConfigured) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.white,
          padding: spacing[6],
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: borderRadius['3xl'],
              marginBottom: spacing[6],
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FEE2E2',
            }}
          >
            <SymbolIcon name="exclamationmark.triangle" size={44} color="#EF4444" />
          </View>

          <Text
            style={{
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              color: colors.surface[900],
              marginBottom: spacing[2],
            }}
          >
            App not configured
          </Text>
          <Text
            style={{ color: colors.surface[600], textAlign: 'center', marginBottom: spacing[6] }}
          >
            This build is missing Supabase environment variables.
          </Text>

          <View
            style={{
              backgroundColor: colors.gray[50],
              borderRadius: borderRadius['2xl'],
              padding: spacing[4],
              width: '100%',
              maxWidth: 448,
            }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.surface[700] }}>
              EXPO_PUBLIC_SUPABASE_URL: {configStatus.hasUrl ? 'set' : 'missing'}
            </Text>
            <Text
              style={{ fontSize: fontSize.sm, color: colors.surface[700], marginTop: spacing[2] }}
            >
              EXPO_PUBLIC_SUPABASE_ANON_KEY: {configStatus.hasKey ? 'set' : 'missing'}
            </Text>
            <Text
              style={{ fontSize: fontSize.xs, color: colors.surface[500], marginTop: spacing[4] }}
            >
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
