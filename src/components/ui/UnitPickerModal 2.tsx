import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: colors.white,
            width: '100%',
            borderTopLeftRadius: borderRadius['3xl'],
            borderTopRightRadius: borderRadius['3xl'],
          }}
        >
          <View
            style={{
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[4],
              borderBottomWidth: 1,
              borderBottomColor: colors.gray[200],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              style={{ padding: spacing[2], marginLeft: -spacing[2] }}
            >
              <Text style={{ color: colors.surface[500], fontWeight: fontWeight.semibold }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
                color: colors.surface[900],
                flex: 1,
                textAlign: 'center',
                paddingRight: spacing[6],
              }}
            >
              {title}
            </Text>
          </View>
          <ScrollView style={{ maxHeight: 400 }}>
            {options.map((unit) => {
              const isSelected = unit === selectedValue;
              return (
                <TouchableOpacity
                  key={unit}
                  onPress={() => handleSelect(unit)}
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[4],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.gray[100],
                    backgroundColor: isSelected ? 'rgba(64, 128, 89, 0.05)' : 'transparent',
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
                        color: isSelected ? colors.primary[500] : colors.surface[900],
                      }}
                    >
                      {unit}
                    </Text>
                    {isSelected && (
                      <Symbol name="checkmark.circle.fill" size={24} color={colors.primary[500]} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
