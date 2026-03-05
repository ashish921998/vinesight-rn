/**
 * Farm Form – shared iOS date picker bottom sheet
 * Renders a spinner-style date picker inside a bottom sheet modal.
 * Used for both planting date and pruning date.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { ModalBackdrop } from '@/components/ui';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { colorWithOpacity } from '@/utils/color';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { ensureValidDate } from './utils';

interface DatePickerModalProps {
  visible: boolean;
  title: string;
  value: Date;
  onClose: () => void;
  onChange: (date: Date) => void;
  onConfirm: () => void;
}

export function DatePickerModal({
  visible,
  title,
  value,
  onClose,
  onChange,
  onConfirm,
}: DatePickerModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();

  return (
    <ModalBackdrop visible={visible} onDismiss={onClose} opacity={0.5} zIndex={50}>
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface[100],
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 16,
        }}
        onStartShouldSetResponder={() => true}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Text
            selectable
            style={{ fontSize: 18, fontWeight: '700', color: m3.colorScheme.onSurface }}
          >
            {title}
          </Text>
          <Pressable onPress={onClose}>
            <UISymbol
              name="xmark.circle.fill"
              size={24}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
          </Pressable>
        </View>

        <DateTimePicker
          value={ensureValidDate(value)}
          mode="date"
          display="spinner"
          onChange={(event, date) => {
            if (event.type === 'dismissed') return;
            const nextDate =
              date ??
              (typeof event.nativeEvent?.timestamp === 'number'
                ? new Date(event.nativeEvent.timestamp)
                : undefined);
            if (nextDate) onChange(ensureValidDate(nextDate));
          }}
        />

        <Pressable
          onPress={onConfirm}
          style={[
            { marginTop: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
            { backgroundColor: m3.colorScheme.primary },
          ]}
        >
          <Text selectable style={{ fontWeight: '600', color: m3.colorScheme.onPrimary }}>
            {t('entryForm.done')}
          </Text>
        </Pressable>
      </View>
    </ModalBackdrop>
  );
}
