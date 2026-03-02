/**
 * Reusable Animation Configurations — Pi-Inspired Motion
 *
 * Spring-based, organic feel for all interactions.
 * Uses react-native-reanimated layout animations.
 */

import {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInRight,
  withSpring,
  type WithSpringConfig,
} from 'react-native-reanimated';

// ============================================================
// MARK: - Spring Configurations
// ============================================================

/** Card press spring — scale to 0.97 on press, bounce back */
export const springPressConfig: WithSpringConfig = {
  damping: 15,
  stiffness: 150,
  mass: 1,
  overshootClamping: false,
};

/** Bouncy spring for FABs and action buttons */
export const springBounceConfig: WithSpringConfig = {
  damping: 12,
  stiffness: 180,
  mass: 0.8,
};

/** Gentle spring for layout shifts */
export const springGentleConfig: WithSpringConfig = {
  damping: 20,
  stiffness: 120,
  mass: 1,
};

// ============================================================
// MARK: - Spring Helpers
// ============================================================

/** Animate a value with card-press spring */
export const springPress = (value: number) => withSpring(value, springPressConfig);

/** Animate a value with bouncy spring */
export const springBounce = (value: number) => withSpring(value, springBounceConfig);

/** Animate a value with gentle spring */
export const springGentle = (value: number) => withSpring(value, springGentleConfig);

// ============================================================
// MARK: - Layout Animations (entering/exiting)
// ============================================================

/** Fade in with slight delay — for screen entry */
export const fadeIn = FadeIn.duration(300).delay(100);

/** Fade in fast — for list items */
export const fadeInFast = FadeIn.duration(200);

/** Fade out — standard exit */
export const fadeOut = FadeOut.duration(200);

/** Slide up from bottom — for bottom sheets, creation screens */
export const slideUp = SlideInDown.duration(350).springify().damping(18).stiffness(150);

/** Slide in from right — for push navigation feel */
export const slideInRight = SlideInRight.duration(300).springify().damping(18).stiffness(150);

// ============================================================
// MARK: - Stagger Helpers
// ============================================================

/** Calculate delay for staggered children */
export const staggerDelay = (index: number, baseDelay: number = 50) =>
  FadeIn.duration(250).delay(index * baseDelay);

/** Scale press constants for card interactions */
export const PRESS_SCALE = 0.97;
export const PRESS_SCALE_SMALL = 0.95;
