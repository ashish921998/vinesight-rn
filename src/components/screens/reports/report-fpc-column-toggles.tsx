import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { Symbol } from '@/components/ui/symbol';
import { type FpcColumnOptions, FPC_FULL_COLUMNS, FPC_LEAN_COLUMNS } from '@/types/report';

interface ReportFpcColumnTogglesProps {
  columns: FpcColumnOptions;
  onChange: (columns: FpcColumnOptions) => void;
  panelStyle: object;
}

function matchesPreset(columns: FpcColumnOptions, preset: FpcColumnOptions): boolean {
  return Object.keys(preset).every(
    (key) => columns[key as keyof FpcColumnOptions] === preset[key as keyof FpcColumnOptions],
  );
}

export function ReportFpcColumnToggles({
  columns,
  onChange,
  panelStyle,
}: ReportFpcColumnTogglesProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const selectedPreset = matchesPreset(columns, FPC_FULL_COLUMNS) ? 'detailed' : 'standard';

  const options = [
    {
      key: 'standard' as const,
      columns: FPC_LEAN_COLUMNS,
      icon: 'doc.text.fill',
    },
    {
      key: 'detailed' as const,
      columns: FPC_FULL_COLUMNS,
      icon: 'checkmark.circle.fill',
    },
  ];

  return (
    <View style={[panelStyle, { gap: spacing[3] }]}>
      <Text
        style={{
          fontSize: fontSize.xs,
          color: m3.colorScheme.onSurfaceVariant,
          fontWeight: fontWeight.medium,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {t('reports.fpc.detail.title')}
      </Text>
      <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
        {t('reports.fpc.detail.hint')}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        {options.map((option) => {
          const active = selectedPreset === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => onChange(option.columns)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(`reports.fpc.detail.${option.key}.title`)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 92,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: spacing[2],
                borderRadius: borderRadius.xl,
                borderCurve: 'continuous',
                padding: spacing[3],
                borderWidth: 1,
                borderColor: active
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.primary, 0.3),
                backgroundColor: active
                  ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                  : pressed
                    ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                    : colorWithOpacity(m3.colorScheme.primary, 0.04),
              })}
            >
              <Symbol name={option.icon} size={18} color={m3.colorScheme.primary} />
              <View style={{ flex: 1, gap: spacing[1] }}>
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  {t(`reports.fpc.detail.${option.key}.title`)}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    lineHeight: 17,
                    color: m3.colorScheme.onSurfaceVariant,
                  }}
                >
                  {t(`reports.fpc.detail.${option.key}.description`)}
                </Text>
              </View>
              <Symbol
                name={active ? 'checkmark.circle.fill' : 'circle'}
                size={17}
                color={active ? m3.colorScheme.primary : m3.colorScheme.outline}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
