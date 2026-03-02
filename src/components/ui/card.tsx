import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, shadows, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { tapLight } from '@/lib/haptics';
import { PRESS_SCALE, springPress } from '@/lib/animations';

interface CardProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  interactive?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Card
 * - Uses an outer container for shadow (so shadows don't get clipped)
 * - Uses an inner container to clip pressed state layer / rounded corners
 */
export function Card({
  children,
  style,
  padded = true,
  interactive = false,
  onPress,
  ...props
}: CardProps) {
  const m3 = useM3();

  const innerStyle: StyleProp<ViewStyle> = [
    styles.inner,
    {
      backgroundColor: m3.surface.surfaceContainerLowest,
      borderRadius: borderRadius['3xl'],
      padding: padded ? spacing[4] : 0,
    },
  ];

  if (!interactive || !onPress) {
    return (
      <View style={[styles.outer, { borderRadius: borderRadius['3xl'], ...shadows.md }, style]}>
        <View style={innerStyle}>{children}</View>
      </View>
    );
  }

  return (
    <AnimatedPressable
      onPress={(event: GestureResponderEvent) => {
        tapLight();
        onPress(event);
      }}
      style={({ pressed }: { pressed: boolean }) => [
        styles.outer,
        {
          borderRadius: borderRadius['3xl'],
          ...shadows.md,
          transform: [{ scale: springPress(pressed ? PRESS_SCALE : 1) }],
        },
        style,
      ]}
      {...props}
    >
      {({ pressed }: { pressed: boolean }) => (
        <View style={innerStyle}>
          {children}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: borderRadius['3xl'],
                backgroundColor: pressed
                  ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                  : 'transparent',
              },
            ]}
          />
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    // IMPORTANT: no overflow hidden here (keeps shadow visible)
  },
  inner: {
    overflow: 'hidden',
  },
});
