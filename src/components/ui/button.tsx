import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  View,
  StyleSheet,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { telemetry } from '@/services/telemetry';
import { spacing, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
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
  disabled,
  style,
  onPress,
  ...props
}: ButtonProps) {
  const m3 = useM3();
  const isInteractionDisabled = Boolean(disabled) || isLoading;
  const isVisuallyDisabled = Boolean(disabled);

  // Base styles
  const baseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: m3.shape.cornerMedium,
    overflow: 'hidden',
  };

  // Size styles
  const sizeStyles: Record<string, ViewStyle> = {
    sm: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], minHeight: 40 },
    md: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], minHeight: 48 },
    lg: { paddingHorizontal: spacing[8], paddingVertical: spacing[4], minHeight: 56 },
  };

  // Variant styles
  const variantStyles: Record<string, ViewStyle> = {
    primary: {
      backgroundColor: isVisuallyDisabled ? m3.colorScheme.surfaceVariant : m3.colorScheme.primary,
    },
    secondary: {
      backgroundColor: isVisuallyDisabled
        ? m3.surface.surfaceContainerHigh
        : m3.surface.surfaceContainerLow,
    },
    outline: {
      borderWidth: 1,
      borderColor: isVisuallyDisabled ? m3.colorScheme.outlineVariant : m3.colorScheme.outline,
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

  const textVariantStyles: Record<string, TextStyle> = {
    primary: {
      color: isVisuallyDisabled ? m3.colorScheme.onSurfaceVariant : m3.colorScheme.onPrimary,
      fontWeight: fontWeight.semibold,
    },
    secondary: {
      color: isVisuallyDisabled ? m3.colorScheme.onSurfaceVariant : m3.colorScheme.onSurface,
      fontWeight: fontWeight.semibold,
    },
    outline: {
      color: isVisuallyDisabled ? m3.colorScheme.onSurfaceVariant : m3.colorScheme.primary,
      fontWeight: fontWeight.semibold,
    },
    ghost: {
      color: isVisuallyDisabled ? m3.colorScheme.onSurfaceVariant : m3.colorScheme.primary,
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

  const stateLayerColor =
    variant === 'primary' ? m3.colorScheme.onPrimary : m3.colorScheme.onSurface;

  return (
    <Pressable
      {...props}
      disabled={isInteractionDisabled}
      accessibilityRole={props.accessibilityRole ?? 'button'}
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
              StyleSheet.absoluteFillObject,
              {
                backgroundColor:
                  state.pressed && !isInteractionDisabled
                    ? colorWithOpacity(stateLayerColor, m3.stateLayerOpacity.pressed)
                    : 'transparent',
              },
            ]}
          />
        </>
      )}
    </Pressable>
  );
}
