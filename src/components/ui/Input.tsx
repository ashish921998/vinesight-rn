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
    return 'border-surface-200';
  };

  // Background color based on state
  const getBackgroundColor = () => {
    if (isDisabled) return 'bg-surface-100';
    return 'bg-white';
  };

  return (
    <View className={containerClassName}>
      {label && (
        <Text className="text-sm font-medium text-surface-700 mb-1.5">
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
            color={isFocused ? '#408059' : '#9CA3AF'}
            style={{ marginRight: 10 }}
          />
        )}
        
        <TextInput
          className={`
            flex-1 py-3.5
            text-base text-surface-900
            ${className || ''}
          `}
          placeholderTextColor="#9CA3AF"
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
              color="#9CA3AF"
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
              color={isFocused ? '#408059' : '#9CA3AF'}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {hasError && (
        <View className="flex-row items-center mt-1.5">
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text className="text-xs text-red-500 ml-1">{error}</Text>
        </View>
      )}
    </View>
  );
}
