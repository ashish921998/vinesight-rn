import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

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
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const hasError = !!error;
  const isDisabled = !editable;

  // Border color based on state
  const getBorderColor = () => {
    if (hasError) return colors.error;
    if (isFocused) return colors.primary[500];
    return colors.surface[300];
  };

  // Background color based on state
  const getBackgroundColor = () => {
    if (isDisabled) return colors.surface[50];
    return colors.surface[100];
  };

  const labelStyle: TextStyle = {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: 6,
    color: colors.surface[900],
  };

  const inputContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: getBorderColor(),
    backgroundColor: getBackgroundColor(),
  };

  const inputStyle: TextStyle = {
    flex: 1,
    paddingVertical: 14,
    fontSize: fontSize.base,
    color: colors.surface[900],
  };

  const errorContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  };

  const errorTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    marginLeft: spacing[1],
    color: colors.error,
  };

  return (
    <View style={containerStyle}>
      {label && <Text style={labelStyle}>{label}</Text>}

      <View style={inputContainerStyle}>
        {leftIcon && (
          <View style={{ marginRight: 10 }}>
            <Symbol
              name={leftIcon}
              size={20}
              color={isFocused ? colors.primary[500] : colors.surface[400]}
            />
          </View>
        )}

        <TextInput
          style={[inputStyle, style]}
          placeholderTextColor={colors.surface[400]}
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
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Symbol
              name={showPassword ? 'eye.slash' : 'eye'}
              size={20}
              color={colors.surface[400]}
            />
          </TouchableOpacity>
        )}

        {!isPassword && rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Symbol
              name={rightIcon}
              size={20}
              color={isFocused ? colors.primary[500] : colors.surface[400]}
            />
          </TouchableOpacity>
        )}
      </View>

      {hasError && (
        <View style={errorContainerStyle}>
          <Symbol name="exclamationmark.circle.fill" size={14} color={colors.error} />
          <Text style={errorTextStyle}>{error}</Text>
        </View>
      )}
    </View>
  );
}
