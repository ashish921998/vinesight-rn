import { View, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useLanguageStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useProfile } from '@/hooks';
import { getConfigurationStatus } from '@/lib/supabase';
import { AnimatedSplash } from '@/components/animated-splash';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

/**
 * Entry point of the app
 * Redirects to auth or main tabs based on authentication state
 */
export default function Index() {
  const { isAuthenticated, isLoading, needsProfileCompletion, hasSeenOnboarding } = useAuthStore();
  const onboardingHydrated = useOnboardingStore((s) => s.hasHydrated);
  const onboardingComplete = useOnboardingStore((s) => s.isComplete);
  const { languageHydrated, hasSelectedLanguage, language } = useLanguageStore(
    useShallow((s) => ({
      languageHydrated: s.hasHydrated,
      hasSelectedLanguage: s.hasSelectedLanguage,
      language: s.language,
    })),
  );
  const { data: profile, isLoading: profileLoading } = useProfile({ enabled: isAuthenticated });
  const configStatus = getConfigurationStatus();
  const colors = useThemeColors();
  const m3 = useM3();

  // Show animated splash screen while checking auth or language store
  if (isLoading || !languageHydrated) {
    return <AnimatedSplash duration={2500} />;
  }

  // Language selection before anything else (first-time users)
  // Also check for auto-detected language to avoid redirecting users who already have a language set
  if (!hasSelectedLanguage && !language) {
    return <Redirect href="/language-selection" />;
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

  if (isAuthenticated && profileLoading) {
    return <AnimatedSplash duration={2500} />;
  }

  if (isAuthenticated && !onboardingHydrated) {
    return <AnimatedSplash duration={2500} />;
  }

  const hasProfileName = Boolean(profile?.full_name && profile.full_name.trim().length > 0);

  // Redirect based on auth state
  if (isAuthenticated) {
    if (needsProfileCompletion || !hasProfileName) {
      return <Redirect href="/(auth)/profile-completion" />;
    }
    if (!onboardingComplete && !hasSeenOnboarding) {
      return <Redirect href="/onboarding" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/phone-login" />;
}
