import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ensureInitialFarmSeasonForFarmId, useFarms } from '@/hooks';
import { telemetry } from '@/services/telemetry';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useLanguageStore, useNotificationStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import type { OnboardingActionType, OnboardingStep } from '@/types/onboarding';
import { syncPushDeviceRegistration } from '@/features/guided-tour/service';
import { colorWithOpacity } from '@/utils/color';
import { applyOnboardingCompletionEffects } from './finish';
import { OnboardingButton } from './components/onboarding-button';
import { PageIndicator } from './components/page-indicator';
import { FirstFarmSlide } from './slides/first-farm-slide';
import { FirstActionSlide } from './slides/first-action-slide';
import { HeroSlide } from './slides/hero-slide';
import { NotificationsSlide } from './slides/notifications-slide';
import { ValuePropsSlide } from './slides/value-props-slide';
const TOTAL_PAGES = 5;
const FIRST_FARM_PAGE_INDEX = 2;
const FIRST_ACTION_PAGE_INDEX = 3;
const NOTIFICATIONS_PAGE_INDEX = 4;
const PAGE_STEPS: OnboardingStep[] = [
  'welcome',
  'features',
  'firstFarm',
  'firstAction',
  'notifications',
];

const pageIndexForStep = (step: OnboardingStep): number => {
  const index = PAGE_STEPS.indexOf(step);
  return index >= 0 ? index : 0;
};

/**
 * Resolves the next pager index from the current one, clamped so it never runs
 * past the last page. Returns the current index when already on the final page.
 */
export const resolveNextPageIndex = (currentPageIndex: number): number => {
  const nextPage = currentPageIndex + 1;
  return nextPage >= TOTAL_PAGES ? currentPageIndex : nextPage;
};

