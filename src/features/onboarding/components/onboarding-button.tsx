import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { triggerHapticMedium } from '@/utils/haptics';

interface OnboardingButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function OnboardingButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
}: OnboardingButtonProps) {
  const m3 = useM3();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (disabled) return;
    triggerHapticMedium();
    onPress();
  };

  const tapGesture = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      'worklet';
      scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
    })
    .onEnd(() => {
      'worklet';
      runOnJS(handlePress)();
    })
    .onFinalize(() => {
      'worklet';
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    });

  const isPrimary = variant === 'primary';

  return (
    <GestureDetector gesture={tapGesture}>
      <AnimatedView
        style={[
          animatedStyle,
          isPrimary ? styles.primaryButton : styles.ghostButton,
          isPrimary && { backgroundColor: m3.colorScheme.primary },
          disabled && styles.disabled,
        ]}
      >
        <Text
          style={[
            styles.label,
            isPrimary ? styles.primaryLabel : { color: m3.colorScheme.onSurfaceVariant },
          ]}
        >
          {label}
        </Text>
      </AnimatedView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: fontSize.lg,
    lineHeight: 24,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  primaryLabel: {
    color: '#ffffff',
  },
  disabled: {
    opacity: 0.5,
  },
});
