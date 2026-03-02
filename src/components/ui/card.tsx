import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
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

export function Card({
  children,
  style,
  padded = true,
  interactive = false,
  onPress,
  ...props
}: CardProps) {
  const m3 = useM3();

  if (!interactive || !onPress) {
    return (
      <View
        style={[
          styles.base,
          {
            backgroundColor: m3.surface.surfaceContainerLowest,
            borderRadius: borderRadius['3xl'],
            padding: padded ? spacing[4] : 0,
            ...shadows.md,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <AnimatedPressable
      onPress={(event) => {
        tapLight();
        onPress(event);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: m3.surface.surfaceContainerLowest,
          borderRadius: borderRadius['3xl'],
          padding: padded ? spacing[4] : 0,
          ...shadows.md,
          transform: [{ scale: springPress(pressed ? PRESS_SCALE : 1) }],
        },
        style,
      ]}
      {...props}
    >
      {({ pressed }) => (
        <>
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
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
