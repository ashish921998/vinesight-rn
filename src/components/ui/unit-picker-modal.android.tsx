import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScrollView } from 'react-native';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { SheetHeader } from '@/components/ui/sheet-header';
import { fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { AndroidModalSheet } from '@/components/ui/android-modal-sheet';

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

  return (
    <AndroidModalSheet visible={visible} onClose={onClose} backgroundColor={m3.surface.s100}>
      <View style={{ flex: 1 }}>
        <SheetHeader title={title} />
        <ScrollView keyboardShouldPersistTaps="handled">
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
        </ScrollView>
      </View>
    </AndroidModalSheet>
  );
}
