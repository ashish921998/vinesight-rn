/**
 * Parameter Selector Component
 * Multi-select checkboxes for test parameters
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import { SOIL_PARAMETERS, PETIOLE_PARAMETERS } from '../../hooks/useLabTests';

interface Props {
  testType: 'soil' | 'petiole';
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
}

export default function ParameterSelector({ testType, selected, onChange }: Props) {
  const parameters = testType === 'soil' ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;

  const toggleAll = () => {
    if (selected.size === parameters.length) {
      onChange(new Set());
    } else {
      onChange(new Set(parameters.map((p) => p.key)));
    }
  };

  const toggleParam = (key: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    onChange(newSelected);
  };

  return (
    <View className="bg-white/80 px-4 py-3 border-b border-gray-200">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-semibold text-gray-800">
          Parameters ({selected.size} selected)
        </Text>
        <TouchableOpacity onPress={toggleAll}>
          <Text className="text-sm text-[#408059] font-medium">
            {selected.size === parameters.length ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {parameters.map((param) => {
          const isSelected = selected.has(param.key);
          return (
            <TouchableOpacity
              key={param.key}
              onPress={() => toggleParam(param.key)}
              className={`flex-row items-center px-3 py-2 rounded-full border ${
                isSelected ? 'bg-[#408059] border-[#408059]' : 'bg-white border-gray-300'
              }`}
            >
              <Symbol
                name={isSelected ? 'checkmark.square.fill' : 'square'}
                size={16}
                color={isSelected ? 'white' : '#666'}
              />
              <Text
                className={`ml-2 text-xs font-medium ${
                  isSelected ? 'text-white' : 'text-gray-700'
                }`}
              >
                {param.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
