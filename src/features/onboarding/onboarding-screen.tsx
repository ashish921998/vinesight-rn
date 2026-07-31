import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { telemetry } from '@/services/telemetry';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useAppModeStore, useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { colorWithOpacity } from '@/utils/color';
import { resolveOnboardingFarmHref, type OnboardingFarmDestination } from './onboarding-navigation';
import { FirstFarmSlide } from './slides/first-farm-slide';

/**
 * New-farmer onboarding intentionally contains one task: add the first farm.
 * Basic personal details are collected by profile-completion immediately before
 * this route. Once the farm exists, the farmer goes straight to the dashboard.
 */
export function OnboardingScreen() {
  const m3 = useM3();
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // App mode is device-persisted, so explicitly reset it for a new farmer in
    // case another account previously selected Detailed mode on this device.
    useAppModeStore.getState().setDetailedMode(false);
    useOnboardingStore.getState().setCurrentStep('firstFarm');

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      telemetry.capture('onboarding_first_farm_started');
      telemetry.capture('onboarding_slide_viewed', { slide: 0, step: 'first_farm' });
    }
  }, []);

  const handleFarmResolved = useCallback(
    (farmId: number | null, destination: OnboardingFarmDestination = 'tabs') => {
      if (farmId === null) return;

      const onboarding = useOnboardingStore.getState();
      onboarding.markFarmCreated(farmId);
      onboarding.completeOnboarding();
      useAuthStore.getState().setHasSeenOnboarding(true);
      useAppModeStore.getState().setDetailedMode(false);

      // Prevent the guided-tour welcome card (shown whenever status==='not_started')
      // from firing for a fresh farmer landing on /(tabs). New farmers have
      // already been taught the farm+log flow in onboarding.
      useGuidedTourStore.getState().completeTour();

      telemetry.capture('onboarding_farm_created', { farm_id: farmId });
      telemetry.capture('onboarding_completed', {
        farm_id: farmId,
        onboarding_path: 'basic_details_and_farm',
        app_mode: 'simple',
      });

      router.replace(resolveOnboardingFarmHref(farmId, destination));
    },
    [],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View
          style={[
            styles.backgroundOrb,
            styles.backgroundOrbTop,
            { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12) },
          ]}
        />
        <View
          style={[
            styles.backgroundOrb,
            styles.backgroundOrbBottom,
            { backgroundColor: colorWithOpacity(m3.colorScheme.tertiary, 0.16) },
          ]}
        />
      </View>

      <View style={styles.topBar}>
        <Text style={[styles.headerTitle, { color: m3.colorScheme.onSurface }]}>VineSight</Text>
        <Text style={[styles.stepLabel, { color: m3.colorScheme.onSurfaceVariant }]}>
          Farm setup
        </Text>
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
  backgroundLayer: {
    ...StyleSheet.absoluteFill,
  },
  backgroundOrb: {
    position: 'absolute',
    borderRadius: borderRadius.full,
  },
  backgroundOrbTop: {
    width: 240,
    height: 240,
    top: -72,
    right: -40,
  },
  backgroundOrbBottom: {
    width: 300,
    height: 300,
    bottom: 56,
    left: -96,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    minHeight: 64,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  stepLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  content: {
    flex: 1,
  },
});
