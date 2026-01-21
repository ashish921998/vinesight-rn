import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  isPassword?: boolean;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  isPassword = false,
  containerClassName,
  className,
  editable = true,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const hasError = !!error;
  const isDisabled = !editable;

  // Border color based on state
  const getBorderColor = () => {
    if (hasError) return 'border-red-500';
    if (isFocused) return 'border-primary-500';
    return 'border-gray-200';
  };

  // Background color based on state
  const getBackgroundColor = () => {
    if (isDisabled) return 'bg-gray-100';
    return 'bg-white';
  };

  return (
    <View className={containerClassName}>
      {label && (
        <Text 
          className="text-sm font-medium mb-1.5"
          style={{ color: '#000000' }}
        >
          {label}
        </Text>
      )}

      <View
        className={`
          flex-row items-center
          px-4 rounded-xl
          border ${getBorderColor()}
          ${getBackgroundColor()}
        `}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={isFocused ? '#408059' : '#c7c7cc'}
            style={{ marginRight: 10 }}
          />
        )}

        <TextInput
          className={`
            flex-1 py-3.5
            text-base
            ${className || ''}
          `}
          style={{ color: '#000000' }}
          placeholderTextColor="#c7c7cc"
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
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#c7c7cc"
            />
          </TouchableOpacity>
        )}

        {!isPassword && rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={rightIcon}
              size={20}
              color={isFocused ? '#408059' : '#c7c7cc'}
            />
          </TouchableOpacity>
        )}
      </View>

      {hasError && (
        <View className="flex-row items-center mt-1.5">
          <Ionicons name="alert-circle" size={14} color="#ff3b30" />
          <Text 
            className="text-xs ml-1"
            style={{ color: '#ff3b30' }}
          >
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}
