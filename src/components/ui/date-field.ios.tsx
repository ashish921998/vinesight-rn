/**
 * DateField (iOS) — uses the shared app-styled trigger, then presents the native
 * SwiftUI picker in a sheet. Keeping the native compact picker inline makes it
 * render as Apple's small pill instead of our full-width form input.
 */

import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { BottomSheet } from '@expo/ui/community/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
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
}: DateFieldProps) {
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // The picker wheel always needs a concrete date to sit on; when `value` is
  // null (no date set) we open on today, but only commit via onChange on Done.
  const [draftDate, setDraftDate] = useState(() => ensureValidDate(value));

  const close = () => {
    setDraftDate(ensureValidDate(value));
    setOpen(false);
  };

  return (
    <View style={style}>
      <DateFieldTrigger
        value={value}
        label={label}
        placeholder={placeholder}
        hint={hint}
        disabled={disabled}
        testID={testID}
        onPress={() => {
          setDraftDate(ensureValidDate(value));
          setOpen(true);
        }}
      />
      <BottomSheet
        index={open ? 0 : -1}
        enableDynamicSizing
        enablePanDownToClose
        onClose={close}
        backgroundStyle={{ backgroundColor: m3.surface.surfaceContainerLow }}
      >
        <View
          style={{
            paddingHorizontal: spacing[4],
            paddingTop: spacing[4],
            paddingBottom: Math.max(insets.bottom, spacing[4]),
            gap: spacing[3],
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing[3],
            }}
          >
            <Pressable onPress={close} hitSlop={8}>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.medium,
                  color: m3.colorScheme.onSurfaceVariant,
                }}
              >
                {t('common.cancel')}
              </Text>
            </Pressable>
            <Text
              style={{
                ...m3.typography.titleMedium,
                color: m3.colorScheme.onSurface,
                flex: 1,
                textAlign: 'center',
              }}
            >
              {label ?? t('common.selectDate', { defaultValue: 'Select date' })}
            </Text>
            <Pressable
              onPress={() => {
                onChange(ensureValidDate(draftDate));
                setOpen(false);
              }}
              hitSlop={8}
              style={{
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                borderRadius: borderRadius.full,
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14),
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.primary,
                }}
              >
                {t('common.done')}
              </Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={draftDate}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            accentColor={m3.colorScheme.primary}
            onValueChange={(_, date) => setDraftDate(ensureValidDate(date))}
          />
        </View>
      </BottomSheet>
    </View>
  );
}
