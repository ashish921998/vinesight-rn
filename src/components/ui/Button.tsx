import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  type TouchableOpacityProps,
} from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
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
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  // Base styles
  const baseStyles = 'flex-row items-center justify-center rounded-xl';
  
  // Size styles
  const sizeStyles = {
    sm: 'px-4 py-2',
    md: 'px-6 py-3.5',
    lg: 'px-8 py-4',
  };
  
  // Variant styles
  const variantStyles = {
    primary: isDisabled
      ? 'bg-primary-400'
      : 'bg-primary-600 active:bg-primary-700',
    secondary: isDisabled
      ? 'bg-surface-200'
      : 'bg-surface-100 active:bg-surface-200',
    outline: isDisabled
      ? 'border border-surface-300'
      : 'border border-primary-600 active:bg-primary-50',
    ghost: isDisabled
      ? ''
      : 'active:bg-surface-100',
  };
  
  // Text styles
  const textSizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };
  
  const textVariantStyles = {
    primary: 'text-white font-semibold',
    secondary: isDisabled ? 'text-surface-400' : 'text-surface-700 font-semibold',
    outline: isDisabled ? 'text-surface-400' : 'text-primary-600 font-semibold',
    ghost: isDisabled ? 'text-surface-400' : 'text-primary-600 font-medium',
  };

  return (
    <TouchableOpacity
      disabled={isDisabled}
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className || ''}
      `}
      activeOpacity={0.8}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFFFFF' : '#408059'}
          size={size === 'sm' ? 'small' : 'small'}
        />
      ) : (
        <>
          {leftIcon && <View className="mr-2">{leftIcon}</View>}
          <Text
            className={`
              ${textSizeStyles[size]}
              ${textVariantStyles[variant]}
            `}
          >
            {title}
          </Text>
          {rightIcon && <View className="ml-2">{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
}
