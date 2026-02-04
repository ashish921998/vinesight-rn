import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  Pressable,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Symbol } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
  containerClassName?: string; // Legacy support - will be ignored
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  isPassword = false,
  containerStyle,
  style,
  editable = true,
  ...props
}: InputProps) {
  const m3 = useM3();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const hasError = !!error;
  const isDisabled = !editable;

  // Border color based on state
  const getBorderColor = () => {
    if (hasError) return m3.colorScheme.error;
    if (isFocused) return m3.colorScheme.primary;
    return m3.colorScheme.outlineVariant;
  };

  // Background color based on state
  const getBackgroundColor = () => {
    if (isDisabled) return m3.surface.surfaceContainerLowest;
    return m3.surface.surfaceContainerLow;
  };

  const labelStyle: TextStyle = {
    ...m3.typography.labelLarge,
    fontWeight: fontWeight.medium,
    marginBottom: spacing[1],
    color: m3.colorScheme.onSurface,
  };

  const inputContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: isFocused ? 2 : 1,
    borderColor: getBorderColor(),
    backgroundColor: getBackgroundColor(),
  };

  const inputStyle: TextStyle = {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: m3.colorScheme.onSurface,
  };

  const errorContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  };

  const errorTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    marginLeft: spacing[1],
    color: m3.colorScheme.error,
  };

  return (
    <View style={containerStyle}>
      {label && <Text style={labelStyle}>{label}</Text>}

      <View style={inputContainerStyle}>
        {leftIcon && (
          <View style={{ marginRight: spacing[2] }}>
            <Symbol
              name={leftIcon}
              size={20}
              color={
                isFocused
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
              }
            />
          </View>
        )}

        <TextInput
          style={[inputStyle, style]}
          placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
          editable={editable}
          secureTextEntry={isPassword && !showPassword}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />

        {isPassword && (
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Symbol
              name={showPassword ? 'eye.slash' : 'eye'}
              size={20}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
            />
          </Pressable>
        )}

        {!isPassword && rightIcon && (
          <Pressable
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Input action"
          >
            <Symbol
              name={rightIcon}
              size={20}
              color={
                isFocused
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
              }
            />
          </Pressable>
        )}
      </View>

      {hasError && (
        <View style={errorContainerStyle}>
          <Symbol name="exclamationmark.circle.fill" size={14} color={m3.colorScheme.error} />
          <Text style={errorTextStyle}>{error}</Text>
        </View>
      )}
    </View>
  );
}
