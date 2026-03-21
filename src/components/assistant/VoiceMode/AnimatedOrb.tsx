/**
 * AnimatedOrb Component
 * Renders the animated orb for voice mode with 5 distinct states:
 * - idle: subtle pulse (scale 1.0 → 1.06 → 1.0)
 * - listening: expanding pulse (scale 1.0 → 1.18 → 1.0) with outer rings
 * - processing: rotation + opacity pulse
 * - speaking: rhythmic waveform-like scaling with rings
 * - error: static, slightly dimmed
 *
 * Uses react-native-reanimated v4 for smooth 60fps animations.
 * All colors from M3 theme tokens — no hardcoded colors.
 */

import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  cancelAnimation,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { useThemeTokens } from '@/styles/use-theme';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';

export type VoiceModeState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface AnimatedOrbProps {
  state: VoiceModeState;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

const ORB_SIZE = 120;
const RING_SIZE = ORB_SIZE + 40;
const OUTER_RING_SIZE = ORB_SIZE + 80;

const STATE_INDEX_MAP: Record<VoiceModeState, number> = {
  idle: 0,
  listening: 1,
  processing: 2,
  speaking: 3,
  error: 4,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnimatedOrb({
  state,
  onPress,
  disabled = false,
  accessibilityLabel,
  testID,
}: AnimatedOrbProps) {
  const { m3 } = useThemeTokens();

  // Core orb scale
  const scale = useSharedValue(1);
  // Orb opacity (for processing)
  const orbOpacity = useSharedValue(1);
  // Rotation (for processing)
  const rotation = useSharedValue(0);
  // Inner ring opacity + scale
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0);
  // Outer ring
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0);
  // Entrance animation
  const entranceScale = useSharedValue(0);
  const entranceOpacity = useSharedValue(0);
  // Press feedback
  const pressScale = useSharedValue(1);
  // Color transition
  const colorProgress = useSharedValue(STATE_INDEX_MAP[state]);

  // Entrance animation on mount
  useEffect(() => {
    entranceScale.value = withSpring(1, { damping: 12, stiffness: 150 });
    entranceOpacity.value = withTiming(1, { duration: 300 });
  }, [entranceScale, entranceOpacity]);

  // Animate color transition when state changes
  useEffect(() => {
    colorProgress.value = withTiming(STATE_INDEX_MAP[state], { duration: 300 });
  }, [state, colorProgress]);

  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(orbOpacity);
    cancelAnimation(rotation);
    cancelAnimation(ring1Scale);
    cancelAnimation(ring1Opacity);
    cancelAnimation(ring2Scale);
    cancelAnimation(ring2Opacity);

    ring1Opacity.value = 0;
    ring2Opacity.value = 0;

    switch (state) {
      case 'idle':
        scale.value = withRepeat(
          withSequence(
            withTiming(1.06, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        );
        orbOpacity.value = 1;
        rotation.value = 0;
        break;

      case 'listening':
        scale.value = withRepeat(
          withSequence(
            withTiming(1.18, { duration: 700, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.0, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        );
        orbOpacity.value = 1;
        rotation.value = 0;
        ring1Scale.value = withRepeat(
          withSequence(
            withTiming(1.4, { duration: 900, easing: Easing.out(Easing.ease) }),
            withTiming(1.0, { duration: 0 }),
          ),
          -1,
          false,
        );
        ring1Opacity.value = withRepeat(
          withSequence(withTiming(0.35, { duration: 300 }), withTiming(0, { duration: 600 })),
          -1,
          false,
        );
        break;

      case 'processing':
        scale.value = withRepeat(
          withSequence(
            withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.97, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        );
        orbOpacity.value = withRepeat(
          withSequence(
            withTiming(0.75, { duration: 600, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        );
        rotation.value = withRepeat(
          withTiming(360, { duration: 2000, easing: Easing.linear }),
          -1,
          false,
        );
        break;

      case 'speaking':
        scale.value = withRepeat(
          withSequence(
            withTiming(1.22, { duration: 250, easing: Easing.out(Easing.ease) }),
            withTiming(1.06, { duration: 250, easing: Easing.in(Easing.ease) }),
            withTiming(1.16, { duration: 200, easing: Easing.out(Easing.ease) }),
            withTiming(1.0, { duration: 300, easing: Easing.in(Easing.ease) }),
          ),
          -1,
          false,
        );
        orbOpacity.value = 1;
        rotation.value = 0;
        ring1Scale.value = withRepeat(
          withSequence(
            withTiming(1.5, { duration: 500, easing: Easing.out(Easing.ease) }),
            withTiming(1.0, { duration: 0 }),
          ),
          -1,
          false,
        );
        ring1Opacity.value = withRepeat(
          withSequence(withTiming(0.25, { duration: 200 }), withTiming(0, { duration: 300 })),
          -1,
          false,
        );
        ring2Scale.value = withRepeat(
          withSequence(
            withTiming(1.8, { duration: 700, easing: Easing.out(Easing.ease) }),
            withTiming(1.0, { duration: 0 }),
          ),
          -1,
          false,
        );
        ring2Opacity.value = withRepeat(
          withSequence(withTiming(0.15, { duration: 300 }), withTiming(0, { duration: 400 })),
          -1,
          false,
        );
        break;

      case 'error':
        scale.value = withSpring(1.0, { damping: 12, stiffness: 150 });
        orbOpacity.value = withTiming(0.65, { duration: 300 });
        rotation.value = 0;
        break;
    }
  }, [state, scale, orbOpacity, rotation, ring1Scale, ring1Opacity, ring2Scale, ring2Opacity]);

  // Build color arrays for interpolation
  const orbColors = useMemo(
    () => [
      m3.colorScheme.primaryContainer, // idle
      m3.colorScheme.primary, // listening
      m3.colorScheme.secondary ?? m3.colorScheme.primary, // processing
      m3.colorScheme.tertiary ?? m3.colorScheme.primary, // speaking
      m3.colorScheme.error, // error
    ],
    [m3.colorScheme],
  );

  const orbAnimatedColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(colorProgress.value, [0, 1, 2, 3, 4], orbColors),
  }));

  const ringColorStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(colorProgress.value, [0, 1, 2, 3, 4], orbColors),
  }));

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: entranceScale.value * scale.value * pressScale.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: entranceOpacity.value * orbOpacity.value,
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value * entranceOpacity.value,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value * entranceOpacity.value,
  }));

  const handlePressIn = () => {
    pressScale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  // Static icon color based on current state (icons don't animate color)
  const getIconColor = () => {
    switch (state) {
      case 'listening':
        return m3.colorScheme.onPrimary;
      case 'processing':
        return m3.colorScheme.onSecondary ?? m3.colorScheme.onPrimary;
      case 'speaking':
        return m3.colorScheme.onTertiary ?? m3.colorScheme.onPrimary;
      case 'error':
        return m3.colorScheme.onError;
      default:
        return m3.colorScheme.onPrimaryContainer;
    }
  };

  const iconColor = getIconColor();

  return (
    <View style={styles.container} testID={testID}>
      {/* Outer ring */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: OUTER_RING_SIZE,
            height: OUTER_RING_SIZE,
            borderRadius: OUTER_RING_SIZE / 2,
          },
          ringColorStyle,
          ring2Style,
        ]}
      />
      {/* Inner ring */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: RING_SIZE,
            height: RING_SIZE,
            borderRadius: RING_SIZE / 2,
          },
          ringColorStyle,
          ring1Style,
        ]}
      />
      {/* Orb */}
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
      >
        <Animated.View style={[styles.orb, orbAnimatedColorStyle, orbStyle]}>
          <View style={styles.indicator}>
            {state === 'processing' ? (
              <View style={styles.dotsRow}>
                {[0, 1, 2].map((i) => (
                  <ProcessingDot key={i} index={i} color={iconColor} />
                ))}
              </View>
            ) : state === 'speaking' ? (
              <View style={styles.waveformRow}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <WaveformBar key={i} index={i} color={iconColor} />
                ))}
              </View>
            ) : (
              <SymbolIcon
                name={state === 'error' ? 'exclamationmark.triangle.fill' : 'mic.fill'}
                size={36}
                color={iconColor}
              />
            )}
          </View>
        </Animated.View>
      </AnimatedPressable>
    </View>
  );
}

