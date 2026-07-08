/**
 * OptionPickerSheet — bottom-sheet single-select list.
 * Same presentation as UnitPickerModal but for keyed, labeled options
 * (farm picker, etc.) instead of raw string values.
 */

import React from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/ui/app-icon';
import { spacing, radius, fontSize } from '@/styles/theme';
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
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.3),
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          // Swallow taps inside the sheet so the backdrop press doesn't close it.
          onPress={() => {}}
          style={{
            backgroundColor: m3.surface.s100,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: '65%',
          }}
        >
          <View
            style={{
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[4],
              borderBottomWidth: 1,
              borderBottomColor: m3.surface.s300,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              selectable
              style={{
                fontSize: fontSize.lg,
                fontWeight: '700',
                color: m3.colorScheme.onSurface,
              }}
            >
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
            >
              <AppIcon
                name="close-circle"
                size={24}
                color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
              />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: spacing[8] }}>
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
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
