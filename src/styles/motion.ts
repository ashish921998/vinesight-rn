/**
 * Motion tokens — Apple "Designing Fluid Interfaces" (WWDC 2018), translated to Reanimated 4.
 *
 * The through-line: motion should start from the current on-screen value, inherit the
 * user's velocity, project momentum forward, and stay interruptible. Springs are the tool
 * that makes this natural. Reach for these presets instead of hand-typing spring configs
 * or `Animated.timing` durations per file.
 *
 * Apple deliberately replaced the physics triplet (mass/stiffness/damping) with two
 * designer-friendly parameters. Reanimated 3/4 exposes the same two directly:
 *   - `dampingRatio` — overshoot. 1.0 = critically damped (smooth settle, no bounce);
 *                      < 1.0 overshoots. Lower = bouncier.
 *   - `duration`     — Apple's "response": how quickly the value reaches the target (ms).
 *                      Not a fixed animation length — a spring has no hard duration.
 *
 * DEFAULTS (from the skill):
 *   - Most UI starts critically damped (`dampingRatio: 1`) — graceful, non-distracting.
 *   - Add bounce (`dampingRatio ~0.8`) ONLY when the gesture itself carried momentum
 *     (a flick, a throw, a drag release). Overshoot on a menu that just faded in feels wrong.
 *
 * REDUCED MOTION: every preset carries `reduceMotion: ReduceMotion.System`, so animations
 * automatically collapse to an instant jump when the OS "Reduce Motion" (iOS) /
 * "Remove animations" (Android) setting is on. Consumers get accessibility for free.
 */
import { Easing, ReduceMotion } from 'react-native-reanimated';

const SYSTEM = ReduceMotion.System;

/**
 * Spring presets for `withSpring`. Concrete values track the ones Apple ships
 * (Move 1.0/0.4, Rotation 0.8/0.4, Drawer 0.8/0.3).
 */
export const springs = {
  /** Default UI move/reposition — critically damped, no overshoot. Apple: 1.0 / 0.4. */
  default: { dampingRatio: 1, duration: 400, reduceMotion: SYSTEM },
  /** Slightly quicker settle for smaller elements. */
  gentle: { dampingRatio: 1, duration: 350, reduceMotion: SYSTEM },
  /** Snappy, still no bounce — segmented indicators, toggles. */
  snappy: { dampingRatio: 1, duration: 250, reduceMotion: SYSTEM },
  /** Button / tappable press-scale. Fast and clean. */
  press: { dampingRatio: 1, duration: 220, reduceMotion: SYSTEM },
  /** Momentum release — a flick or drag-end. Slight bounce, because a gesture preceded it. */
  momentum: { dampingRatio: 0.8, duration: 400, reduceMotion: SYSTEM },
  /** Drawer / bottom sheet. Apple: 0.8 / 0.3. */
  drawer: { dampingRatio: 0.8, duration: 300, reduceMotion: SYSTEM },
  /** Rotation. Apple: 0.8 / 0.4. */
  rotate: { dampingRatio: 0.8, duration: 400, reduceMotion: SYSTEM },
} as const;

/**
 * Durations for `withTiming` / cross-fades. Prefer springs for anything a user can touch;
 * use these for opacity/color transitions and reduced-motion cross-fades.
 */
export const durations = {
  instant: 100,
  fast: 200,
  base: 300,
  slow: 400,
} as const;

/**
 * Easing curves for `withTiming`. `standard` is the general-purpose ease; `decelerate`
 * for elements entering (fast → slow), `accelerate` for elements leaving (slow → fast).
 * Mirror these on reversible transitions so the return path matches the outbound path.
 */
export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  decelerate: Easing.out(Easing.cubic),
  accelerate: Easing.in(Easing.cubic),
  emphasized: Easing.bezier(0.25, 0.1, 0.25, 1),
} as const;

export const timing = {
  fast: { duration: durations.fast, easing: easing.standard, reduceMotion: SYSTEM },
  base: { duration: durations.base, easing: easing.standard, reduceMotion: SYSTEM },
  slow: { duration: durations.slow, easing: easing.standard, reduceMotion: SYSTEM },
  /** Element entering the screen. */
  enter: { duration: durations.base, easing: easing.decelerate, reduceMotion: SYSTEM },
  /** Element leaving the screen. */
  exit: { duration: durations.fast, easing: easing.accelerate, reduceMotion: SYSTEM },
} as const;

// NOTE: gesture helpers for momentum projection (`projectDecay`) and soft-boundary
// resistance (`rubberband`) will land alongside the shared gesture-driven BottomSheet /
// swipe-row work — added then, when there's a consumer, rather than speculatively.
