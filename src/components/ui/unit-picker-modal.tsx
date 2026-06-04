import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
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
  const handleSelect = (unit: T) => {
    onSelect(unit);
    onClose();
  };

  const overlayStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.3),
    alignItems: 'center',
    justifyContent: 'flex-end',
  };

  const containerStyle: ViewStyle = {
    backgroundColor: m3.surface.s100,
    width: '100%',
    borderTopLeftRadius: borderRadius['3xl'],
    borderTopRightRadius: borderRadius['3xl'],
  };

  const headerStyle: ViewStyle = {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: m3.surface.s300,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const cancelButtonStyle: ViewStyle = {
    padding: spacing[2],
    marginLeft: -spacing[2],
  };

  const cancelTextStyle: TextStyle = {
    color: m3.colorScheme.onSurfaceVariant,
    fontWeight: fontWeight.semibold,
  };

  const titleTextStyle: TextStyle = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: m3.surface.s900,
    flex: 1,
    textAlign: 'center',
    paddingRight: 48,
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={overlayStyle}>
        <View style={containerStyle}>
          <View style={headerStyle}>
            <Pressable onPress={onClose} style={cancelButtonStyle}>
              <Text style={cancelTextStyle}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={titleTextStyle}>{title}</Text>
          </View>
          <ScrollView style={{ maxHeight: 400 }}>
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
