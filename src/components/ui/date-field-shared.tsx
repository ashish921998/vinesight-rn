/**
 * DateField — shared, platform-aware date input.
 *
 * Standardizes every date input on `@expo/ui/community/datetime-picker` so callers
 * no longer build their own date trigger + iOS bottom sheet + Android dialog +
 * draft state + Done/close buttons. See `date-field.ios.tsx` (inline compact
 * picker) and `date-field.android.tsx` (dialog presentation) for the
 * platform-specific rendering. This file owns only the shared props contract and
 * the trigger button both renderers mount.
 */

import React from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol } from '@/components/ui/symbol';
import { componentRadius, fontSize, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export interface DateFieldProps {
  /** Current date value (controlled). */
  value: Date;
  /** Called when the user confirms a new date. */
  onChange: (date: Date) => void;
  /** Earliest selectable date. */
  minimumDate?: Date;
  /** Latest selectable date. */
  maximumDate?: Date;
  /** Optional label rendered above the trigger. */
  label?: string;
  /** Optional hint rendered below the trigger. */
  hint?: string;
  /** Disable the trigger. */
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
}

/**
 * Defensive fallback: if the native picker ever emits a falsy/invalid date
 * (the `@expo/ui` types declare `date: Date`, but we guard against runtime
 * oddities), fall back to `new Date()` so callers never receive an undefined
 * or NaN date that would corrupt their state.
 */
export function ensureValidDate(value: Date | undefined | null): Date {
  if (!value) return new Date();
  return Number.isNaN(value.getTime()) ? new Date() : value;
}

/**
 * The visible date trigger. Both platform renderers mount this so the input
 * looks identical across iOS/Android; only the picker that opens on press
 * differs. Mirrors the styling the old per-screen date Pressables used.
 */
export function DateFieldTrigger({
  value,
  label,
  hint,
  disabled,
  testID,
  onPress,
}: {
  value: Date;
  label?: string;
  hint?: string;
  disabled?: boolean;
  testID?: string;
  onPress: () => void;
}) {
  const m3 = useM3();
  const { t } = useTranslation();

  const formatted = value.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={{ width: '100%' }}>
      {label ? (
        <Text
          style={{
            ...m3.typography.labelLarge,
            marginBottom: spacing[1],
            color: m3.colorScheme.onSurface,
          }}
        >
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={t('common.selectDate', { defaultValue: 'Select date' })}
        accessibilityValue={{ text: formatted }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          borderRadius: componentRadius.input,
          borderWidth: 1,
          borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
          backgroundColor: m3.surface.surfaceContainerLow,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text
          style={{
            fontSize: fontSize.base,
            color: m3.colorScheme.onSurface,
          }}
        >
          {formatted}
        </Text>
        <Symbol name="calendar" size={20} color={m3.colorScheme.onSurfaceVariant} />
      </Pressable>
      {hint ? (
        <Text
          style={{
            fontSize: fontSize.xs,
            color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8),
            marginTop: spacing[2],
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
