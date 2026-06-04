/**
 * Parameter Selector Component
 * Multi-select checkboxes for test parameters
 */

import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { SOIL_PARAMETERS, PETIOLE_PARAMETERS } from '@/constants/lab-test-parameters';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';

interface Props {
  testType: 'soil' | 'petiole';
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
}

export default function ParameterSelector({ testType, selected, onChange }: Props) {
  const { t } = useTranslation();
  const m3 = useM3();
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
        backgroundColor: colorWithOpacity(m3.surface.s100, 0.9),
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
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
            color: m3.colorScheme.onSurface,
          }}
        >
          {t('parameterSelector.title', { count: selected.size })}
        </Text>
        <Pressable
          onPress={toggleAll}
          accessibilityRole="button"
          accessibilityLabel={
            selected.size === parameters.length
              ? t('parameterSelector.deselectAll')
              : t('parameterSelector.selectAll')
          }
          style={{
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
            borderRadius: borderRadius.full,
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.primary, 0.3),
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.primary,
            }}
          >
            {selected.size === parameters.length
              ? t('parameterSelector.deselectAll')
              : t('parameterSelector.selectAll')}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[2] }}
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
                backgroundColor: isSelected ? m3.colorScheme.primary : m3.surface.s100,
                borderColor: isSelected
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.35),
              }}
            >
              <SymbolIcon
                name={isSelected ? 'checkmark.square.fill' : 'square'}
                size={16}
                color={
                  isSelected
                    ? m3.colorScheme.onPrimary
                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
                }
              />
              <Text
                style={{
                  marginLeft: spacing[2],
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.medium,
                  color: isSelected ? m3.colorScheme.onPrimary : m3.colorScheme.onSurface,
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
