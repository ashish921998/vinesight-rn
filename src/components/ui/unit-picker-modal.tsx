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
  /**
   * Farmer-facing label for an option value. Falls back to the raw value
   * (the chip key) when absent — the historical behavior. Lets a form show a
   * clearer spelling ("kg (total)") than its persistence key ("kg total").
   */
  getLabel?: (value: T) => string;
  /**
   * One-line hint shown as a muted subtitle under the label. Return undefined
   * for options that need no explanation. Absent getter → no subtitles.
   */
  getHint?: (value: T) => string | undefined;
}

export function UnitPickerModal<T extends string>({
  visible,
  onClose,
  onSelect,
  selectedValue,
  options,
  title,
  getLabel,
  getHint,
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
            const label = getLabel ? getLabel(unit) : unit;
            const hint = getHint ? getHint(unit) : undefined;
            return (
              <Pressable
                key={unit}
                onPress={() => handleSelect(unit)}
                style={getOptionStyle(isSelected)}
              >
                <View style={optionContentStyle}>
                  <View style={{ flex: 1, marginRight: spacing[3] }}>
                    <Text style={getOptionTextStyle(isSelected)}>{label}</Text>
                    {hint ? (
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color: m3.surface.s600,
                          marginTop: 2,
                        }}
                      >
                        {hint}
                      </Text>
                    ) : null}
                  </View>
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
