import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  View,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { telemetry } from '@/services/telemetry';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { springs } from '@/styles/motion';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';
import { triggerHaptic } from '@/utils/haptics';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  /** Fire a light haptic on press-down. Defaults to true. Set false for low-signal buttons. */
  haptic?: boolean;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  haptic = true,
  disabled,
  style,
  onPress,
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) {
  const m3 = useM3();
  const isInteractionDisabled = Boolean(disabled) || isLoading;
  const isVisuallyDisabled = Boolean(disabled);

  // Apple fluid-interface principle #1: respond on press-DOWN, instantly. A spring
  // press-scale (starts from the live value, so it's interruptible) + a light haptic,
  // fired on the causal event (touch-down), gives every Button direct, physical feedback.
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = (event: GestureResponderEvent) => {
    // Reanimated shared-value writes are the documented API here; the React Compiler's
    // immutability rule is a known false-positive for `.value` on `useSharedValue`.
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withSpring(0.97, springs.press);
    if (haptic) {
      triggerHaptic();
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withSpring(1, springs.press);
    onPressOut?.(event);
  };

  // Base styles
  const baseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md, // 16px for Cellar Ledger
    overflow: 'hidden',
  };

  // Size styles
  const sizeStyles: Record<string, ViewStyle> = {
    sm: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], minHeight: 40 },
    md: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], minHeight: 48 },
    lg: { paddingHorizontal: spacing[8], paddingVertical: spacing[4], minHeight: 56 },
  };

  // Cellar Ledger variant styles
  const variantStyles: Record<string, ViewStyle> = {
    primary: {
      // Primary: bg #355847 (primary[500]), white text, borderRadius 12-16, height 48
      backgroundColor: isVisuallyDisabled
        ? m3.surface.s300 // disabled state
        : m3.primary.p500, // #355847
    },
    secondary: {
      // Secondary: mist-1 bg, 1px stone-3 border
      backgroundColor: isVisuallyDisabled ? m3.surface.s200 : m3.surface.s100, // mist-1
      borderWidth: 1,
      borderColor: isVisuallyDisabled ? m3.surface.s300 : m3.surface.s300, // stone-3
    },
    outline: {
      borderWidth: 1,
      borderColor: isVisuallyDisabled ? m3.surface.s300 : m3.primary.p500,
      backgroundColor: 'transparent',
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  };

  // Text styles
  const textSizeStyles: Record<string, TextStyle> = {
    sm: { fontSize: fontSize.sm },
    md: { fontSize: fontSize.base },
    lg: { fontSize: fontSize.lg },
  };

  // Cellar Ledger text variant styles
  const textVariantStyles: Record<string, TextStyle> = {
    primary: {
      color: isVisuallyDisabled ? m3.surface.s400 : '#FFFFFF', // white for primary
      fontWeight: fontWeight.semibold,
    },
    secondary: {
      color: isVisuallyDisabled ? m3.surface.s400 : m3.surface.s900, // ink
      fontWeight: fontWeight.semibold,
    },
    outline: {
      color: isVisuallyDisabled ? m3.surface.s400 : m3.primary.p500,
      fontWeight: fontWeight.semibold,
    },
    ghost: {
      color: isVisuallyDisabled ? m3.surface.s400 : m3.primary.p500,
      fontWeight: fontWeight.medium,
    },
  };

  const containerStyle: ViewStyle = {
    ...baseStyle,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...(fullWidth ? { width: '100%' } : {}),
  };

  const textStyle: TextStyle = {
    ...textSizeStyles[size],
    ...textVariantStyles[variant],
  };

  // Cellar Ledger: pressed state color
  const stateLayerColor = variant === 'primary' ? '#FFFFFF' : m3.surface.s900; // white for primary, ink for others
  const stateLayerOpacity = 0.12;

  return (
    <Animated.View style={[animatedStyle, fullWidth ? { width: '100%' } : undefined]}>
      <Pressable
        {...props}
        disabled={isInteractionDisabled}
        accessibilityRole={props.accessibilityRole ?? 'button'}
        accessibilityState={{ disabled: isInteractionDisabled, busy: Boolean(isLoading) }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={(event) => {
          try {
            telemetry.capture('ui_button_press', {
              button_id: props.testID ?? null,
              label: props.accessibilityLabel ?? null,
              title,
              variant,
              size,
            });
          } catch {
            // Swallow telemetry errors - don't block user interactions
          }
          onPress?.(event);
        }}
        style={(state) => [containerStyle, typeof style === 'function' ? style(state) : style]}
      >
        {(state) => (
          <>
            {isLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator color={textStyle.color} size="small" />
                <Text style={[textStyle, { marginLeft: spacing[2] }]}>{title}</Text>
              </View>
            ) : (
              <>
                {leftIcon && <View style={{ marginRight: spacing[2] }}>{leftIcon}</View>}
                <Text style={textStyle}>{title}</Text>
                {rightIcon && <View style={{ marginLeft: spacing[2] }}>{rightIcon}</View>}
              </>
            )}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor:
                    state.pressed && !isInteractionDisabled
                      ? colorWithOpacity(stateLayerColor, stateLayerOpacity)
                      : 'transparent',
                },
              ]}
            />
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
