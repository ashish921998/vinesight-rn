import React from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { tapMedium } from '@/lib/haptics';
import { PRESS_SCALE, springPress } from '@/lib/animations';

interface ActionButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  tone?: 'primary' | 'accent' | 'secondary';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ActionButton({ title, tone = 'primary', onPress, ...props }: ActionButtonProps) {
  const m3 = useM3();
  const backgroundColor =
    tone === 'primary'
      ? m3.colorScheme.primary
      : tone === 'accent'
        ? m3.colorScheme.secondary
        : m3.surface.surfaceContainer;

  const textColor = tone === 'secondary' ? m3.colorScheme.onSurface : m3.colorScheme.onPrimary;

  return (
    <AnimatedPressable
      onPress={(event) => {
        tapMedium();
        onPress?.(event);
      }}
      style={({ pressed }) => ({
        minHeight: 56,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing[6],
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor,
        transform: [{ scale: springPress(pressed ? PRESS_SCALE : 1) }],
      })}
      {...props}
    >
      {({ pressed }) => (
        <Text
          style={{
            ...m3.typography.labelLarge,
            color: pressed ? colorWithOpacity(textColor, 0.9) : textColor,
          }}
        >
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
}
