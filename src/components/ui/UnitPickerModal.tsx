import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Symbol } from '@/components/ui/Symbol';

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
      <View className="flex-1 bg-black/30 items-center justify-end">
        <View className="bg-white w-full rounded-t-3xl">
          <View className="px-4 py-4 border-b border-gray-200 flex-row items-center justify-between">
            <TouchableOpacity onPress={onClose} className="p-2 -ml-2">
              <Text className="text-[#8e8e93] font-semibold">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-lg font-bold text-[#1c1c1e] flex-1 text-center pr-12">
              {title}
            </Text>
          </View>
          <ScrollView style={{ maxHeight: 400 }}>
            {options.map((unit) => (
              <TouchableOpacity
                key={unit}
                onPress={() => handleSelect(unit)}
                className={`px-4 py-4 border-b border-gray-100 ${
                  unit === selectedValue ? 'bg-[#408059]/5' : ''
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-base font-medium ${
                      unit === selectedValue ? 'text-[#408059]' : 'text-[#1c1c1e]'
                    }`}
                  >
                    {unit}
                  </Text>
                  {unit === selectedValue && (
                    <Symbol name="checkmark.circle.fill" size={24} color="#408059" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
