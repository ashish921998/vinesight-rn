import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { telemetry } from '@/services/telemetry';
import { useM3 } from '@/styles/use-theme';
import { fontSize, fontWeight, spacing } from '@/styles/theme';
import { useAppModeStore, useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { ONBOARDING_COMPLETION_HREF } from './onboarding-navigation';
import { FirstFarmSlide } from './slides/first-farm-slide';

/**
 * New-farmer onboarding stays focused on one useful outcome: confirming or
 * creating the first farm. Personal details are collected before this route.
 */
export function OnboardingScreen() {
  const m3 = useM3();
  const hasStartedRef = useRef(false);

  useEffect(() => {
    useAppModeStore.getState().setDetailedMode(false);
    useOnboardingStore.getState().setCurrentStep('firstFarm');

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      telemetry.capture('onboarding_first_farm_started');
      telemetry.capture('onboarding_slide_viewed', { slide: 0, step: 'first_farm' });
    }
  }, []);

  const handleFarmResolved = useCallback((farmId: number | null) => {
    if (farmId === null) return;

    const onboarding = useOnboardingStore.getState();
    onboarding.markFarmCreated(farmId);
    onboarding.completeOnboarding();
    useAuthStore.getState().setHasSeenOnboarding(true);
    useAppModeStore.getState().setDetailedMode(false);
    useGuidedTourStore.getState().completeTour();

    telemetry.capture('onboarding_farm_created', { farm_id: farmId });
    telemetry.capture('onboarding_completed', {
      farm_id: farmId,
      onboarding_path: 'basic_details_and_farm',
      app_mode: 'simple',
    });

    router.replace(ONBOARDING_COMPLETION_HREF);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
      <View style={styles.topBar}>
        <Text style={[styles.headerTitle, { color: m3.colorScheme.onSurface }]}>VineSight</Text>
      </View>

      <View style={styles.content}>
        <FirstFarmSlide isActive onResolved={handleFarmResolved} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  content: {
    flex: 1,
  },
});
