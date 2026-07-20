/**
 * Farm Form – shared iOS date picker sheet
 * Renders a spinner-style date picker inside a bottom sheet modal.
 * Used for both planting date and pruning date.
 */

import React from 'react';
import { BottomSheet, RNHostView } from '@expo/ui';
import { fontSize, radius } from '@/styles/theme';
import { View, Text, Pressable } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useTranslation } from 'react-i18next';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { colorWithOpacity } from '@/utils/color';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { ensureValidDate } from './utils';

interface IOSDatePickerSheetProps {
  visible: boolean;
  title: string;
  value: Date;
  onClose: () => void;
  onChange: (date: Date) => void;
  onConfirm: () => void;
}

export function IOSDatePickerSheet({
  visible,
  title,
  value,
  onClose,
  onChange,
  onConfirm,
}: IOSDatePickerSheetProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const isDark = useIsDark();

  return (
    <BottomSheet isPresented={visible} onDismiss={onClose}>
      <RNHostView matchContents>
        <View
          style={{
            backgroundColor: m3.surface.s100,
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
              style={{ fontSize: fontSize.lg, fontWeight: '700', color: m3.colorScheme.onSurface }}
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
            themeVariant={isDark ? 'dark' : 'light'}
            onValueChange={(_, date) => onChange(ensureValidDate(date))}
          />

          <Pressable
            onPress={onConfirm}
            style={[
              { marginTop: 16, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
              { backgroundColor: m3.colorScheme.primary },
            ]}
          >
            <Text selectable style={{ fontWeight: '600', color: m3.colorScheme.onPrimary }}>
              {t('entryForm.done')}
            </Text>
          </Pressable>
        </View>
      </RNHostView>
    </BottomSheet>
  );
}
