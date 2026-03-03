import { View, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { getConfigurationStatus } from '@/lib/supabase';
import { AnimatedSplash } from '@/components/animated-splash';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useNativeBootstrapDecision } from '@/native/contracts';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

/**
 * Entry point of the app.
 *
 * Phase 0 native migration note:
 * We now resolve startup routing through the shared native bootstrap contract
 * so SwiftUI/Compose shells and Expo Router stay in sync.
 */
export default function Index() {
  const { authState, initialExpoPath } = useNativeBootstrapDecision();
  const configStatus = getConfigurationStatus();
  const colors = useThemeColors();
  const m3 = useM3();

  if (authState === 'loading') {
    return <AnimatedSplash duration={2500} />;
  }

  if (!configStatus.isConfigured) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: m3.colorScheme.background,
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
              backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.12),
            }}
          >
            <SymbolIcon name="exclamationmark.triangle" size={44} color={m3.colorScheme.error} />
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
              backgroundColor: colors.surface[100],
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

  return <Redirect href={initialExpoPath} />;
}