function ProcessingDot({ index, color }: { index: number; color: string }) {
  const dotScale = useSharedValue(1);

  useEffect(() => {
    const staggerDelay = index * 180;
    dotScale.value = withDelay(
      staggerDelay,
      withRepeat(
        withSequence(
          withTiming(1.5, { duration: 350, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 350, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [dotScale, index]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />;
}

function WaveformBar({ index, color }: { index: number; color: string }) {
  const barHeight = useSharedValue(8);
  const centerDistances = [2, 1, 0, 1, 2];
  const baseH = 8 + (2 - (centerDistances[index] ?? 0)) * 6;

  useEffect(() => {
    const delays = [0, 120, 60, 180, 90];
    const delay = delays[index] ?? 0;
    barHeight.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(baseH + 10, { duration: 250, easing: Easing.out(Easing.ease) }),
          withTiming(8, { duration: 250, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [barHeight, index, baseH]);

  const barStyle = useAnimatedStyle(() => ({
    height: barHeight.value,
  }));

  return (
    <Animated.View
      style={[styles.waveBar, { backgroundColor: color, width: 4, borderRadius: 2 }, barStyle]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: OUTER_RING_SIZE + 20,
    height: OUTER_RING_SIZE + 20,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  indicator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    minHeight: 8,
  },
});
