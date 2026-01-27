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
import { Symbol } from '@/components/ui/symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

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
  const handleSelect = (unit: T) => {
    onSelect(unit);
    onClose();
  };

  const overlayStyle: ViewStyle = {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  };

  const containerStyle: ViewStyle = {
    backgroundColor: colors.surface[100],
    width: '100%',
    borderTopLeftRadius: borderRadius['3xl'],
    borderTopRightRadius: borderRadius['3xl'],
  };

  const headerStyle: ViewStyle = {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[300],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const cancelButtonStyle: ViewStyle = {
    padding: spacing[2],
    marginLeft: -spacing[2],
  };

  const cancelTextStyle: TextStyle = {
    color: colors.surface[500],
    fontWeight: fontWeight.semibold,
  };

  const titleTextStyle: TextStyle = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.surface[900],
    flex: 1,
    textAlign: 'center',
    paddingRight: 48,
  };

  const getOptionStyle = (isSelected: boolean): ViewStyle => ({
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[50],
    backgroundColor: isSelected ? `${colors.primary[500]}0D` : 'transparent',
  });

  const optionContentStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const getOptionTextStyle = (isSelected: boolean): TextStyle => ({
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: isSelected ? colors.primary[500] : colors.surface[900],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={overlayStyle}>
        <View style={containerStyle}>
          <View style={headerStyle}>
            <Pressable onPress={onClose} style={cancelButtonStyle}>
              <Text style={cancelTextStyle}>Cancel</Text>
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
                      <Symbol name="checkmark.circle.fill" size={24} color={colors.primary[500]} />
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
