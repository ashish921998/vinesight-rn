import { useState } from 'react';
import { Redirect } from 'expo-router';
import { WelcomeScreen } from '@/features/welcome';
import { AnimatedSplash } from '@/components/animated-splash';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';

export default function WelcomeRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const onboardingHydrated = useOnboardingStore((s) => s.hasHydrated);

  // Wait for auth and onboarding state before deciding, so a deep link that
  // lands here during startup doesn't flash welcome to a signed-in user.
  if (isLoading || !onboardingHydrated) {
    return <AnimatedSplash duration={2500} />;
  }

  // Welcome is pre-auth only. A signed-in user who lands here (e.g. via a deep
  // link) goes back through the index resolver instead of seeing login.
  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return <WelcomeGate />;
}

function WelcomeGate() {
  // Read once on mount (after hydration) rather than subscribing: tapping a
  // CTA marks welcome as seen and navigates itself, and a second redirect
  // from here would race that navigation.
  const [seenAtEntry] = useState(() => useOnboardingStore.getState().hasSeenWelcome);

  if (seenAtEntry) {
    return <Redirect href="/(auth)/phone-login" />;
  }

  return <WelcomeScreen />;
}
