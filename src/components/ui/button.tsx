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
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useThemeColors } from '@/styles/use-theme';

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
  const colors = useThemeColors();
  const isInteractionDisabled = Boolean(disabled) || isLoading;
  const isVisuallyDisabled = Boolean(disabled);

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
        ? colors.surface[300] // disabled state
        : colors.primary[500], // #355847
    },
    secondary: {
      // Secondary: mist-1 bg, 1px stone-3 border
      backgroundColor: isVisuallyDisabled ? colors.surface[200] : colors.surface[100], // mist-1
      borderWidth: 1,
      borderColor: isVisuallyDisabled ? colors.surface[300] : colors.surface[300], // stone-3
    },
    outline: {
      borderWidth: 1,
      borderColor: isVisuallyDisabled ? colors.surface[300] : colors.primary[500],
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
      color: isVisuallyDisabled ? colors.surface[400] : '#FFFFFF', // white for primary
      fontWeight: fontWeight.semibold,
    },
    secondary: {
      color: isVisuallyDisabled ? colors.surface[400] : colors.surface[900], // ink
      fontWeight: fontWeight.semibold,
    },
    outline: {
      color: isVisuallyDisabled ? colors.surface[400] : colors.primary[500],
      fontWeight: fontWeight.semibold,
    },
    ghost: {
      color: isVisuallyDisabled ? colors.surface[400] : colors.primary[500],
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
  const stateLayerColor = variant === 'primary' ? '#FFFFFF' : colors.surface[900]; // white for primary, ink for others
  const stateLayerOpacity = 0.12;

  return (
    <Pressable
      {...props}
      disabled={isInteractionDisabled}
      accessibilityRole={props.accessibilityRole ?? 'button'}
      accessibilityState={{ disabled: isInteractionDisabled, busy: Boolean(isLoading) }}
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
                    ? colorWithOpacity(stateLayerColor, stateLayerOpacity)
                    : 'transparent',
              },
            ]}
          />
        </>
      )}
    </Pressable>
  );
}
