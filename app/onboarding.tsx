import { useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { AnimatedSplash } from '@/components/animated-splash';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores';
import { useLanguageStore } from '@/stores/language-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { resolveOnboardingRouteGuard } from '@/features/onboarding/route-guard';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import type { OnboardingStep } from '@/types/onboarding';

const stepMeta: Record<OnboardingStep, { title: string; description: string }> = {
  language: {
    title: 'Choose your language',
    description: 'Set your preferred language for app content and reminders.',
  },
  welcome: {
    title: 'Welcome to VineSight',
    description: 'Track tasks, operations, and field insights in one place.',
  },
  features: {
    title: 'Core capabilities',
    description: 'Logs, analytics, workforce tracking, and assistant workflows.',
  },
  preferences: {
    title: 'Farm preferences',
    description: 'Set country, currency, and area unit defaults.',
  },
  notifications: {
    title: 'Reminder preferences',
    description: 'Choose whether to enable onboarding reminder defaults.',
  },
  complete: {
    title: 'All set',
    description: 'Your onboarding is complete. Continue to your dashboard.',
  },
};

export default function OnboardingRouteScreen() {
  const router = useRouter();
  const m3 = useM3();

  const authLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const onboardingHydrated = useOnboardingStore((state) => state.hasHydrated);
  const onboardingComplete = useOnboardingStore((state) => state.isComplete);
  const currentStep = useOnboardingStore((state) => state.currentStep);
  const preferences = useOnboardingStore((state) => state.preferences);
  const nextStep = useOnboardingStore((state) => state.nextStep);
  const previousStep = useOnboardingStore((state) => state.previousStep);
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);
  const setPreferences = useOnboardingStore((state) => state.setPreferences);

  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const guard = useMemo(
    () =>
      resolveOnboardingRouteGuard({
        authLoading,
        isAuthenticated,
        onboardingHydrated,
        onboardingComplete,
      }),
    [authLoading, isAuthenticated, onboardingComplete, onboardingHydrated],
  );

  useEffect(() => {
    if (guard.mode === 'redirect_auth' || guard.mode === 'redirect_tabs') {
      router.replace(guard.href);
    }
  }, [guard, router]);

  if (guard.mode === 'loading') {
    return <AnimatedSplash duration={1200} />;
  }

  if (guard.mode !== 'render') {
    return null;
  }

  const stepIndex: number =
    currentStep === 'language'
      ? 1
      : currentStep === 'welcome'
        ? 2
        : currentStep === 'features'
          ? 3
          : currentStep === 'preferences'
            ? 4
            : currentStep === 'notifications'
              ? 5
              : 6;
  const step = stepMeta[currentStep];

  const handleComplete = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: spacing[6],
        backgroundColor: m3.colorScheme.background,
      }}
    >
      <View
        style={{
          flex: 1,
          gap: spacing[4],
          borderRadius: borderRadius['2xl'],
          padding: spacing[5],
          backgroundColor: m3.surface.surfaceContainerLow,
        }}
      >
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          Step {stepIndex} of 6
        </Text>

        <Text
          style={{
            fontSize: fontSize['2xl'],
            fontWeight: fontWeight.bold,
            color: m3.colorScheme.onSurface,
          }}
        >
          {step.title}
        </Text>

        <Text
          style={{
            fontSize: fontSize.base,
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          {step.description}
        </Text>

        {currentStep === 'language' && (
          <View style={{ gap: spacing[2] }}>
            <Button
              title={`English${language === 'en' ? ' (Selected)' : ''}`}
              variant={language === 'en' ? 'primary' : 'outline'}
              onPress={() => setLanguage('en')}
            />
            <Button
              title={`Marathi${language === 'mr' ? ' (Selected)' : ''}`}
              variant={language === 'mr' ? 'primary' : 'outline'}
              onPress={() => setLanguage('mr')}
            />
            <Button
              title={`Hindi${language === 'hi' ? ' (Selected)' : ''}`}
              variant={language === 'hi' ? 'primary' : 'outline'}
              onPress={() => setLanguage('hi')}
            />
          </View>
        )}

        {currentStep === 'preferences' && (
          <View style={{ gap: spacing[2] }}>
            <Button
              title={`Area unit: ${preferences.areaUnit}`}
              variant="secondary"
              onPress={() =>
                setPreferences({
                  areaUnit: preferences.areaUnit === 'acres' ? 'hectares' : 'acres',
                })
              }
            />
            <Button
              title={`Country: ${preferences.country || 'India'}`}
              variant="secondary"
              onPress={() => setPreferences({ country: preferences.country ? '' : 'India' })}
            />
            <Button
              title={`Currency: ${preferences.currency || 'INR'}`}
              variant="secondary"
              onPress={() => setPreferences({ currency: preferences.currency ? '' : 'INR' })}
            />
          </View>
        )}

        {currentStep === 'notifications' && (
          <Button
            title={
              preferences.notificationsEnabled
                ? 'Disable reminder defaults'
                : 'Enable reminder defaults'
            }
            variant="secondary"
            onPress={() =>
              setPreferences({ notificationsEnabled: !preferences.notificationsEnabled })
            }
          />
        )}

        <View style={{ marginTop: 'auto', gap: spacing[2] }}>
          {currentStep !== 'language' && currentStep !== 'complete' && (
            <Button title="Back" variant="outline" onPress={previousStep} />
          )}

          {currentStep !== 'complete' ? (
            <Button
              title={currentStep === 'notifications' ? 'Finish onboarding' : 'Continue'}
              onPress={currentStep === 'notifications' ? handleComplete : nextStep}
            />
          ) : (
            <Button title="Go to dashboard" onPress={handleComplete} />
          )}

          <Button title="Skip onboarding" variant="ghost" onPress={handleComplete} />
        </View>
      </View>
    </ScrollView>
  );
}
