import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { Symbol } from '@/components/ui/symbol';
import { type FpcColumnOptions, FPC_FULL_COLUMNS, FPC_LEAN_COLUMNS } from '@/types/report';

interface ReportFpcColumnTogglesProps {
  columns: FpcColumnOptions;
  onChange: (columns: FpcColumnOptions) => void;
}

function matchesPreset(columns: FpcColumnOptions, preset: FpcColumnOptions): boolean {
  return Object.keys(preset).every(
    (key) => columns[key as keyof FpcColumnOptions] === preset[key as keyof FpcColumnOptions],
  );
}

/**
 * Column-detail preset for the buyer's register. Two chips rather than a card of
 * description blocks: this lives inside the register disclosure, directly above
 * the rows it reshapes, so the effect is visible and the prose is redundant.
 */
export function ReportFpcColumnToggles({ columns, onChange }: ReportFpcColumnTogglesProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const selectedPreset = matchesPreset(columns, FPC_FULL_COLUMNS) ? 'detailed' : 'simple';

  const options = [
    { key: 'simple' as const, columns: FPC_LEAN_COLUMNS, icon: 'doc.text.fill' },
    { key: 'detailed' as const, columns: FPC_FULL_COLUMNS, icon: 'list.bullet' },
  ];

  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}
    >
      {options.map((option) => {
        const active = selectedPreset === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.columns)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
              minHeight: 36,
              paddingHorizontal: spacing[3],
              borderRadius: radius.full,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: active ? m3.colorScheme.primary : m3.surface.s300,
              backgroundColor: active
                ? colorWithOpacity(m3.colorScheme.primary, 0.1)
                : pressed
                  ? m3.surface.s200
                  : 'transparent',
            })}
          >
            <Symbol
              name={option.icon}
              size={13}
              color={active ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant}
            />
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: active ? fontWeight.semibold : fontWeight.medium,
                color: active ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant,
              }}
            >
              {t(`reports.fpc.detail.${option.key}.title`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
