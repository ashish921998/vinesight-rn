/**
 * DateField (iOS) — uses the shared app-styled trigger, then presents the native
 * SwiftUI picker in a sheet. Keeping the native compact picker inline makes it
 * render as Apple's small pill instead of our full-width form input.
 */

import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
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
  renderTrigger,
  overlay,
  relativeLabels,
}: DateFieldProps) {
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // The picker wheel always needs a concrete date to sit on; when `value` is
  // null (no date set) we open on today, clamped into any min/max range so a
  // Done-without-scroll can't commit an out-of-range date.
  const [draftDate, setDraftDate] = useState(() =>
    ensureValidDate(value, minimumDate, maximumDate),
  );

  const close = () => {
    setDraftDate(ensureValidDate(value, minimumDate, maximumDate));
    setOpen(false);
  };

  const openPicker = () => {
    setDraftDate(ensureValidDate(value, minimumDate, maximumDate));
    setOpen(true);
  };

  const commit = () => {
    onChange(ensureValidDate(draftDate, minimumDate, maximumDate));
    setOpen(false);
  };

  const panel = (
    <View
      style={{
        paddingHorizontal: spacing[4],
        paddingTop: spacing[3],
        paddingBottom: Math.max(insets.bottom, spacing[4]),
        gap: spacing[2],
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
          onPress={commit}
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
        onValueChange={(_, date) => setDraftDate(ensureValidDate(date, minimumDate, maximumDate))}
      />
    </View>
  );

  return (
    <View style={style}>
      {renderTrigger ? (
        renderTrigger(openPicker)
      ) : (
        <DateFieldTrigger
          value={value}
          label={label}
          placeholder={placeholder}
          hint={hint}
          disabled={disabled}
          testID={testID}
          onPress={openPicker}
          relativeLabels={relativeLabels}
        />
      )}
      {/* Overlay mode presents the picker in a React Native Modal, which
          layers ON TOP of whatever is behind it — used inside another @expo/ui
          BottomSheet, where a nested picker sheet would dismiss its host.
          Otherwise present it in its own bottom sheet. */}
      {overlay ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={close}
          supportedOrientations={['portrait', 'landscape']}
        >
          <Pressable
            onPress={close}
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}
          >
            {/* Swallow taps on the panel so only the backdrop dismisses. */}
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: m3.surface.surfaceContainerLow,
                borderTopLeftRadius: borderRadius['2xl'],
                borderTopRightRadius: borderRadius['2xl'],
              }}
            >
              {panel}
            </Pressable>
          </Pressable>
        </Modal>
      ) : (
        <BottomSheet
          index={open ? 0 : -1}
          enableDynamicSizing
          enablePanDownToClose
          onClose={close}
          backgroundStyle={{ backgroundColor: m3.surface.surfaceContainerLow }}
        >
          {panel}
        </BottomSheet>
      )}
    </View>
  );
}
