/**
 * Parameter Selector Component
 * Multi-select checkboxes for test parameters
 */

import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { SOIL_PARAMETERS, PETIOLE_PARAMETERS } from '../../hooks/use-lab-tests';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

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
    <View
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[200],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing[3],
        }}
      >
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.gray[800],
          }}
        >
          Parameters ({selected.size} selected)
        </Text>
        <Pressable onPress={toggleAll}>
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.primary[500],
            }}
          >
            {selected.size === parameters.length ? 'Deselect All' : 'Select All'}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {parameters.map((param) => {
          const isSelected = selected.has(param.key);
          return (
            <Pressable
              key={param.key}
              onPress={() => toggleParam(param.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                borderRadius: borderRadius.full,
                borderWidth: 1,
                backgroundColor: isSelected ? colors.primary[500] : colors.white,
                borderColor: isSelected ? colors.primary[500] : colors.gray[300],
              }}
            >
              <SymbolIcon
                name={isSelected ? 'checkmark.square.fill' : 'square'}
                size={16}
                color={isSelected ? 'white' : '#666'}
              />
              <Text
                style={{
                  marginLeft: spacing[2],
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.medium,
                  color: isSelected ? colors.white : colors.gray[700],
                }}
              >
                {param.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
