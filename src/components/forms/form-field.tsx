import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import {
  TextInput,
  View,
  Text,
  type TextInputProps,
  type NativeSyntheticEvent,
  type TextInputSubmitEditingEventData,
} from 'react-native';
import { Symbol } from '@/components/ui/symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  icon?: string;
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
  editable = true,
  ...props
}: FormFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = !!error;
  const isDisabled = !editable;
  const borderColor = hasError
    ? colors.error
    : isFocused
      ? colors.primary[500]
      : colors.surface[300];
  const backgroundColor = isDisabled ? colors.surface[100] : colors.white;

  return (
    <View style={{ marginBottom: spacing[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {icon && (
          <View style={{ marginRight: 6 }}>
            <Symbol name={icon} size={16} color="#408059" />
          </View>
        )}
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.surface[800],
          }}
        >
          {label}
          {required && <Text style={{ color: colors.error }}> *</Text>}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          borderRadius: borderRadius.xl,
          borderWidth: 1,
          borderColor,
          backgroundColor,
        }}
      >
        {icon && (
          <View style={{ marginRight: 10 }}>
            <Symbol name={icon} size={20} color={iconColor} />
          </View>
        )}

        <TextInput
          style={[{ flex: 1, fontSize: fontSize.base, color: colors.surface[900] }, props.style]}
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

      {hint && !hasError && (
        <Text style={{ fontSize: fontSize.xs, color: colors.surface[500], marginTop: spacing[1] }}>
          {hint}
        </Text>
      )}

      {hasError && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <Symbol name="exclamationmark.circle.fill" size={14} color={colors.error} />
          <Text style={{ fontSize: fontSize.xs, color: colors.error, marginLeft: spacing[1] }}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

// Numeric input variant
export interface NumericInputHandle {
  focus: () => void;
  blur: () => void;
  value: string;
}

export interface NumericInputProps extends Omit<
  FormFieldProps,
  'value' | 'onChangeText' | 'keyboardType'
> {
  value?: number;
  onValueChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  decimals?: number;
  unit?: string;
  onSubmitEditing?: (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void;
  blurOnSubmit?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
}

export const NumericInput = forwardRef<NumericInputHandle, NumericInputProps>(function NumericInput(
  {
    value,
    onValueChange,
    min = 0,
    max,
    decimals = 2,
    unit,
    onSubmitEditing,
    blurOnSubmit = true,
    returnKeyType = 'done',
    editable = true,
    ...props
  }: NumericInputProps,
  ref,
) {
  const [textValue, setTextValue] = useState(value != null ? String(value) : '');
  const [isFocused, setIsFocused] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const internalRef = useRef<TextInput>(null);
  const hasError = !!props.error;
  const isDisabled = !editable;
  const borderColor = hasError
    ? colors.error
    : isFocused
      ? colors.primary[500]
      : colors.surface[300];
  const backgroundColor = isDisabled ? colors.surface[100] : colors.white;

  useEffect(() => {
    if (!isEditing) {
      setTextValue(value != null ? String(value) : '');
    }
  }, [value, isEditing]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => internalRef.current?.focus(),
      blur: () => internalRef.current?.blur(),
      get value() {
        return textValue;
      },
    }),
    [textValue, internalRef],
  );

  const handleChangeText = (text: string) => {
    const cleanText = text.replace(/[^0-9.]/g, '');

    const parts = cleanText.split('.');
    let sanitizedText = parts[0];
    if (parts.length > 1) {
      sanitizedText += '.' + parts[1].slice(0, decimals);
    }

    setTextValue(sanitizedText);

    const numValue = sanitizedText === '' ? undefined : parseFloat(sanitizedText);
    const clampedValue =
      numValue !== undefined && Number.isFinite(numValue)
        ? max !== undefined
          ? Math.min(Math.max(numValue, min), max)
          : Math.max(numValue, min)
        : undefined;

    onValueChange(clampedValue);
  };

  return (
    <View style={{ marginBottom: spacing[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {props.icon && (
          <View style={{ marginRight: 6 }}>
            <Symbol name={props.icon} size={16} color="#408059" />
          </View>
        )}
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.surface[800],
          }}
        >
          {props.label}
          {props.required && <Text style={{ color: colors.error }}> *</Text>}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          borderRadius: borderRadius.xl,
          borderWidth: 1,
          borderColor,
          backgroundColor,
        }}
      >
        {props.icon && (
          <View style={{ marginRight: 10 }}>
            <Symbol name={props.icon} size={20} color={props.iconColor || '#6B7280'} />
          </View>
        )}

        <TextInput
          ref={internalRef}
          style={{ flex: 1, fontSize: fontSize.base, color: colors.surface[900] }}
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          value={textValue}
          onChangeText={handleChangeText}
          placeholder={props.placeholder}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          returnKeyType={returnKeyType}
          editable={editable}
          onFocus={(e) => {
            setIsFocused(true);
            setIsEditing(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            setIsEditing(false);
            props.onBlur?.(e);
          }}
        />

        {unit && (
          <Text
            style={{ fontSize: fontSize.sm, color: colors.surface[500], marginLeft: spacing[2] }}
          >
            {unit}
          </Text>
        )}
      </View>

      {props.hint && !props.error && (
        <Text style={{ fontSize: fontSize.xs, color: colors.surface[500], marginTop: spacing[1] }}>
          {props.hint}
        </Text>
      )}

      {props.error && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <Symbol name="exclamationmark.circle.fill" size={14} color={colors.error} />
          <Text style={{ fontSize: fontSize.xs, color: colors.error, marginLeft: spacing[1] }}>
            {props.error}
          </Text>
        </View>
      )}
    </View>
  );
});
