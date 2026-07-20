/**
 * DateField (iOS) — renders the native SwiftUI compact date picker inline.
 *
 * `@expo/ui`'s drop-in `DateTimePicker` internally hosts SwiftUI, so no
 * application-level `Host` is needed. `display="compact"` is itself the tappable
 * affordance (a button that expands the native wheel inline), so we do not
 * mount a separate trigger button — just the optional label/hint above/below.
 * This replaces the old per-screen `BottomSheet` + spinner + title + close +
 * Done entirely.
 */

import React from 'react';
import { View, Text } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { fontSize, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { ensureValidDate, type DateFieldProps } from './date-field-shared';

export function DateField({
  value,
  onChange,
  minimumDate,
  maximumDate,
  label,
  hint,
  disabled,
  testID,
  style,
}: DateFieldProps) {
  const m3 = useM3();

  return (
    <View style={[{ width: '100%' }, style]}>
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
      <DateTimePicker
        value={value}
        mode="date"
        display="compact"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        accentColor={m3.colorScheme.primary}
        disabled={disabled}
        onValueChange={(_, date) => onChange(ensureValidDate(date))}
        testID={testID}
        style={{ alignSelf: 'flex-start' }}
      />
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
