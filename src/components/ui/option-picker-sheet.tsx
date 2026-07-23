/**
 * OptionPickerSheet — bottom-sheet single-select list.
 * Same presentation as UnitPickerModal but for keyed, labeled options
 * (farm picker, etc.) instead of raw string values.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { BottomSheet, BottomSheetScrollView } from '@expo/ui/community/bottom-sheet';
import { AppIcon } from '@/components/ui/app-icon';
import { SheetHeader } from '@/components/ui/sheet-header';
import { spacing, fontSize } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export interface OptionPickerSheetOption {
  key: string;
  label: string;
}

interface OptionPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (key: string) => void;
  options: OptionPickerSheetOption[];
  selectedKey?: string | null;
  title: string;
}

export function OptionPickerSheet({
  visible,
  onClose,
  onSelect,
  options,
  selectedKey,
  title,
}: OptionPickerSheetProps) {
  const m3 = useM3();

  return (
    <BottomSheet
      index={visible ? 0 : -1}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: m3.surface.s100 }}
    >
      {/* No flex:1 — the sheet sizes to content, so a short list has no trailing gap. */}
      <View>
        <SheetHeader title={title} />
        <BottomSheetScrollView contentContainerStyle={{ paddingBottom: spacing[8] }}>
          {options.map((option) => {
            const isSelected = option.key === selectedKey;
            return (
              <Pressable
                key={option.key}
                onPress={() => {
                  onSelect(option.key);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing[4],
                  paddingVertical: 14,
                  backgroundColor: isSelected
                    ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                    : 'transparent',
                }}
              >
                <Text
                  selectable
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: isSelected ? '700' : '400',
                    color: isSelected ? m3.colorScheme.primary : m3.colorScheme.onSurface,
                  }}
                >
                  {option.label}
                </Text>
                {isSelected && (
                  <AppIcon name="checkmark-circle" size={20} color={m3.colorScheme.primary} />
                )}
              </Pressable>
            );
          })}
        </BottomSheetScrollView>
      </View>
    </BottomSheet>
  );
}
