import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { BottomSheet, BottomSheetScrollView } from '@expo/ui/community/bottom-sheet';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { SheetHeader } from '@/components/ui/sheet-header';
import { spacing, fontSize, fontWeight } from '@/styles/theme';
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
  const handleSelect = (unit: T) => {
    onSelect(unit);
    onClose();
  };

  const getOptionStyle = (isSelected: boolean): ViewStyle => ({
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: m3.surface.s50,
    backgroundColor: isSelected ? colorWithOpacity(m3.colorScheme.primary, 0.08) : 'transparent',
  });

  const optionContentStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const getOptionTextStyle = (isSelected: boolean): TextStyle => ({
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: isSelected ? m3.colorScheme.primary : m3.surface.s900,
  });

  return (
    <BottomSheet
      index={visible ? 0 : -1}
      snapPoints={['50%', '100%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: m3.surface.s100 }}
    >
      <View style={{ flex: 1 }}>
        <SheetHeader title={title} />
        <BottomSheetScrollView style={{ maxHeight: 400 }}>
          {options.map((unit) => {
            const isSelected = unit === selectedValue;
            return (
              <Pressable
                key={unit}
                onPress={() => handleSelect(unit)}
                style={getOptionStyle(isSelected)}
              >
                <View style={optionContentStyle}>
                  <Text style={getOptionTextStyle(isSelected)}>{unit}</Text>
                  {isSelected && (
                    <SymbolIcon
                      name="checkmark.circle.fill"
                      size={24}
                      color={m3.colorScheme.primary}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </BottomSheetScrollView>
      </View>
    </BottomSheet>
  );
}
