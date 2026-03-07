import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFarms } from '@/hooks';
import { telemetry } from '@/services/telemetry';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { colorWithOpacity } from '@/utils/color';
import { OnboardingButton } from './components/onboarding-button';
import { PageIndicator } from './components/page-indicator';
import { FirstFarmSlide } from './slides/first-farm-slide';
import { HeroSlide } from './slides/hero-slide';
import { NotificationsSlide } from './slides/notifications-slide';
import { ValuePropsSlide } from './slides/value-props-slide';

const TOTAL_PAGES = 4;
const FIRST_FARM_PAGE_INDEX = 2;
const NOTIFICATIONS_PAGE_INDEX = 3;

export function OnboardingScreen() {
  const m3 = useM3();
  const { width } = useWindowDimensions();
  const { data: farms = [] } = useFarms();
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const viewedSlides = useRef(new Set<number>([0]));
  const [activatedSlides, setActivatedSlides] = useState(new Set<number>([0]));
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [createdFarmId, setCreatedFarmId] = useState<number | null>(null);
  const hasAtLeastOneFarm = farms.length > 0;

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
      if (page > FIRST_FARM_PAGE_INDEX && !hasAtLeastOneFarm) {
        scrollRef.current?.scrollTo({ x: FIRST_FARM_PAGE_INDEX * width, animated: true });
        setCurrentPageIndex(FIRST_FARM_PAGE_INDEX);
        handleSlideChange(FIRST_FARM_PAGE_INDEX);
        return;
      }
      setCurrentPageIndex(page);
      handleSlideChange(page);
    },
    [handleSlideChange, hasAtLeastOneFarm, width],
  );

  const handleNext = useCallback(() => {
    const nextPage = currentPageIndex + 1;
    if (nextPage >= TOTAL_PAGES) return;
    scrollRef.current?.scrollTo({ x: nextPage * width, animated: true });
    setCurrentPageIndex(nextPage);
    handleSlideChange(nextPage);
  }, [currentPageIndex, handleSlideChange, width]);

  const finishOnboarding = useCallback(
    (notificationsEnabled: boolean) => {
      useOnboardingStore.getState().setPreferences({ notificationsEnabled });
      useAuthStore.getState().setHasSeenOnboarding(true);
      useOnboardingStore.getState().completeOnboarding();
      telemetry.capture('onboarding_completed', { notifications_enabled: notificationsEnabled });
      if (typeof createdFarmId === 'number') {
        useGuidedTourStore.getState().startTourAtStep('add_log', { farmId: createdFarmId });
        router.replace(`/farm/${createdFarmId}`);
        return;
      }
      router.replace('/(tabs)');
    },
    [createdFarmId],
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
    if (currentPageIndex < FIRST_FARM_PAGE_INDEX) {
      telemetry.capture('onboarding_jump_to_farm_step');
      jumpToPage(FIRST_FARM_PAGE_INDEX);
      return;
    }

    if (currentPageIndex === NOTIFICATIONS_PAGE_INDEX) {
      telemetry.capture('onboarding_skipped', { step: 'notifications' });
      finishOnboarding(false);
    }
  }, [currentPageIndex, finishOnboarding, jumpToPage]);

  const handleFarmResolved = useCallback(
    (farmId: number | null) => {
      setCreatedFarmId(farmId);
      jumpToPage(NOTIFICATIONS_PAGE_INDEX);
    },
    [jumpToPage],
  );

  React.useEffect(() => {
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
        {currentPageIndex !== FIRST_FARM_PAGE_INDEX ? (
          <View style={styles.skipContainer}>
            <OnboardingButton label="Skip" onPress={handleSkip} variant="ghost" />
          </View>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
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
          <FirstFarmSlide isActive={activatedSlides.has(2)} onResolved={handleFarmResolved} />
        </View>
        <View style={[styles.slide, { width }]}>
          <NotificationsSlide isActive={activatedSlides.has(3)} onFinish={finishOnboarding} />
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
        {currentPageIndex < FIRST_FARM_PAGE_INDEX && (
          <View style={styles.nextButtonContainer}>
            <OnboardingButton label="Next" onPress={handleNext} variant="primary" />
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
    ...StyleSheet.absoluteFillObject,
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
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  skipPlaceholder: {
    width: 104,
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
