import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet, BottomSheetScrollView } from '@expo/ui/community/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface UnitPickerModalProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  onSelect: (unit: T) => void;
  selectedValue: T;
  options: readonly T[];
  title: string;
}

export function UnitPickerModal<T extends string>({
  visible,
  onClose,
  onSelect,
  selectedValue,
  options,
  title,
}: UnitPickerModalProps<T>) {
  const m3 = useM3();
  const { t } = useTranslation();

  return (
    <BottomSheet
      index={visible ? 0 : -1}
      snapPoints={['50%', '100%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: m3.surface.s100 }}
    >
      <View style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[4],
            borderBottomWidth: 1,
            borderBottomColor: m3.surface.s300,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                fontWeight: fontWeight.semibold,
              }}
            >
              {t('common.cancel')}
            </Text>
          </Pressable>
          <Text
            style={{
              flex: 1,
              paddingRight: 48,
              textAlign: 'center',
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurface,
            }}
          >
            {title}
          </Text>
        </View>
        <BottomSheetScrollView>
          {options.map((unit) => {
            const isSelected = unit === selectedValue;
            return (
              <Pressable
                key={unit}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  onSelect(unit);
                  onClose();
                }}
                style={{
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[4],
                  borderBottomWidth: 1,
                  borderBottomColor: m3.surface.s50,
                  backgroundColor: isSelected
                    ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                    : 'transparent',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.medium,
                      color: isSelected ? m3.colorScheme.primary : m3.colorScheme.onSurface,
                    }}
                  >
                    {unit}
                  </Text>
                  {isSelected ? (
                    <SymbolIcon
                      name="checkmark.circle.fill"
                      size={24}
                      color={m3.colorScheme.primary}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </BottomSheetScrollView>
      </View>
    </BottomSheet>
  );
}
