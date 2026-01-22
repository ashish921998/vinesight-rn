import React, { useState } from 'react';
import { TextInput, View, Text, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FormFieldProps extends TextInputProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  error?: string;
  required?: boolean;
  hint?: string;
}

export function FormField({
  label,
  icon,
  iconColor = '#6B7280',
  error,
  required = false,
  hint,
  className,
  editable = true,
  ...props
}: FormFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = !!error;
  const isDisabled = !editable;

  return (
    <View className="mb-4">
      <View className="flex-row items-center mb-1.5">
        {icon && <Ionicons name={icon} size={16} color="#408059" style={{ marginRight: 6 }} />}
        <Text className="text-sm font-semibold text-surface-800">
          {label}
          {required && <Text className="text-red-500"> *</Text>}
        </Text>
      </View>

      <View
        className={`
          flex-row items-center
          px-4 py-3 rounded-xl
          border
          ${hasError ? 'border-red-500' : isFocused ? 'border-primary-500' : 'border-surface-200'}
          ${isDisabled ? 'bg-surface-100' : 'bg-white'}
        `}
      >
        {icon && <Ionicons name={icon} size={20} color={iconColor} style={{ marginRight: 10 }} />}

        <TextInput
          className={`flex-1 text-base text-surface-900 ${className || ''}`}
          placeholderTextColor="#9CA3AF"
          editable={editable}
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
      </View>

      {hint && !hasError && <Text className="text-xs text-surface-500 mt-1">{hint}</Text>}

      {hasError && (
        <View className="flex-row items-center mt-1.5">
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text className="text-xs text-red-500 ml-1">{error}</Text>
        </View>
      )}
    </View>
  );
}

// Numeric input variant
interface NumericInputProps extends Omit<
  FormFieldProps,
  'value' | 'onChangeText' | 'keyboardType'
> {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  decimals?: number;
  unit?: string;
}

export function NumericInput({
  value,
  onValueChange,
  min = 0,
  max,
  decimals = 2,
  unit,
  ...props
}: NumericInputProps) {
  const [textValue, setTextValue] = useState(value > 0 ? value.toString() : '');

  const handleChangeText = (text: string) => {
    // Allow empty string, digits, and one decimal point
    const cleanText = text.replace(/[^0-9.]/g, '');

    // Prevent multiple decimal points
    const parts = cleanText.split('.');
    let sanitizedText = parts[0];
    if (parts.length > 1) {
      sanitizedText += '.' + parts[1].slice(0, decimals);
    }

    setTextValue(sanitizedText);

    const numValue = parseFloat(sanitizedText) || 0;
    const clampedValue =
      max !== undefined ? Math.min(Math.max(numValue, min), max) : Math.max(numValue, min);

    onValueChange(clampedValue);
  };

  return (
    <View className="mb-4">
      <View className="flex-row items-center mb-1.5">
        {props.icon && (
          <Ionicons name={props.icon} size={16} color="#408059" style={{ marginRight: 6 }} />
        )}
        <Text className="text-sm font-semibold text-surface-800">
          {props.label}
          {props.required && <Text className="text-red-500"> *</Text>}
        </Text>
      </View>

      <View className="flex-row items-center px-4 py-3 rounded-xl border border-surface-200 bg-white">
        {props.icon && (
          <Ionicons
            name={props.icon}
            size={20}
            color={props.iconColor || '#6B7280'}
            style={{ marginRight: 10 }}
          />
        )}

        <TextInput
          className="flex-1 text-base text-surface-900"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          value={textValue}
          onChangeText={handleChangeText}
          placeholder={props.placeholder}
        />

        {unit && <Text className="text-sm text-surface-500 ml-2">{unit}</Text>}
      </View>

      {props.hint && !props.error && (
        <Text className="text-xs text-surface-500 mt-1">{props.hint}</Text>
      )}

      {props.error && (
        <View className="flex-row items-center mt-1.5">
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text className="text-xs text-red-500 ml-1">{props.error}</Text>
        </View>
      )}
    </View>
  );
}
