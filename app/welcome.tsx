import { useState } from 'react';
import { Redirect } from 'expo-router';
import { WelcomeScreen } from '@/features/welcome';
import { AnimatedSplash } from '@/components/animated-splash';
import { useAuthStore } from '@/stores';
import { useOnboardingReady, useOnboardingStore } from '@/stores/onboarding-store';

export default function WelcomeRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const onboardingReady = useOnboardingReady();

  // Wait for auth and onboarding state before deciding, so a deep link that
  // lands here during startup doesn't flash welcome to a signed-in user.
  if (isLoading || !onboardingReady) {
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
  // Read once on mount rather than subscribing to hasSeenWelcome: tapping a
  // CTA marks welcome as seen and navigates itself, and a second redirect
  // from here would race that navigation.
  const [entry] = useState(() => {
    const { hasHydrated, hasSeenWelcome } = useOnboardingStore.getState();
    return { hydrated: hasHydrated, seen: hasHydrated && hasSeenWelcome };
  });
  // If we got here on the init-timeout fallback, storage may still finish
  // loading and reveal a returning user who already saw welcome.
  const seenAfterLateHydration = useOnboardingStore(
    (s) => !entry.hydrated && s.hasHydrated && s.hasSeenWelcome,
  );

  if (entry.seen || seenAfterLateHydration) {
    return <Redirect href="/(auth)/phone-login" />;
  }

  return <WelcomeScreen />;
}
