import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  View,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
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
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  // Base styles
  const baseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.xl,
  };

  // Size styles
  const sizeStyles: Record<string, ViewStyle> = {
    sm: { paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
    md: { paddingHorizontal: spacing[6], paddingVertical: spacing[3] },
    lg: { paddingHorizontal: spacing[8], paddingVertical: spacing[4] },
  };

  // Variant styles
  const variantStyles: Record<string, ViewStyle> = {
    primary: {
      backgroundColor: isDisabled ? colors.surface[300] : colors.primary[500],
    },
    secondary: {
      backgroundColor: isDisabled ? colors.surface[200] : colors.surface[100],
    },
    outline: {
      borderWidth: 1,
      borderColor: isDisabled ? colors.surface[300] : colors.primary[500],
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
      color: isDisabled ? colors.surface[500] : colors.surface[100],
      fontWeight: fontWeight.semibold,
    },
    secondary: {
      color: isDisabled ? colors.surface[400] : colors.surface[700],
      fontWeight: fontWeight.semibold,
    },
    outline: {
      color: isDisabled ? colors.surface[400] : colors.primary[500],
      fontWeight: fontWeight.semibold,
    },
    ghost: {
      color: isDisabled ? colors.surface[400] : colors.primary[500],
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

  const resolvedStyle: PressableProps['style'] = (state) => [
    containerStyle,
    typeof style === 'function' ? style(state) : style,
  ];

  return (
    <Pressable disabled={isDisabled} style={resolvedStyle} {...props}>
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.surface[100] : colors.primary[500]}
          size={size === 'sm' ? 'small' : 'small'}
        />
      ) : (
        <>
          {leftIcon && <View style={{ marginRight: spacing[2] }}>{leftIcon}</View>}
          <Text style={textStyle}>{title}</Text>
          {rightIcon && <View style={{ marginLeft: spacing[2] }}>{rightIcon}</View>}
        </>
      )}
    </Pressable>
  );
}
