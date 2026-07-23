/**
 * DateField (Android) — a styled trigger that conditionally mounts the native
 * Compose date dialog (`presentation="dialog"`).
 *
 * The dialog fires `onValueChange` on confirm or `onDismiss` on cancel; the
 * caller should keep the value as-is on dismiss, so we unmount the picker and
 * leave `value` untouched.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useM3 } from '@/styles/use-theme';
import { DateFieldTrigger, ensureValidDate, type DateFieldProps } from './date-field-shared';

export function DateField({
  value,
  onChange,
  minimumDate,
  maximumDate,
  label,
  placeholder,
  hint,
  disabled,
  testID,
  style,
  renderTrigger,
  relativeLabels,
}: DateFieldProps) {
  const m3 = useM3();
  const [open, setOpen] = useState(false);

  return (
    <View style={style}>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <DateFieldTrigger
          value={value}
          label={label}
          placeholder={placeholder}
          hint={hint}
          disabled={disabled}
          testID={testID}
          onPress={() => setOpen(true)}
          relativeLabels={relativeLabels}
        />
      )}
      {open ? (
        <DateTimePicker
          value={ensureValidDate(value, minimumDate, maximumDate)}
          mode="date"
          presentation="dialog"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={m3.colorScheme.primary}
          onValueChange={(_, date) => {
            onChange(ensureValidDate(date, minimumDate, maximumDate));
            setOpen(false);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}
