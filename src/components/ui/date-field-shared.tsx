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

import React, { type ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol } from '@/components/ui/symbol';
import { formatDate } from '@/i18n/format';
import { componentRadius, fontSize, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export interface DateFieldProps {
  /**
   * Current date value (controlled). `null` means "no date set" and renders the
   * placeholder instead of a formatted date — use it for optional dates so an
   * empty value doesn't masquerade as today.
   */
  value: Date | null;
  /** Called when the user confirms a new date. */
  onChange: (date: Date) => void;
  /** Earliest selectable date. */
  minimumDate?: Date;
  /** Latest selectable date. */
  maximumDate?: Date;
  /** Optional label rendered above the trigger. */
  label?: string;
  /** Placeholder shown when `value` is null. Defaults to "Select date". */
  placeholder?: string;
  /** Optional hint rendered below the trigger. */
  hint?: string;
  /** Disable the trigger. */
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
  /** Replaces the standard field trigger while preserving the native picker. */
  renderTrigger?: (openPicker: () => void) => ReactNode;
  /**
   * iOS only: present the picker in a React Native `Modal` overlay (on top of
   * whatever is behind it) instead of a nested `@expo/ui` bottom sheet.
   * Required when the field lives inside another `@expo/ui` BottomSheet — that
   * library presents one sheet at a time, so a nested picker sheet would
   * dismiss its host. No-op on Android.
   */
  overlay?: boolean;
}

/**
 * Defensive fallback: if the native picker ever emits a falsy/invalid date
 * (the `@expo/ui` types declare `date: Date`, but we guard against runtime
 * oddities), fall back to `new Date()` so callers never receive an undefined
 * or NaN date that would corrupt their state.
 *
 * When `minimumDate`/`maximumDate` are supplied, the result is clamped into
 * that range. This matters for the `new Date()` fallback: a nullable field
 * whose `maximumDate` is in the past opens the picker on today, and pressing
 * Done without scrolling would otherwise commit an out-of-range date (the
 * native wheel only clamps its display, not our draft state). Valid in-range
 * dates pass through untouched.
 */
export function ensureValidDate(
  value: Date | undefined | null,
  minimumDate?: Date,
  maximumDate?: Date,
): Date {
  const base = !value || Number.isNaN(value.getTime()) ? new Date() : value;
  if (minimumDate && base.getTime() < minimumDate.getTime()) return minimumDate;
  if (maximumDate && base.getTime() > maximumDate.getTime()) return maximumDate;
  return base;
}

/**
 * The visible date trigger. Both platform renderers mount this so the input
 * looks identical across iOS/Android; only the picker that opens on press
 * differs. Mirrors the styling the old per-screen date Pressables used.
 */
export function DateFieldTrigger({
  value,
  label,
  placeholder,
  hint,
  disabled,
  testID,
  onPress,
}: {
  value: Date | null;
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  testID?: string;
  onPress: () => void;
}) {
  const m3 = useM3();
  const { t } = useTranslation();

  // `formatDate` follows the active app language (en/hi/mr), not the device
  // locale — a plain `toLocaleDateString(undefined)` would ignore the in-app
  // language setting. It returns '' for an invalid date, so coerce that empty
  // string to null too — otherwise `?? placeholder` wouldn't kick in and the
  // trigger would render blank instead of the placeholder.
  const formatted = value
    ? formatDate(value, { year: 'numeric', month: 'short', day: 'numeric' }) || null
    : null;
  const displayText =
    formatted ?? placeholder ?? t('common.selectDate', { defaultValue: 'Select date' });

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
        accessibilityValue={{ text: displayText }}
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
            color: formatted ? m3.colorScheme.onSurface : m3.colorScheme.onSurfaceVariant,
          }}
        >
          {displayText}
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