export function OnboardingScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const { width } = useWindowDimensions();
  const { data: farms = [] } = useFarms();
  const onboardingCurrentStep = useOnboardingStore((s) => s.currentStep);
  const onboardingActivation = useOnboardingStore((s) => s.activation);
  const language = useLanguageStore((s) => s.language);
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const viewedSlides = useRef(new Set<number>());
  const farmCreatedRef = useRef(false);
  const hasAppliedResumeStepRef = useRef(false);
  const firstActionStartInFlightRef = useRef(false);
  const [activatedSlides, setActivatedSlides] = useState(new Set<number>([0]));
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [hasManuallyNavigatedBack, setHasManuallyNavigatedBack] = useState(false);
  const [createdFarmId, setCreatedFarmId] = useState<number | null>(
    onboardingActivation.farmId ?? null,
  );
  const hasCompletedFirstAction = onboardingActivation.firstActionCompletedAt !== null;
  const firstAvailableFarmId = farms.find((farm) => typeof farm.id === 'number')?.id ?? null;
  const resolvedFirstActionFarmId =
    createdFarmId ?? onboardingActivation.farmId ?? firstAvailableFarmId;

  const currentPage = useDerivedValue(() => scrollX.value / width);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const handleSlideChange = useCallback((index: number) => {
    if (!viewedSlides.current.has(index)) {
      viewedSlides.current.add(index);
      telemetry.capture('onboarding_slide_viewed', { slide: index });
      if (index === FIRST_FARM_PAGE_INDEX) {
        telemetry.capture('onboarding_first_farm_started');
      }
    }

    const stepForIndex = PAGE_STEPS[index];
    if (stepForIndex) {
      useOnboardingStore.getState().setCurrentStep(stepForIndex);
    }
    setActivatedSlides((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const handleMomentumEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const page = Math.round(event.nativeEvent.contentOffset.x / width);
      // firstFarm/firstAction are non-blocking: the user can swipe past them
      // without creating a farm or completing an action (explicit "Skip for now"
      // affordances make this obvious). We only track navigation direction here.
      if (page < currentPageIndex) {
        setHasManuallyNavigatedBack(true);
      } else if (page > currentPageIndex) {
        setHasManuallyNavigatedBack(false);
      }
      setCurrentPageIndex(page);
      handleSlideChange(page);
    },
    [currentPageIndex, handleSlideChange, width],
  );

  const handleNext = useCallback(() => {
    const nextPage = resolveNextPageIndex(currentPageIndex);
    if (nextPage === currentPageIndex) return;
    setHasManuallyNavigatedBack(false);
    scrollRef.current?.scrollTo({ x: nextPage * width, animated: true });
    setCurrentPageIndex(nextPage);
    handleSlideChange(nextPage);
  }, [currentPageIndex, handleSlideChange, width]);

  const finishOnboarding = useCallback(
    async (notificationsEnabled: boolean) => {
      const latestActivation = useOnboardingStore.getState().activation;

      if (notificationsEnabled && (language === 'en' || language === 'hi' || language === 'mr')) {
        // Fire-and-forget: registering the push device makes a network call
        // (APNs on iOS) that can hang or fail. It must never block the user from
        // finishing onboarding — awaiting it here was leaving iOS users stuck on
        // "Checking permissions..." so `onboarding_completed` never fired.
        // syncPushDeviceRegistration already swallows its own errors internally;
        // the .catch here is a belt-and-suspenders guard so a rejection can never
        // surface as an unhandled promise rejection during onboarding.
        void syncPushDeviceRegistration(language, {
          notificationsEnabled: true,
          featureOverviewEnabled: useNotificationStore.getState().featureOverviewEnabled,
        }).catch(() => {});
      }

      setHasManuallyNavigatedBack(false);
      const resolvedFarmId = createdFarmId ?? latestActivation.farmId;
      // Apply all the store side-effects (complete onboarding, mark tour complete
      // and mode-intro seen so neither reappears as a duplicate first-run gate)
      // and resolve where to land. Navigation stays component-side.
      const route = applyOnboardingCompletionEffects({
        resolvedFarmId: typeof resolvedFarmId === 'number' ? resolvedFarmId : null,
        notificationsEnabled,
      });
      telemetry.capture('onboarding_completed', {
        notifications_enabled: notificationsEnabled,
        first_action_type: latestActivation.firstActionType,
        farm_id: latestActivation.farmId,
      });
      router.replace(route.replace);
      if (route.push) {
        router.push(route.push);
      }
    },
    [createdFarmId, language],
  );

  const jumpToPage = useCallback(
    (page: number) => {
      scrollRef.current?.scrollTo({ x: page * width, animated: true });
      setCurrentPageIndex(page);
      handleSlideChange(page);
    },
    [handleSlideChange, width],
  );

  const handleSkip = useCallback(() => {
    const latestActivation = useOnboardingStore.getState().activation;
    setHasManuallyNavigatedBack(false);
    // Preserve whatever notification preference is already set — skipping must
    // not flip it. The helper also marks the tour complete and the mode-intro
    // seen so neither resurfaces as a duplicate first-run gate on the dashboard.
    applyOnboardingCompletionEffects({
      resolvedFarmId: null,
      notificationsEnabled: useOnboardingStore.getState().preferences.notificationsEnabled,
    });
    telemetry.capture('onboarding_skipped', {
      slide: currentPageIndex,
      farm_id: latestActivation.farmId,
      first_action_type: latestActivation.firstActionType,
      has_completed_first_action: latestActivation.firstActionCompletedAt !== null,
    });
    router.replace('/(tabs)');
  }, [currentPageIndex]);

  const handleFarmResolved = useCallback(
    (farmId: number | null) => {
      if (farmId === null) return;
      farmCreatedRef.current = true;
      useOnboardingStore.getState().markFarmCreated(farmId);
      telemetry.capture('onboarding_farm_created', { farm_id: farmId });
      setCreatedFarmId(farmId);
      setHasManuallyNavigatedBack(false);
      jumpToPage(FIRST_ACTION_PAGE_INDEX);
    },
    [jumpToPage],
  );

  const handleStartFirstAction = useCallback(
    (actionType: OnboardingActionType) => {
      const resolvedFarmId = resolvedFirstActionFarmId;
      if (resolvedFarmId === null || firstActionStartInFlightRef.current) {
        return;
      }
      firstActionStartInFlightRef.current = true;

      useOnboardingStore.getState().markFirstActionStarted(actionType);
      telemetry.capture('onboarding_first_action_started', {
        action_type: actionType,
        farm_id: resolvedFarmId,
      });

      void ensureInitialFarmSeasonForFarmId(
        resolvedFarmId,
        t('farms.defaultSeasonName', { year: new Date().getFullYear() }),
      ).catch((seasonError) => {
        console.warn('[OnboardingScreen] ensureInitialFarmSeasonForFarmId failed:', seasonError);
      });

      try {
        if (actionType === 'log') {
          router.push({
            pathname: '/add-entry',
            params: {
              tabs: 'log',
              initialTab: 'log',
              farmId: String(resolvedFarmId),
              onboarding: 'true',
              onboardingActionType: actionType,
            },
          });
          return;
        }

        // Only `log` and `note` are offered during onboarding — the `task`
        // first-action option was removed (task creation is a Detailed-mode
        // feature), so there is no `/add-task` branch here.
        if (actionType === 'note') {
          router.push({
            pathname: '/add-note',
            params: {
              farmId: String(resolvedFarmId),
              onboarding: 'true',
              onboardingActionType: actionType,
            },
          });
        }
      } catch (navigationError) {
        firstActionStartInFlightRef.current = false;
        throw navigationError;
      }
    },
    [resolvedFirstActionFarmId, t],
  );

  useFocusEffect(
    useCallback(() => {
      firstActionStartInFlightRef.current = false;
    }, []),
  );

  const handleContinueFromFirstAction = useCallback(() => {
    if (!hasCompletedFirstAction) return;
    jumpToPage(NOTIFICATIONS_PAGE_INDEX);
  }, [hasCompletedFirstAction, jumpToPage]);

  const handleSkipFirstAction = useCallback(() => {
    const latestActivation = useOnboardingStore.getState().activation;
    useOnboardingStore.getState().markFirstActionSkipped();
    useOnboardingStore.getState().setCurrentStep('notifications');
    telemetry.capture('onboarding_first_action_skipped', {
      farm_id: latestActivation.farmId,
      first_action_type: latestActivation.firstActionType,
      first_action_started: latestActivation.firstActionStartedAt !== null,
    });
    jumpToPage(NOTIFICATIONS_PAGE_INDEX);
  }, [jumpToPage]);

  React.useEffect(() => {
    if (createdFarmId === null && onboardingActivation.farmId !== null) {
      setCreatedFarmId(onboardingActivation.farmId);
    }
  }, [createdFarmId, onboardingActivation.farmId]);

  React.useEffect(() => {
    if (hasAppliedResumeStepRef.current || width <= 0) return;
    const resumePage = pageIndexForStep(onboardingCurrentStep);
    if (resumePage <= 0) {
      return;
    }
    hasAppliedResumeStepRef.current = true;
    let rafId: number | null = null;
    let isMounted = true;
    rafId = requestAnimationFrame(() => {
      if (!isMounted) return;
      scrollRef.current?.scrollTo({ x: resumePage * width, animated: false });
      setCurrentPageIndex(resumePage);
      handleSlideChange(resumePage);
    });
    return () => {
      isMounted = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [handleSlideChange, onboardingCurrentStep, width]);

  React.useEffect(() => {
    if (!hasCompletedFirstAction) return;
    if (currentPageIndex >= NOTIFICATIONS_PAGE_INDEX) return;
    if (hasManuallyNavigatedBack) return;
    jumpToPage(NOTIFICATIONS_PAGE_INDEX);
  }, [currentPageIndex, hasCompletedFirstAction, hasManuallyNavigatedBack, jumpToPage]);

  React.useEffect(() => {
    if (viewedSlides.current.has(0)) return;
    viewedSlides.current.add(0);
    telemetry.capture('onboarding_slide_viewed', { slide: 0 });
  }, []);

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
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: m3.colorScheme.onSurface }]}>VineSight</Text>
        </View>
        <View style={styles.skipContainer}>
          <OnboardingButton label={t('common.skip')} onPress={handleSkip} variant="ghost" />
        </View>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.scrollView}
      >
        <View style={[styles.slide, { width }]}>
          <HeroSlide isActive />
        </View>
        <View style={[styles.slide, { width }]}>
          <ValuePropsSlide isActive={activatedSlides.has(1)} />
        </View>
        <View style={[styles.slide, { width }]}>
          <FirstFarmSlide
            isActive={activatedSlides.has(2)}
            onResolved={handleFarmResolved}
            onSkip={() => jumpToPage(FIRST_ACTION_PAGE_INDEX)}
          />
        </View>
        <View style={[styles.slide, { width }]}>
          <FirstActionSlide
            isActive={activatedSlides.has(3)}
            isCompleted={hasCompletedFirstAction}
            canStartAction={resolvedFirstActionFarmId !== null}
            onContinue={handleContinueFromFirstAction}
            onSkip={handleSkipFirstAction}
            onSelectAction={handleStartFirstAction}
            selectedActionType={onboardingActivation.firstActionType}
          />
        </View>
        <View style={[styles.slide, { width }]}>
          <NotificationsSlide isActive={activatedSlides.has(4)} onFinish={finishOnboarding} />
        </View>
      </Animated.ScrollView>

      <View
        style={[
          styles.bottomContainer,
          {
            backgroundColor: colorWithOpacity(m3.colorScheme.background, 0.92),
            borderTopColor: colorWithOpacity(m3.colorScheme.outline, 0.08),
          },
        ]}
      >
        <View style={styles.bottomMeta}>
          <Text style={[styles.stepLabel, { color: m3.colorScheme.onSurfaceVariant }]}>
            Step {currentPageIndex + 1} of {TOTAL_PAGES}
          </Text>
        </View>
        <PageIndicator totalPages={TOTAL_PAGES} currentPage={currentPage} />
        {currentPageIndex < NOTIFICATIONS_PAGE_INDEX && (
          <View style={styles.nextButtonContainer}>
            <OnboardingButton
              label={currentPageIndex < FIRST_FARM_PAGE_INDEX ? 'Next' : 'Skip for now'}
              onPress={handleNext}
              variant="primary"
            />
          </View>
        )}
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
  header: {
    gap: spacing[1],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    minHeight: 84,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  skipContainer: {
    width: 104,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  bottomContainer: {
    alignItems: 'center',
    gap: spacing[4],
    paddingTop: spacing[4],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
  },
  bottomMeta: {
    width: '100%',
    alignItems: 'flex-start',
  },
  stepLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  nextButtonContainer: {
    width: '100%',
  },
});
